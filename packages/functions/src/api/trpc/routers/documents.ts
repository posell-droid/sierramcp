import { z } from "zod";
import { createHash, randomUUID } from "crypto";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { Resource } from "sst";

// Initialize SQS client
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
 * Send a document to the processing queue.
 * Uses FIFO queue with content-based deduplication.
 *
 * MessageGroupId Strategy:
 * - Uses tenantId for better distribution across tenants
 * - FIFO ordering maintained within each tenant's documents
 * - Prevents one tenant's large batch from blocking others
 * - If per-app ordering is needed, use: `${message.tenantId}:${message.applicationId}`
 */
async function sendToDocumentQueue(message: DocumentProcessingMessage): Promise<void> {
  // Get queue URL from SST Resource linking
  const documentQueue = (Resource as unknown as { DocumentQueue?: { url: string } }).DocumentQueue;

  if (!documentQueue?.url) {
    console.warn("DocumentQueue not linked, skipping queue send");
    return;
  }

  const command = new SendMessageCommand({
    QueueUrl: documentQueue.url,
    MessageBody: JSON.stringify(message),
    // MessageGroupId: tenantId for distribution, FIFO within tenant
    // Change to `${message.tenantId}:${message.applicationId}` for per-app ordering
    MessageGroupId: message.tenantId,
    // MessageDeduplicationId prevents duplicate processing
    MessageDeduplicationId: `${message.documentId}-${Date.now()}`,
  });

  await sqsClient.send(command);
}

/**
 * Normalize content and compute SHA-256 hash for deduplication.
 *
 * Normalization rules:
 *   1. Trim whitespace
 *   2. Normalize line endings to \n
 *   3. Remove BOM if present
 *
 * Re-uploaded identical content MUST NOT re-embed.
 */
function computeContentHash(content: string): string {
  // Normalize content before hashing
  let normalized = content
    .trim()
    .replace(/\r\n/g, "\n")  // Windows -> Unix line endings
    .replace(/\r/g, "\n");   // Old Mac -> Unix line endings

  // Remove BOM if present
  if (normalized.charCodeAt(0) === 0xFEFF) {
    normalized = normalized.slice(1);
  }

  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export const documentsRouter = router({
  /**
   * List documents for an application
   */
  list: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { applicationId, status, cursor, limit = 20 } = input;

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

      const documents = await ctx.tenant.db.applicationDocument.findMany({
        where: {
          applicationId,
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { chunks: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (documents.length > limit) {
        const nextItem = documents.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: documents,
        nextCursor,
      };
    }),

  /**
   * Get a single document with chunk count
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const document = await ctx.tenant.db.applicationDocument.findUnique({
        where: { id: input.id },
        include: {
          application: {
            select: { id: true, name: true },
          },
          _count: {
            select: { chunks: true },
          },
        },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      return document;
    }),

  /**
   * Add a URL-based document
   *
   * DEDUPLICATION: Content hash is computed AFTER fetching URL content.
   * The URL itself is NOT hashed - only the fetched content.
   * This happens in the document processor Lambda, not here.
   * If fetched content matches existing doc, skip re-embedding.
   */
  addUrl: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        sourceUrl: z.string().url(),
        title: z.string().max(255).optional(),
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

      const document = await ctx.tenant.db.applicationDocument.create({
        data: {
          applicationId: input.applicationId,
          sourceType: "URL",
          sourceUrl: input.sourceUrl,
          title: input.title,
          status: "PENDING",
          tenantId: ctx.tenant.tenantId,
          createdById: ctx.tenant.userId,
        },
      });

      // Send to document processing queue
      await sendToDocumentQueue({
        documentId: document.id,
        tenantId: ctx.tenant.tenantId,
        applicationId: input.applicationId,
        sourceType: "URL",
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "document.added",
          entityType: "ApplicationDocument",
          entityId: document.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: input.applicationId,
            sourceType: "URL",
            sourceUrl: input.sourceUrl,
          },
        },
      });

      return document;
    }),

  /**
   * Add a text document directly
   *
   * DEDUPLICATION: Documents are deduplicated by SHA-256 hash.
   * Re-uploaded identical content returns existing document (no re-embedding).
   */
  addText: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        title: z.string().min(1).max(255),
        content: z.string().min(1).max(100000), // 100KB max
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

      // Compute content hash for deduplication
      const contentHash = computeContentHash(input.content);

      // Check for existing document with same content hash
      const existingDocument = await ctx.tenant.db.applicationDocument.findFirst({
        where: {
          applicationId: input.applicationId,
          contentHash,
        },
      });

      if (existingDocument) {
        // Return existing document - skip re-embedding
        await ctx.tenant.db.auditLog.create({
          data: {
            action: "document.deduplicated",
            entityType: "ApplicationDocument",
            entityId: existingDocument.id,
            userId: ctx.tenant.userId,
            tenantId: ctx.tenant.tenantId,
            metadata: {
              applicationId: input.applicationId,
              contentHash,
              message: "Duplicate content detected, returning existing document",
            },
          },
        });

        return {
          ...existingDocument,
          isDuplicate: true,
        };
      }

      const document = await ctx.tenant.db.applicationDocument.create({
        data: {
          applicationId: input.applicationId,
          sourceType: "TEXT",
          title: input.title,
          // Store text content in sourceUrl field for the processor to retrieve
          sourceUrl: input.content,
          contentHash,
          status: "PENDING",
          fileSize: Buffer.byteLength(input.content, "utf-8"),
          tenantId: ctx.tenant.tenantId,
          createdById: ctx.tenant.userId,
        },
      });

      // Send to document processing queue
      await sendToDocumentQueue({
        documentId: document.id,
        tenantId: ctx.tenant.tenantId,
        applicationId: input.applicationId,
        sourceType: "TEXT",
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "document.added",
          entityType: "ApplicationDocument",
          entityId: document.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: input.applicationId,
            sourceType: "TEXT",
            title: input.title,
            contentHash,
          },
        },
      });

      return document;
    }),

  /**
   * Get presigned URL for file upload
   */
  getUploadUrl: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        fileName: z.string().min(1).max(255),
        mimeType: z.string(),
        fileSize: z.number().min(1).max(50 * 1024 * 1024), // 50MB max
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

      // Validate mime type
      const allowedMimeTypes = [
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/html",
        "application/json",
        "text/csv",
      ];

      if (!allowedMimeTypes.includes(input.mimeType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported file type. Allowed: ${allowedMimeTypes.join(", ")}`,
        });
      }

      // Create document record first
      const document = await ctx.tenant.db.applicationDocument.create({
        data: {
          applicationId: input.applicationId,
          sourceType: "UPLOAD",
          fileName: input.fileName,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: "PENDING",
          tenantId: ctx.tenant.tenantId,
          createdById: ctx.tenant.userId,
        },
      });

      // Generate S3 key
      const s3Key = `documents/${ctx.tenant.tenantId}/${input.applicationId}/${document.id}/${input.fileName}`;

      // TODO: Generate presigned URL using AWS SDK
      // const { url, fields } = await generatePresignedPost(s3Key, input.mimeType, input.fileSize);

      // For now, return placeholder
      const uploadUrl = `https://placeholder-bucket.s3.amazonaws.com/${s3Key}`;

      // Update document with S3 key
      await ctx.tenant.db.applicationDocument.update({
        where: { id: document.id },
        data: { s3Key },
      });

      return {
        documentId: document.id,
        uploadUrl,
        s3Key,
        // fields, // For multipart upload
      };
    }),

  /**
   * Confirm upload and trigger processing
   */
  confirmUpload: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.tenant.db.applicationDocument.findUnique({
        where: { id: input.documentId },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (document.sourceType !== "UPLOAD") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only upload documents need confirmation",
        });
      }

      // Send to document processing queue
      await sendToDocumentQueue({
        documentId: document.id,
        tenantId: document.tenantId,
        applicationId: document.applicationId,
        sourceType: "UPLOAD",
      });

      return { success: true };
    }),

  /**
   * Reprocess a failed document
   */
  reprocess: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.tenant.db.applicationDocument.findUnique({
        where: { id: input.id },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      if (document.status !== "FAILED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only failed documents can be reprocessed",
        });
      }

      // Delete existing chunks
      await ctx.tenant.db.documentChunk.deleteMany({
        where: { documentId: input.id },
      });

      // Reset status
      await ctx.tenant.db.applicationDocument.update({
        where: { id: input.id },
        data: {
          status: "PENDING",
          errorMessage: null,
          processedAt: null,
        },
      });

      // Send to document processing queue for reprocessing
      await sendToDocumentQueue({
        documentId: document.id,
        tenantId: document.tenantId,
        applicationId: document.applicationId,
        sourceType: document.sourceType as "URL" | "UPLOAD" | "TEXT",
      });

      return { success: true };
    }),

  /**
   * Delete a document
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const document = await ctx.tenant.db.applicationDocument.findUnique({
        where: { id: input.id },
      });

      if (!document) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Document not found",
        });
      }

      // TODO: Delete from S3 if upload type
      // if (document.s3Key) {
      //   await deleteFromS3(document.s3Key);
      // }

      await ctx.tenant.db.applicationDocument.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "document.deleted",
          entityType: "ApplicationDocument",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            applicationId: document.applicationId,
            title: document.title,
            sourceType: document.sourceType,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Search document chunks using vector similarity (for RAG)
   *
   * RAG RETRIEVAL CONSTRAINTS (critical for cost + safety):
   *   - Top K: 5-8 chunks maximum (hard limit: 8)
   *   - Scope: Same applicationId only (cross-app retrieval forbidden)
   *   - Token budget: Max 4000 tokens per retrieval
   *   - Similarity threshold: Minimum 0.7 cosine similarity
   */
  searchChunks: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        query: z.string().min(1).max(1000),
        // Hard limit of 8 chunks max for cost/quality control
        limit: z.number().min(1).max(8).default(5),
        // Optional: minimum similarity threshold (0-1)
        minSimilarity: z.number().min(0).max(1).default(0.7),
        // Optional: max token budget for retrieved chunks
        maxTokens: z.number().min(100).max(4000).default(4000),
      })
    )
    .query(async ({ ctx, input }) => {
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

      // TODO: Implement vector search with AWS Bedrock Titan embeddings
      //
      // IMPLEMENTATION REQUIREMENTS:
      // 1. Generate embedding for query using Bedrock Titan (1536 dimensions)
      //    const queryEmbedding = await generateEmbedding(input.query);
      //
      // 2. Use pgvector for similarity search with STRICT constraints:
      //    - MUST filter by tenant_id AND application_id (security)
      //    - MUST apply similarity threshold (quality)
      //    - MUST enforce token budget (cost)
      //
      // const chunks = await prisma.$queryRaw`
      //   SELECT dc.id, dc.content, dc.metadata, dc.token_count,
      //          ad.title as document_title, dc.document_id,
      //          1 - (dc.embedding <=> ${queryEmbedding}::vector) as similarity
      //   FROM document_chunks dc
      //   JOIN application_documents ad ON dc.document_id = ad.id
      //   WHERE dc.tenant_id = ${ctx.tenant.tenantId}
      //     AND dc.application_id = ${input.applicationId}
      //     AND 1 - (dc.embedding <=> ${queryEmbedding}::vector) >= ${input.minSimilarity}
      //   ORDER BY dc.embedding <=> ${queryEmbedding}::vector
      //   LIMIT ${input.limit}
      // `;
      //
      // 3. Enforce token budget post-query:
      //    let totalTokens = 0;
      //    const budgetedChunks = chunks.filter(chunk => {
      //      if (totalTokens + (chunk.token_count || 500) > input.maxTokens) return false;
      //      totalTokens += chunk.token_count || 500;
      //      return true;
      //    });

      // Placeholder response
      return {
        chunks: [] as Array<{
          id: string;
          content: string;
          metadata: Record<string, unknown>;
          similarity: number;
          tokenCount: number | null;
          documentId: string;
          documentTitle: string | null;
        }>,
        totalTokens: 0,
        constraintsApplied: {
          maxChunks: input.limit,
          minSimilarity: input.minSimilarity,
          maxTokens: input.maxTokens,
        },
        message: "Vector search not yet implemented - requires AWS Bedrock integration",
      };
    }),

  /**
   * Get document processing statistics for an application
   */
  getStats: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.applicationId },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      const [statusCounts, chunkCount] = await Promise.all([
        ctx.tenant.db.applicationDocument.groupBy({
          by: ["status"],
          where: { applicationId: input.applicationId },
          _count: true,
        }),
        ctx.tenant.db.documentChunk.count({
          where: { applicationId: input.applicationId },
        }),
      ]);

      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        totalChunks: chunkCount,
      };

      for (const item of statusCounts) {
        const key = item.status.toLowerCase() as keyof typeof stats;
        if (key in stats && key !== "totalChunks") {
          stats[key] = item._count;
        }
      }

      return stats;
    }),
});
