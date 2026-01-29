import { z } from "zod";
import { router, protectedProcedure, adminProcedure, publicProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { prisma } from "@repo/db";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SecretsManagerClient, CreateSecretCommand, UpdateSecretCommand, DeleteSecretCommand, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";
import { randomUUID } from "crypto";

// Initialize SQS client for document processing
const sqsClient = new SQSClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Message interface for document processing queue
interface DocumentProcessingMessage {
  documentId: string;
  tenantId: string;
  applicationId: string;
  sourceType: "URL" | "UPLOAD" | "TEXT";
}

/**
 * Send a document to the processing queue for auto-ingestion.
 */
async function sendToDocumentQueue(message: DocumentProcessingMessage): Promise<void> {
  const documentQueue = (Resource as unknown as { DocumentQueue?: { url: string } }).DocumentQueue;

  if (!documentQueue?.url) {
    console.warn("DocumentQueue not linked, skipping queue send for auto-ingestion");
    return;
  }

  const command = new SendMessageCommand({
    QueueUrl: documentQueue.url,
    MessageBody: JSON.stringify(message),
    MessageGroupId: message.tenantId,
    MessageDeduplicationId: `${message.documentId}-${Date.now()}`,
  });

  await sqsClient.send(command);
}

// Slug generation helper
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50);
}

export const applicationsRouter = router({
  /**
   * List all active application templates (global, not tenant-scoped)
   */
  listTemplates: protectedProcedure
    .input(
      z.object({
        category: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const templates = await prisma.applicationTemplate.findMany({
        where: {
          isActive: true,
          ...(input?.category && { category: input.category }),
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });

      return templates;
    }),

  /**
   * Get distinct template categories
   */
  getTemplateCategories: protectedProcedure.query(async () => {
    const result = await prisma.applicationTemplate.findMany({
      where: { isActive: true },
      select: { category: true },
      distinct: ["category"],
      orderBy: { category: "asc" },
    });

    return result.map((r) => r.category);
  }),

  /**
   * List all applications for the current tenant
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "CONFIGURING", "ACTIVE", "DISABLED", "ERROR"]).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, cursor, limit = 20 } = input ?? {};

      const applications = await ctx.tenant.db.application.findMany({
        where: {
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
        include: {
          template: {
            select: { id: true, name: true, slug: true, logoUrl: true, category: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              environments: true,
              documents: true,
              tools: true
            },
          },
          tools: {
            select: {
              id: true,
              name: true,
              title: true,
              description: true,
              status: true,
              httpMethod: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      });

      let nextCursor: string | undefined;
      if (applications.length > limit) {
        const nextItem = applications.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: applications,
        nextCursor,
      };
    }),

  /**
   * Get a single application by ID with environments
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.id },
        include: {
          template: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          environments: {
            orderBy: { environment: "asc" },
          },
          _count: {
            select: {
              documents: true,
              tools: true
            },
          },
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      return application;
    }),

  /**
   * Create a new application (from template or custom)
   * If the template has pre-configured settings (baseUrl, authType, tools),
   * automatically create an environment and tools from the template.
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        templateId: z.string().uuid().optional(),
        // Template configuration for variable substitution
        templateConfig: z.object({
          store: z.string().optional(),      // Shopify store name
          realmId: z.string().optional(),    // QuickBooks company ID
        }).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Generate unique slug
      let baseSlug = generateSlug(input.name);
      let slug = baseSlug;
      let counter = 1;

      // Check for slug uniqueness within tenant
      while (true) {
        const existing = await ctx.tenant.db.application.findFirst({
          where: { slug },
        });
        if (!existing) break;
        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      // Fetch template with full configuration if provided
      let template = null;
      if (input.templateId) {
        template = await prisma.applicationTemplate.findUnique({
          where: { id: input.templateId },
        });
        if (!template) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Template not found",
          });
        }
      }

      // Determine initial status based on template configuration
      // If template has pre-configured settings, start in CONFIGURING state
      const hasTemplateConfig = template?.defaultBaseUrl && template?.defaultAuthType;
      const initialStatus = hasTemplateConfig ? "CONFIGURING" : "DRAFT";

      const application = await ctx.tenant.db.application.create({
        data: {
          name: input.name,
          description: input.description,
          slug,
          templateId: input.templateId,
          status: initialStatus,
          createdById: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
        include: {
          template: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      // If template has pre-configured environment settings, create a PRODUCTION environment
      if (template?.defaultBaseUrl && template?.defaultAuthType) {
        // Perform variable substitution for {store} and {realmId}
        let baseUrl = template.defaultBaseUrl;
        let authConfig = template.authConfig ?? {};

        if (input.templateConfig) {
          const { store, realmId } = input.templateConfig;

          // Substitute {store} in URLs (for Shopify)
          if (store) {
            baseUrl = baseUrl.replace(/\{store\}/g, store);
            if (typeof authConfig === 'object' && authConfig !== null) {
              const authConfigStr = JSON.stringify(authConfig);
              authConfig = JSON.parse(authConfigStr.replace(/\{store\}/g, store));
            }
          }

          // Substitute {realmId} in URLs (for QuickBooks)
          if (realmId) {
            baseUrl = baseUrl.replace(/\{realmId\}/g, realmId);
            if (typeof authConfig === 'object' && authConfig !== null) {
              const authConfigStr = JSON.stringify(authConfig);
              authConfig = JSON.parse(authConfigStr.replace(/\{realmId\}/g, realmId));
            }
          }
        }

        await ctx.tenant.db.applicationEnvironment.create({
          data: {
            applicationId: application.id,
            environment: "PRODUCTION",
            baseUrl: baseUrl,
            authType: template.defaultAuthType,
            authConfig: authConfig,
            tenantId: ctx.tenant.tenantId,
          },
        });
      }

      // If template has pre-configured tools, create them
      if (template?.defaultTools && Array.isArray(template.defaultTools) && template.defaultTools.length > 0) {
        const toolsToCreate = template.defaultTools as Array<{
          name: string;
          title?: string;
          displayName?: string; // Legacy field name in some templates
          description: string;
          httpMethod: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
          pathTemplate: string;
          inputs?: Record<string, unknown>;
          outputs?: Record<string, unknown>;
        }>;

        for (const toolDef of toolsToCreate) {
          // Support both 'title' and legacy 'displayName' field
          const toolTitle = toolDef.title || toolDef.displayName || toolDef.name;

          await ctx.tenant.db.tool.create({
            data: {
              applicationId: application.id,
              name: toolDef.name,
              title: toolTitle,
              displayName: toolTitle, // Legacy field
              description: toolDef.description,
              httpMethod: toolDef.httpMethod,
              pathTemplate: toolDef.pathTemplate,
              spec: {
                inputs: toolDef.inputs ?? {},
                outputs: toolDef.outputs ?? {},
              },
              status: "DRAFT",
              tenantId: ctx.tenant.tenantId,
              createdById: ctx.tenant.userId,
            },
          });
        }
      }

      // If template has docsUrl, auto-ingest the API documentation
      let autoIngestedDocument = false;
      if (template?.docsUrl) {
        try {
          console.log(`Auto-ingesting documentation from template: ${template.docsUrl}`);

          // Create document record for the template's docsUrl
          const document = await ctx.tenant.db.applicationDocument.create({
            data: {
              applicationId: application.id,
              sourceType: "URL",
              sourceUrl: template.docsUrl,
              title: `${template.name} API Documentation`,
              status: "PENDING",
              tenantId: ctx.tenant.tenantId,
              createdById: ctx.tenant.userId,
            },
          });

          // Queue document for processing
          await sendToDocumentQueue({
            documentId: document.id,
            tenantId: ctx.tenant.tenantId,
            applicationId: application.id,
            sourceType: "URL",
          });

          autoIngestedDocument = true;
          console.log(`Queued document ${document.id} for processing`);
        } catch (error) {
          // Log but don't fail application creation if auto-ingestion fails
          console.error("Failed to auto-ingest template documentation:", error);
        }
      }

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.created",
          entityType: "Application",
          entityId: application.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            name: application.name,
            templateId: input.templateId,
            autoCreatedEnvironment: hasTemplateConfig,
            autoCreatedTools: Array.isArray(template?.defaultTools) ? template.defaultTools.length : 0,
            autoIngestedDocumentation: autoIngestedDocument,
            templateDocsUrl: template?.docsUrl,
          },
        },
      });

      return application;
    }),

  /**
   * Update an application
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        // Treat empty strings as undefined to avoid validation errors
        name: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
          z.string().min(1).max(255).optional()
        ),
        description: z.preprocess(
          (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
          z.string().max(2000).optional()
        ),
        status: z.enum(["DRAFT", "CONFIGURING", "ACTIVE", "DISABLED", "ERROR"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.application.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const application = await ctx.tenant.db.application.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.status !== undefined && { status: data.status }),
        },
        include: {
          template: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.updated",
          entityType: "Application",
          entityId: application.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { changes: data },
        },
      });

      return application;
    }),

  /**
   * Delete an application (admin only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.application.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      await ctx.tenant.db.application.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.deleted",
          entityType: "Application",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: existing.name },
        },
      });

      return { success: true };
    }),

  /**
   * Add an environment to an application
   */
  addEnvironment: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        environment: z.enum(["PRODUCTION", "SANDBOX", "DEVELOPMENT"]),
        baseUrl: z.string().url(),
        authType: z.enum(["API_KEY", "OAUTH2", "BASIC", "BEARER", "CUSTOM_HEADER", "MTLS", "NONE"]),
        authConfig: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify application exists
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.applicationId },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      // Check if environment already exists
      const existing = await ctx.tenant.db.applicationEnvironment.findFirst({
        where: {
          applicationId: input.applicationId,
          environment: input.environment,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Environment ${input.environment} already exists for this application`,
        });
      }

      const environment = await ctx.tenant.db.applicationEnvironment.create({
        data: {
          applicationId: input.applicationId,
          environment: input.environment,
          baseUrl: input.baseUrl,
          authType: input.authType,
          authConfig: input.authConfig ?? {},
          tenantId: ctx.tenant.tenantId,
        },
      });

      // Update application status if first environment
      if (application.status === "DRAFT") {
        await ctx.tenant.db.application.update({
          where: { id: input.applicationId },
          data: { status: "CONFIGURING" },
        });
      }

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.environment.added",
          entityType: "ApplicationEnvironment",
          entityId: environment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: input.applicationId,
            environment: input.environment,
          },
        },
      });

      return environment;
    }),

  /**
   * Update an environment
   */
  updateEnvironment: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        baseUrl: z.string().url().optional(),
        authType: z.enum(["API_KEY", "OAUTH2", "BASIC", "BEARER", "CUSTOM_HEADER", "MTLS", "NONE"]).optional(),
        authConfig: z.record(z.unknown()).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      const environment = await ctx.tenant.db.applicationEnvironment.update({
        where: { id },
        data: {
          ...(data.baseUrl !== undefined && { baseUrl: data.baseUrl }),
          ...(data.authType !== undefined && { authType: data.authType }),
          ...(data.authConfig !== undefined && { authConfig: data.authConfig }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.environment.updated",
          entityType: "ApplicationEnvironment",
          entityId: environment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { changes: data },
        },
      });

      return environment;
    }),

  /**
   * Delete an environment
   */
  deleteEnvironment: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      await ctx.tenant.db.applicationEnvironment.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.environment.deleted",
          entityType: "ApplicationEnvironment",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: existing.applicationId,
            environment: existing.environment,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Test connection for an environment (with credentials validation)
   */
  testConnection: protectedProcedure
    .input(z.object({ environmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const environment = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.environmentId },
        include: {
          application: {
            select: { id: true, name: true },
          },
        },
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      let success = false;
      let errorMessage: string | null = null;
      let statusCode: number | null = null;
      const startTime = Date.now();

      try {
        // Build request headers based on auth type and credentials
        const headers: Record<string, string> = {
          "User-Agent": "GateMCP/1.0",
        };

        // Retrieve credentials from Secrets Manager if available
        if (environment.secretArn && environment.authType !== "NONE") {
          try {
            const secretsClient = new SecretsManagerClient({});
            const secretResponse = await secretsClient.send(
              new GetSecretValueCommand({
                SecretId: environment.secretArn,
              })
            );

            if (secretResponse.SecretString) {
              const credentials = JSON.parse(secretResponse.SecretString);

              // Apply credentials based on auth type
              switch (environment.authType) {
                case "API_KEY":
                  headers[credentials.headerName || "X-API-Key"] = credentials.apiKey;
                  break;
                case "BASIC":
                  const basicAuth = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
                  headers["Authorization"] = `Basic ${basicAuth}`;
                  break;
                case "BEARER":
                  headers["Authorization"] = `Bearer ${credentials.token}`;
                  break;
                case "CUSTOM_HEADER":
                  headers[credentials.headerName] = credentials.headerValue;
                  break;
                case "OAUTH2":
                  // For OAuth2, we'd need to get an access token first
                  // For now, just check if we have credentials configured
                  if (!credentials.clientId || !credentials.clientSecret) {
                    throw new Error("OAuth2 credentials incomplete");
                  }
                  // TODO: Implement OAuth2 token exchange
                  break;
              }
            }
          } catch (secretError) {
            console.error("Failed to retrieve credentials:", secretError);
            errorMessage = "Failed to retrieve credentials";
          }
        } else if (environment.authType !== "NONE" && !environment.secretArn) {
          // Credentials required but not configured
          errorMessage = "Credentials not configured";
        }

        // Only make the request if we don't already have an error
        if (!errorMessage) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 15000);

          // Try GET request (HEAD might not work with all APIs)
          const response = await fetch(environment.baseUrl, {
            method: "GET",
            headers,
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          statusCode = response.status;

          // Check response status
          if (response.status === 401 || response.status === 403) {
            success = false;
            errorMessage = `Authentication failed (${response.status})`;
          } else if (response.status >= 200 && response.status < 400) {
            success = true;
          } else if (response.status >= 400 && response.status < 500) {
            // Client errors might still mean auth worked
            success = true;
            errorMessage = `API returned ${response.status} (auth may be valid)`;
          } else {
            success = false;
            errorMessage = `Server error (${response.status})`;
          }
        }
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === "AbortError") {
            errorMessage = "Connection timed out";
          } else {
            errorMessage = error.message;
          }
        } else {
          errorMessage = "Connection failed";
        }
      }

      const durationMs = Date.now() - startTime;

      // Build status message
      let statusMessage: string;
      if (success) {
        statusMessage = statusCode ? `OK (${statusCode})` : "OK";
      } else {
        statusMessage = errorMessage || "Failed";
      }

      // Update test status
      await ctx.tenant.db.applicationEnvironment.update({
        where: { id: input.environmentId },
        data: {
          lastTestedAt: new Date(),
          lastTestStatus: statusMessage,
        },
      });

      return {
        success,
        durationMs,
        errorMessage,
        statusCode,
      };
    }),

  /**
   * Activate an application (requires at least one configured environment)
   */
  activate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.id },
        include: {
          environments: true,
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      if (application.environments.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Application must have at least one environment configured",
        });
      }

      const updated = await ctx.tenant.db.application.update({
        where: { id: input.id },
        data: { status: "ACTIVE" },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.activated",
          entityType: "Application",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      return updated;
    }),

  /**
   * Disable an application
   */
  disable: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.application.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const updated = await ctx.tenant.db.application.update({
        where: { id: input.id },
        data: { status: "DISABLED" },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.disabled",
          entityType: "Application",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      return updated;
    }),

  /**
   * Get presigned URL for logo upload
   */
  getLogoUploadUrl: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string(),
        fileSize: z.number().min(1).max(5 * 1024 * 1024), // 5MB max for logos
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify application access
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.applicationId },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      // Validate mime type (images only)
      const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "image/svg+xml",
      ];

      if (!allowedMimeTypes.includes(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported image type. Allowed: ${allowedMimeTypes.join(", ")}`,
        });
      }

      // Generate S3 key with file extension
      const fileExtension = input.fileName.split(".").pop() || "png";
      const s3Key = `logos/${ctx.tenant.tenantId}/${input.applicationId}/logo.${fileExtension}`;

      // Get bucket name from environment
      const bucketName = process.env.UPLOADS_BUCKET;
      if (!bucketName) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Upload bucket not configured",
        });
      }

      // Generate presigned URL
      const s3Client = new S3Client({});
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ContentType: input.mimeType,
        ContentLength: input.fileSize,
      });

      const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

      // Return the API-based URL for serving through our image proxy
      const logoUrl = `/api/images/${s3Key}`;

      return {
        uploadUrl,
        logoUrl,
        s3Key,
      };
    }),

  /**
   * Update application logo URL
   */
  updateLogo: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        // Allow either absolute URL or relative path (for our image proxy)
        logoUrl: z.string().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.application.findUnique({
        where: { id: input.applicationId },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const updated = await ctx.tenant.db.application.update({
        where: { id: input.applicationId },
        data: { logoUrl: input.logoUrl },
        include: {
          template: {
            select: { id: true, name: true, slug: true, logoUrl: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.logo.updated",
          entityType: "Application",
          entityId: input.applicationId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { logoUrl: input.logoUrl },
        },
      });

      return updated;
    }),

  /**
   * Set credentials for an environment (stores in AWS Secrets Manager)
   */
  setCredentials: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        credentials: z.object({
          // API Key auth
          apiKey: z.string().optional(),
          apiKeyHeader: z.string().optional(), // e.g., "X-API-Key" or "Authorization"
          // Basic auth
          username: z.string().optional(),
          password: z.string().optional(),
          // Bearer token
          bearerToken: z.string().optional(),
          // OAuth2
          clientId: z.string().optional(),
          clientSecret: z.string().optional(),
          tokenUrl: z.string().optional(),
          // Custom header
          customHeaderName: z.string().optional(),
          customHeaderValue: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const environment = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.environmentId },
        include: {
          application: {
            select: { id: true, name: true, slug: true },
          },
        },
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      // Validate credentials based on auth type
      const { credentials } = input;
      const authType = environment.authType;

      if (authType === "API_KEY" && !credentials.apiKey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "API Key is required for API_KEY authentication",
        });
      }

      if (authType === "BASIC" && (!credentials.username || !credentials.password)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Username and password are required for BASIC authentication",
        });
      }

      if (authType === "BEARER" && !credentials.bearerToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Bearer token is required for BEARER authentication",
        });
      }

      if (authType === "OAUTH2" && (!credentials.clientId || !credentials.clientSecret)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Client ID and Client Secret are required for OAuth2 authentication",
        });
      }

      if (authType === "CUSTOM_HEADER" && (!credentials.customHeaderName || !credentials.customHeaderValue)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Header name and value are required for CUSTOM_HEADER authentication",
        });
      }

      // Store in AWS Secrets Manager
      const secretsClient = new SecretsManagerClient({});
      const secretName = `gatemcp/${ctx.tenant.tenantId}/${environment.application.slug}/${environment.environment.toLowerCase()}`;

      // Build secret value based on auth type
      let secretValue: Record<string, string> = {};

      switch (authType) {
        case "API_KEY":
          secretValue = {
            apiKey: credentials.apiKey!,
            headerName: credentials.apiKeyHeader || "X-API-Key",
          };
          break;
        case "BASIC":
          secretValue = {
            username: credentials.username!,
            password: credentials.password!,
          };
          break;
        case "BEARER":
          secretValue = {
            token: credentials.bearerToken!,
          };
          break;
        case "OAUTH2":
          secretValue = {
            clientId: credentials.clientId!,
            clientSecret: credentials.clientSecret!,
            ...(credentials.tokenUrl && { tokenUrl: credentials.tokenUrl }),
          };
          break;
        case "CUSTOM_HEADER":
          secretValue = {
            headerName: credentials.customHeaderName!,
            headerValue: credentials.customHeaderValue!,
          };
          break;
        default:
          // NONE or MTLS - no credentials to store
          break;
      }

      let secretArn: string;

      try {
        if (environment.secretArn) {
          // Update existing secret
          await secretsClient.send(
            new UpdateSecretCommand({
              SecretId: environment.secretArn,
              SecretString: JSON.stringify(secretValue),
            })
          );
          secretArn = environment.secretArn;
        } else {
          // Create new secret
          const result = await secretsClient.send(
            new CreateSecretCommand({
              Name: secretName,
              SecretString: JSON.stringify(secretValue),
              Description: `Credentials for ${environment.application.name} - ${environment.environment}`,
              Tags: [
                { Key: "tenant", Value: ctx.tenant.tenantId },
                { Key: "application", Value: environment.applicationId },
                { Key: "environment", Value: environment.environment },
              ],
            })
          );
          secretArn = result.ARN!;
        }
      } catch (error: any) {
        // If secret already exists but we don't have ARN, try to update by name
        if (error.name === "ResourceExistsException") {
          const result = await secretsClient.send(
            new UpdateSecretCommand({
              SecretId: secretName,
              SecretString: JSON.stringify(secretValue),
            })
          );
          secretArn = result.ARN!;
        } else {
          console.error("Failed to store credentials:", error);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to store credentials securely",
          });
        }
      }

      // Update environment with secret ARN
      const updated = await ctx.tenant.db.applicationEnvironment.update({
        where: { id: input.environmentId },
        data: { secretArn },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.environment.credentials.set",
          entityType: "ApplicationEnvironment",
          entityId: input.environmentId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: environment.applicationId,
            environment: environment.environment,
            authType: environment.authType,
          },
        },
      });

      return { success: true, hasCredentials: true };
    }),

  /**
   * Remove credentials from an environment
   */
  removeCredentials: protectedProcedure
    .input(z.object({ environmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const environment = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.environmentId },
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      if (environment.secretArn) {
        try {
          const secretsClient = new SecretsManagerClient({});
          await secretsClient.send(
            new DeleteSecretCommand({
              SecretId: environment.secretArn,
              ForceDeleteWithoutRecovery: true,
            })
          );
        } catch (error) {
          console.error("Failed to delete secret:", error);
          // Continue even if deletion fails - might already be deleted
        }
      }

      await ctx.tenant.db.applicationEnvironment.update({
        where: { id: input.environmentId },
        data: { secretArn: null },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.environment.credentials.removed",
          entityType: "ApplicationEnvironment",
          entityId: input.environmentId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: environment.applicationId,
            environment: environment.environment,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Initiate OAuth flow for Shopify (and future OAuth providers)
   * Generates authorization URL with state token for CSRF protection
   */
  initiateOAuth: protectedProcedure
    .input(
      z.object({
        environmentId: z.string().uuid(),
        shop: z.string().min(1), // e.g., "my-store" (without .myshopify.com)
      })
    )
    .mutation(async ({ ctx, input }) => {
      const environment = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.environmentId },
        include: {
          application: {
            include: {
              template: true,
            },
          },
        },
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      if (environment.authType !== "OAUTH2") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAuth flow is only available for OAuth2 authentication type",
        });
      }

      // Validate this is a Shopify template
      if (environment.application.template?.slug !== "shopify") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "OAuth connect flow is currently only available for Shopify",
        });
      }

      // Clean up shop name (remove .myshopify.com if present)
      const shopName = input.shop.replace(/\.myshopify\.com$/, "").toLowerCase();

      // Generate random state token
      const state = randomUUID();

      // Store OAuth state in database (10 minute expiry)
      await ctx.tenant.db.oAuthState.create({
        data: {
          state,
          environmentId: input.environmentId,
          tenantId: ctx.tenant.tenantId,
          shop: shopName,
          expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        },
      });

      // Get Shopify Client ID from SST Resource
      const shopifyClientId = (Resource as unknown as { ShopifyClientId?: { value: string } }).ShopifyClientId?.value;
      if (!shopifyClientId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Shopify OAuth is not configured",
        });
      }

      // Get API base URL for redirect - use direct API Gateway URL to avoid DNS issues
      const apiUrl = process.env.API_URL || "https://s8hv7plzi4.execute-api.us-east-1.amazonaws.com";
      const redirectUri = `${apiUrl}/oauth/shopify/callback`;

      // Shopify OAuth scopes - these should match what's configured in Shopify Partner Dashboard
      const scopes = [
        "read_products",
        "read_orders",
        "read_customers",
        "read_inventory",
        "read_fulfillments",
        "read_shipping",
        "read_analytics",
        "read_reports",
        "read_content",
        "read_themes",
        "read_locations",
        "read_price_rules",
        "read_discounts",
      ].join(",");

      // Build Shopify authorization URL
      const authorizationUrl = new URL(`https://${shopName}.myshopify.com/admin/oauth/authorize`);
      authorizationUrl.searchParams.set("client_id", shopifyClientId);
      authorizationUrl.searchParams.set("scope", scopes);
      authorizationUrl.searchParams.set("redirect_uri", redirectUri);
      authorizationUrl.searchParams.set("state", state);

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.oauth.initiated",
          entityType: "ApplicationEnvironment",
          entityId: input.environmentId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            shop: shopName,
            applicationId: environment.applicationId,
          },
        },
      });

      return {
        authorizationUrl: authorizationUrl.toString(),
        shop: shopName,
      };
    }),

  /**
   * Disconnect OAuth connection and revoke access token
   */
  disconnectOAuth: protectedProcedure
    .input(z.object({ environmentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const environment = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.environmentId },
        include: {
          application: true,
        },
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      if (!environment.oauthConnectedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No OAuth connection to disconnect",
        });
      }

      // Delete secret from AWS Secrets Manager
      if (environment.secretArn) {
        try {
          const secretsClient = new SecretsManagerClient({});
          await secretsClient.send(
            new DeleteSecretCommand({
              SecretId: environment.secretArn,
              ForceDeleteWithoutRecovery: true,
            })
          );
        } catch (error) {
          console.error("Failed to delete secret:", error);
          // Continue even if deletion fails
        }
      }

      // Clear OAuth fields and secret ARN
      await ctx.tenant.db.applicationEnvironment.update({
        where: { id: input.environmentId },
        data: {
          secretArn: null,
          oauthConnectedAt: null,
          oauthShop: null,
          lastTestedAt: null,
          lastTestStatus: null,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "application.oauth.disconnected",
          entityType: "ApplicationEnvironment",
          entityId: input.environmentId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            shop: environment.oauthShop,
            applicationId: environment.applicationId,
          },
        },
      });

      return { success: true };
    }),
});
