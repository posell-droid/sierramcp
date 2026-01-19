import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@repo/db";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import type {
  ToolSpec,
  ToolSpecSource,
  ToolSpecTestCase,
  ToolSpecExample,
  HttpMethod,
} from "@repo/shared/toolspec";
import { validateToolSpec, inferSafetyFromMethod } from "@repo/shared/toolspec";

// Tool name must be snake_case
const toolNameRegex = /^[a-z][a-z0-9_]*$/;

// =============================================================================
// ZOD SCHEMAS FOR TOOLSPEC
// =============================================================================

const jsonSchemaPropertySchema: z.ZodType<any> = z.lazy(() =>
  z.object({
    type: z.enum(["string", "number", "integer", "boolean", "array", "object"]),
    description: z.string().optional(),
    format: z.string().optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
    default: z.unknown().optional(),
    items: jsonSchemaPropertySchema.optional(),
    properties: z.record(jsonSchemaPropertySchema).optional(),
    required: z.array(z.string()).optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
    example: z.unknown().optional(),
  })
);

const jsonSchemaObjectSchema = z.object({
  type: z.literal("object"),
  properties: z.record(jsonSchemaPropertySchema),
  required: z.array(z.string()).optional(),
  additionalProperties: z.boolean().optional(),
});

// More flexible schema that allows any JSON schema type (object, array, etc.)
const jsonSchemaAnySchema: z.ZodType<unknown> = z.lazy(() => z.object({
  type: z.enum(["object", "array", "string", "number", "integer", "boolean"]),
  description: z.string().optional(),
  properties: z.record(jsonSchemaPropertySchema).optional(),
  required: z.array(z.string()).optional(),
  items: jsonSchemaPropertySchema.optional(),
  additionalProperties: z.boolean().optional(),
}).passthrough());

const toolSpecInputsSchema = z.object({
  path: jsonSchemaObjectSchema,
  query: jsonSchemaObjectSchema,
  headers: jsonSchemaObjectSchema,
  body: jsonSchemaObjectSchema,
});

const toolSpecSourceSchema = z.object({
  docId: z.string(),
  chunkId: z.string(),
  excerpt: z.string(),
});

const toolSpecTestCaseSchema = z.object({
  name: z.string(),
  inputs: z.object({
    path: z.record(z.unknown()),
    query: z.record(z.unknown()),
    headers: z.record(z.unknown()),
    body: z.record(z.unknown()),
  }),
  expectedStatus: z.number(),
  expectedBodyContains: z.unknown().optional(), // Can be object or array
});

const toolSpecExampleSchema = z.object({
  request: z.object({
    path: z.record(z.unknown()),
    query: z.record(z.unknown()),
    headers: z.record(z.unknown()),
    body: z.record(z.unknown()),
  }),
  response: z.unknown(), // Can be object or array
});

const toolSpecSchema = z.object({
  id: z.string().uuid().optional(),
  applicationId: z.string().uuid(),
  version: z.number().int().positive(),
  status: z.enum(["DRAFT", "PUBLISHED"]),
  name: z.string().regex(toolNameRegex),
  title: z.string().min(1).max(255),
  description: z.string().min(1),
  http: z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string().startsWith("/"),
    baseUrlEnvKey: z.string().optional(),
  }),
  auth: z.object({
    type: z.enum(["oauth2", "apiKey", "basic", "bearer", "none"]),
    scopes: z.array(z.string()).optional(),
  }),
  inputs: toolSpecInputsSchema,
  outputs: z.object({
    success: jsonSchemaAnySchema, // Allow object or array schemas
    errors: z.array(z.object({
      status: z.number(),
      code: z.string(),
      description: z.string(),
    })),
  }),
  safety: z.object({
    readOnly: z.boolean(),
    destructive: z.boolean(),
    pii: z.boolean(),
  }),
  examples: toolSpecExampleSchema,
  testCases: z.array(toolSpecTestCaseSchema),
  sources: z.array(toolSpecSourceSchema).min(1, "At least one source citation is required"),
});

export const toolsRouter = router({
  /**
   * List tools for an application
   */
  list: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        status: z.enum(["DRAFT", "TESTED", "PUBLISHED", "DEPRECATED"]).optional(),
        includeAllVersions: z.boolean().optional(), // If true, show all versions; default shows only latest
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { applicationId, status, includeAllVersions, cursor, limit = 20 } = input;

      // Verify application access
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: applicationId },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const tools = await ctx.tenant.db.tool.findMany({
        where: {
          applicationId,
          ...(status && { status }),
          // By default, only show latest versions
          ...(!includeAllVersions && { isLatest: true }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: [{ status: "asc" }, { name: "asc" }],
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              executions: true,
              testResults: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (tools.length > limit) {
        const nextItem = tools.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: tools,
        nextCursor,
      };
    }),

  /**
   * Get a single tool with test results
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.id },
        include: {
          application: {
            select: { id: true, name: true, slug: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          testResults: {
            take: 10,
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: {
              executions: true,
              testResults: true,
            },
          },
        },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      return tool;
    }),

  /**
   * Create a new tool from ToolSpec (generated by LLM)
   * This is the primary creation method for AI-generated tools.
   */
  createFromSpec: protectedProcedure
    .input(toolSpecSchema)
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

      // Validate sources reference real chunks
      for (const source of input.sources) {
        const chunk = await ctx.tenant.db.documentChunk.findFirst({
          where: {
            id: source.chunkId,
            documentId: source.docId,
            tenantId: ctx.tenant.tenantId,
          },
        });
        if (!chunk) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invalid source citation: chunk ${source.chunkId} not found`,
          });
        }
      }

      // Check for name uniqueness within application
      const existing = await ctx.tenant.db.tool.findFirst({
        where: {
          applicationId: input.applicationId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Tool '${input.name}' already exists for this application`,
        });
      }

      const tool = await ctx.tenant.db.tool.create({
        data: {
          applicationId: input.applicationId,
          name: input.name,
          title: input.title,
          displayName: input.title, // Legacy field - kept for backward compatibility
          description: input.description,
          status: "DRAFT",
          httpMethod: input.http.method,
          pathTemplate: input.http.path,
          version: 1,
          isLatest: true, // Mark as latest version
          // Store complete ToolSpec
          spec: input as unknown as Prisma.InputJsonValue,
          // Denormalized safety flags
          readOnly: input.safety.readOnly,
          destructive: input.safety.destructive,
          pii: input.safety.pii,
          // Sources for traceability
          sources: input.sources as unknown as Prisma.InputJsonValue,
          // Test cases and examples
          testCases: input.testCases as unknown as Prisma.InputJsonValue,
          examples: input.examples as unknown as Prisma.InputJsonValue,
          // Auth
          authType: input.auth.type,
          authScopes: input.auth.scopes ?? [],
          tenantId: ctx.tenant.tenantId,
          createdById: ctx.tenant.userId,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.created",
          entityType: "Tool",
          entityId: tool.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: input.applicationId,
            name: tool.name,
            title: tool.title,
            sourceCount: input.sources.length,
          },
        },
      });

      return tool;
    }),

  /**
   * Create a new tool (simple form - for manual creation)
   */
  create: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        name: z.string().min(1).max(100).regex(toolNameRegex, {
          message: "Tool name must be snake_case (lowercase letters, numbers, underscores)",
        }),
        title: z.string().min(1).max(255),
        description: z.string().min(1).max(2000),
        httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        pathTemplate: z.string().min(1).max(500),
        readOnly: z.boolean().optional(),
        destructive: z.boolean().optional(),
        pii: z.boolean().optional(),
        sources: z.array(toolSpecSourceSchema).optional(),
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

      // Check for name uniqueness within application
      const existing = await ctx.tenant.db.tool.findFirst({
        where: {
          applicationId: input.applicationId,
          name: input.name,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Tool '${input.name}' already exists for this application`,
        });
      }

      // Infer safety from HTTP method if not provided
      const safety = inferSafetyFromMethod(input.httpMethod as HttpMethod);

      const tool = await ctx.tenant.db.tool.create({
        data: {
          applicationId: input.applicationId,
          name: input.name,
          title: input.title,
          displayName: input.title, // Legacy field
          description: input.description,
          status: "DRAFT",
          httpMethod: input.httpMethod,
          pathTemplate: input.pathTemplate,
          version: 1,
          isLatest: true, // Mark as latest version
          spec: {},
          readOnly: input.readOnly ?? safety.readOnly,
          destructive: input.destructive ?? safety.destructive,
          pii: input.pii ?? safety.pii,
          sources: input.sources ?? [],
          testCases: [],
          examples: {},
          tenantId: ctx.tenant.tenantId,
          createdById: ctx.tenant.userId,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.created",
          entityType: "Tool",
          entityId: tool.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: input.applicationId,
            name: tool.name,
            title: tool.title,
          },
        },
      });

      return tool;
    }),

  /**
   * Update a tool (DRAFT status only)
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().min(1).max(2000).optional(),
        httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).optional(),
        pathTemplate: z.string().min(1).max(500).optional(),
        readOnly: z.boolean().optional(),
        destructive: z.boolean().optional(),
        pii: z.boolean().optional(),
        spec: z.record(z.unknown()).optional(),
        sources: z.array(toolSpecSourceSchema).optional(),
        testCases: z.array(toolSpecTestCaseSchema).optional(),
        examples: toolSpecExampleSchema.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.tool.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      if (existing.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only DRAFT tools can be updated. Deprecate and create a new version instead.",
        });
      }

      const tool = await ctx.tenant.db.tool.update({
        where: { id },
        data: {
          ...(data.title !== undefined && { title: data.title }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.httpMethod !== undefined && { httpMethod: data.httpMethod }),
          ...(data.pathTemplate !== undefined && { pathTemplate: data.pathTemplate }),
          ...(data.readOnly !== undefined && { readOnly: data.readOnly }),
          ...(data.destructive !== undefined && { destructive: data.destructive }),
          ...(data.pii !== undefined && { pii: data.pii }),
          ...(data.spec !== undefined && { spec: data.spec }),
          ...(data.sources !== undefined && { sources: data.sources }),
          ...(data.testCases !== undefined && { testCases: data.testCases }),
          ...(data.examples !== undefined && { examples: data.examples }),
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.updated",
          entityType: "Tool",
          entityId: tool.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { changes: Object.keys(data) },
        },
      });

      return tool;
    }),

  /**
   * Test a tool execution
   *
   * Retrieves credentials from AWS Secrets Manager and executes the tool
   * against the specified environment.
   */
  test: protectedProcedure
    .input(
      z.object({
        toolId: z.string().uuid(),
        environmentId: z.string().uuid(),
        input: z.record(z.unknown()),
        expectedOutput: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.toolId },
        include: {
          application: true,
        },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      const environment = await ctx.tenant.db.applicationEnvironment.findUnique({
        where: { id: input.environmentId },
      });

      if (!environment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Environment not found",
        });
      }

      if (environment.applicationId !== tool.applicationId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Environment does not belong to this tool's application",
        });
      }

      const startTime = Date.now();
      let success = false;
      let actualOutput: Record<string, unknown> | null = null;
      let errorMessage: string | null = null;
      let httpStatusCode: number | null = null;
      let responseHeaders: Record<string, string> = {};

      try {
        // Build URL from path template
        let path = tool.pathTemplate;
        const inputData = input.input as Record<string, unknown>;

        // Get ToolSpec for structured inputs
        const spec = tool.spec as Record<string, unknown> | null;
        const specInputs = spec?.inputs as {
          path?: { properties?: Record<string, unknown> };
          query?: { properties?: Record<string, unknown> };
          body?: { properties?: Record<string, unknown> };
        } | null;

        // Replace path parameters
        const pathParams = specInputs?.path?.properties ? Object.keys(specInputs.path.properties) : [];
        for (const key of pathParams) {
          if (key in inputData) {
            path = path.replace(`{${key}}`, encodeURIComponent(String(inputData[key])));
          }
        }
        // Also handle any remaining placeholders from inputData
        for (const [key, value] of Object.entries(inputData)) {
          path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
        }

        const url = new URL(path, environment.baseUrl);

        // Add query parameters from spec
        const queryParams = specInputs?.query?.properties ? Object.keys(specInputs.query.properties) : [];
        for (const key of queryParams) {
          if (key in inputData && inputData[key] !== undefined && inputData[key] !== null) {
            url.searchParams.set(key, String(inputData[key]));
          }
        }

        // Build headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "User-Agent": "SierraMCP/1.0",
        };

        // Retrieve credentials from AWS Secrets Manager
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
                  // For OAuth2, attempt to use refresh token or existing access token
                  if (credentials.accessToken) {
                    headers["Authorization"] = `Bearer ${credentials.accessToken}`;
                  } else {
                    throw new Error("OAuth2 access token not available");
                  }
                  break;
              }
            }
          } catch (secretError) {
            console.error("Failed to retrieve credentials:", secretError);
            errorMessage = `Failed to retrieve credentials: ${secretError instanceof Error ? secretError.message : "Unknown error"}`;
          }
        } else if (environment.authType !== "NONE" && !environment.secretArn) {
          errorMessage = "Credentials required but not configured for this environment";
        }

        // Only make the request if we don't have an error
        if (!errorMessage) {
          // Build body for non-GET requests
          let body: string | undefined;
          if (tool.httpMethod !== "GET") {
            // Check for body params in spec
            const bodyParams = specInputs?.body?.properties ? Object.keys(specInputs.body.properties) : [];
            if (bodyParams.length > 0) {
              const bodyData: Record<string, unknown> = {};
              for (const key of bodyParams) {
                if (key in inputData) {
                  bodyData[key] = inputData[key];
                }
              }
              if (Object.keys(bodyData).length > 0) {
                body = JSON.stringify(bodyData);
              }
            }
          }

          // Execute request with timeout
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch(url.toString(), {
              method: tool.httpMethod,
              headers,
              body,
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            httpStatusCode = response.status;
            success = response.ok;

            // Capture response headers
            response.headers.forEach((value, key) => {
              responseHeaders[key] = value;
            });

            if (response.ok) {
              const contentType = response.headers.get("content-type");
              if (contentType?.includes("application/json")) {
                actualOutput = await response.json();
              } else {
                actualOutput = { body: await response.text() };
              }
            } else {
              const errorBody = await response.text();
              errorMessage = `HTTP ${response.status}: ${errorBody.substring(0, 500)}`;
              // Still capture response for debugging
              try {
                actualOutput = JSON.parse(errorBody);
              } catch {
                actualOutput = { error: errorBody };
              }
            }
          } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError instanceof Error && fetchError.name === "AbortError") {
              errorMessage = "Request timed out after 30 seconds";
            } else {
              throw fetchError;
            }
          }
        }
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : "Execution failed";
      }

      const durationMs = Date.now() - startTime;

      // Record test result
      const testResult = await ctx.tenant.db.toolTestResult.create({
        data: {
          toolId: input.toolId,
          input: input.input,
          expectedOutput: input.expectedOutput ?? undefined,
          actualOutput: actualOutput ?? undefined,
          success,
          errorMessage,
          durationMs,
          environmentId: input.environmentId,
          testedById: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      // Update tool status to TESTED if first successful test
      if (success && tool.status === "DRAFT") {
        await ctx.tenant.db.tool.update({
          where: { id: input.toolId },
          data: { status: "TESTED" },
        });
      }

      return {
        testResultId: testResult.id,
        success,
        durationMs,
        httpStatusCode,
        responseHeaders,
        actualOutput,
        errorMessage,
      };
    }),

  /**
   * Get test results for a tool
   */
  getTestResults: protectedProcedure
    .input(
      z.object({
        toolId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { toolId, limit, cursor } = input;

      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: toolId },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      const results = await ctx.tenant.db.toolTestResult.findMany({
        where: { toolId },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (results.length > limit) {
        const nextItem = results.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: results,
        nextCursor,
      };
    }),

  /**
   * Publish a tool (requires TESTED status)
   *
   * GUARDRAILS:
   * - Requires at least one successful test (TESTED status)
   * - For non-GET methods: requires confirmWrite flag
   * - For destructive tools (DELETE or destructive=true): requires confirmDestructive flag
   * - Validates sources still reference valid chunks
   */
  publish: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        confirmWrite: z.boolean().optional(),
        confirmDestructive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.id },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      if (tool.status !== "TESTED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only TESTED tools can be published. Run at least one successful test first.",
        });
      }

      // Guardrail: Require confirmation for write operations
      const isWriteOperation = tool.httpMethod !== "GET";
      if (isWriteOperation && !input.confirmWrite) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `This tool uses ${tool.httpMethod} method which can modify data. Set confirmWrite: true to proceed.`,
        });
      }

      // Guardrail: Require confirmation for destructive operations
      const isDestructive = tool.httpMethod === "DELETE" || tool.destructive;
      if (isDestructive && !input.confirmDestructive) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This tool is marked as destructive. Set confirmDestructive: true to proceed.",
        });
      }

      // Validate sources still reference valid chunks
      const sources = (tool.sources as Array<{ chunkId: string; docId: string }>) || [];
      if (sources.length > 0) {
        const chunkIds = sources.map((s) => s.chunkId);
        const validChunks = await ctx.tenant.db.documentChunk.count({
          where: {
            id: { in: chunkIds },
            tenantId: ctx.tenant.tenantId,
          },
        });

        if (validChunks < chunkIds.length) {
          console.warn(
            `[Tool Publish] ${chunkIds.length - validChunks}/${chunkIds.length} source chunks no longer exist for tool ${tool.id}`
          );
          // Allow publish but log warning - documentation may have been updated
        }
      }

      const updated = await ctx.tenant.db.tool.update({
        where: { id: input.id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.published",
          entityType: "Tool",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            name: tool.name,
            version: tool.version,
            httpMethod: tool.httpMethod,
            isDestructive,
            confirmedWrite: input.confirmWrite,
            confirmedDestructive: input.confirmDestructive,
          },
        },
      });

      return updated;
    }),

  /**
   * Deprecate a tool
   */
  deprecate: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.id },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      if (tool.status !== "PUBLISHED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only PUBLISHED tools can be deprecated",
        });
      }

      const updated = await ctx.tenant.db.tool.update({
        where: { id: input.id },
        data: {
          status: "DEPRECATED",
          deprecatedAt: new Date(),
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.deprecated",
          entityType: "Tool",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: tool.name },
        },
      });

      return updated;
    }),

  /**
   * Delete a tool (DRAFT status only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.id },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      if (tool.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only DRAFT tools can be deleted. Deprecate published tools instead.",
        });
      }

      await ctx.tenant.db.tool.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.deleted",
          entityType: "Tool",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: tool.name },
        },
      });

      return { success: true };
    }),

  /**
   * Create a new version of a published tool (copies to new DRAFT)
   */
  createVersion: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.id },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      if (tool.status !== "PUBLISHED" && tool.status !== "DEPRECATED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only create new versions from PUBLISHED or DEPRECATED tools",
        });
      }

      // Find max version for this tool name
      const maxVersion = await ctx.tenant.db.tool.aggregate({
        where: {
          applicationId: tool.applicationId,
          name: tool.name,
        },
        _max: { version: true },
      });

      const newVersion = (maxVersion._max.version ?? 0) + 1;

      // Use transaction to:
      // 1. Mark old version as not latest
      // 2. Create new version with proper lineage
      const newTool = await ctx.tenant.db.$transaction(async (tx) => {
        // Mark source tool as not latest
        await tx.tool.update({
          where: { id: input.id },
          data: { isLatest: false },
        });

        // Create new version
        return tx.tool.create({
          data: {
            applicationId: tool.applicationId,
            name: tool.name,
            title: tool.title,
            displayName: tool.displayName || tool.title, // Legacy field
            description: tool.description,
            status: "DRAFT",
            httpMethod: tool.httpMethod,
            pathTemplate: tool.pathTemplate,
            version: newVersion,
            isLatest: true, // New version is now the latest
            parentToolId: input.id, // Link to parent for version lineage
            spec: tool.spec as object,
            readOnly: tool.readOnly,
            destructive: tool.destructive,
            pii: tool.pii,
            sources: tool.sources as object,
            testCases: tool.testCases as object,
            examples: tool.examples as object,
            authType: tool.authType,
            authScopes: tool.authScopes as object,
            tenantId: ctx.tenant.tenantId,
            createdById: ctx.tenant.userId,
          },
          include: {
            createdBy: {
              select: { id: true, name: true, email: true },
            },
          },
        });
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "tool.version.created",
          entityType: "Tool",
          entityId: newTool.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            name: tool.name,
            fromVersion: tool.version,
            newVersion,
          },
        },
      });

      return newTool;
    }),

  /**
   * Get version history for a tool (by name within application)
   */
  getVersionHistory: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        name: z.string(), // Tool name to get all versions for
      })
    )
    .query(async ({ ctx, input }) => {
      const versions = await ctx.tenant.db.tool.findMany({
        where: {
          applicationId: input.applicationId,
          name: input.name,
          tenantId: ctx.tenant.tenantId,
        },
        select: {
          id: true,
          version: true,
          status: true,
          isLatest: true,
          parentToolId: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { version: "desc" },
      });

      return {
        name: input.name,
        versions,
        latestVersion: versions.find((v) => v.isLatest)?.version ?? null,
        publishedVersion: versions.find((v) => v.status === "PUBLISHED")?.version ?? null,
      };
    }),

  /**
   * Get execution history for a tool
   */
  getExecutions: protectedProcedure
    .input(
      z.object({
        toolId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { toolId, limit, cursor } = input;

      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: toolId },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      const executions = await ctx.tenant.db.toolExecution.findMany({
        where: { toolId },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
        include: {
          environment: {
            select: { id: true, environment: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (executions.length > limit) {
        const nextItem = executions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: executions,
        nextCursor,
      };
    }),
});
