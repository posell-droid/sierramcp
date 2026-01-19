/**
 * RAG (Retrieval Augmented Generation) Service
 *
 * Handles vector similarity search over document chunks using pgvector.
 * Uses OpenAI text-embedding-3-small (1536 dimensions) for query embeddings.
 *
 * CONSTRAINTS:
 * - Maximum 8 chunks per retrieval (hard limit)
 * - Minimum 0.7 cosine similarity threshold (configurable)
 * - Strict tenant + application isolation
 * - Token budget enforcement for cost control
 */

import { Resource } from "sst";
import { prisma } from "@repo/db";

// =============================================================================
// CONFIGURATION
// =============================================================================

const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";
const OPENAI_EMBEDDINGS_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// RAG constraints
const MAX_CHUNKS = 8;
const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_SIMILARITY = 0.7;
const DEFAULT_MAX_TOKENS = 4000;

// Retry configuration
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 500;

// =============================================================================
// TYPES
// =============================================================================

export interface RagSearchParams {
  tenantId: string;
  applicationId: string;
  query: string;
  limit?: number; // default 5, max 8
  minSimilarity?: number; // default 0.7
  maxTokens?: number; // default 4000
}

export interface RagChunk {
  id: string;
  documentId: string;
  documentTitle: string | null;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  tokenCount: number | null;
}

export interface RagSearchResult {
  chunks: RagChunk[];
  totalTokens: number;
  queryEmbeddingMs: number;
  searchMs: number;
}

// Raw query result from pgvector
interface ChunkQueryResult {
  id: string;
  document_id: string;
  document_title: string | null;
  content: string;
  metadata: string; // JSON string
  similarity: number;
  token_count: number | null;
}

// =============================================================================
// UTILITIES
// =============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getOpenAIApiKey(): string {
  const resource = Resource as unknown as { OpenaiApiKey?: { value: string } };
  if (!resource.OpenaiApiKey?.value) {
    throw new Error("OpenAI API key not configured");
  }
  return resource.OpenaiApiKey.value;
}

// =============================================================================
// EMBEDDING GENERATION
// =============================================================================

/**
 * Generate embedding for a query string using OpenAI.
 * Includes retry logic with exponential backoff for rate limiting.
 */
export async function generateQueryEmbedding(text: string): Promise<number[]> {
  const apiKey = getOpenAIApiKey();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_EMBEDDINGS_MODEL,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          console.log(`[RAG] Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
          await sleep(delay);
          continue;
        }
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json();

      if (data.data?.[0]?.embedding) {
        return data.data[0].embedding;
      }

      throw new Error("No embedding in OpenAI response");
    } catch (error: unknown) {
      const isRetryable =
        error instanceof Error &&
        (error.message.includes("rate") ||
          error.message.includes("429") ||
          error.message.includes("timeout") ||
          error.message.includes("ECONNRESET"));

      if (isRetryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`[RAG] Retryable error, waiting ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await sleep(delay);
        continue;
      }

      throw error;
    }
  }

  throw new Error("Failed to generate embedding after max retries");
}

// =============================================================================
// VECTOR SEARCH
// =============================================================================

/**
 * Search document chunks using vector similarity.
 *
 * SECURITY: Strictly filters by tenantId AND applicationId.
 * QUALITY: Applies minimum similarity threshold.
 * COST: Enforces token budget after retrieval.
 */
export async function searchChunks(params: RagSearchParams): Promise<RagSearchResult> {
  const {
    tenantId,
    applicationId,
    query,
    limit = DEFAULT_LIMIT,
    minSimilarity = DEFAULT_MIN_SIMILARITY,
    maxTokens = DEFAULT_MAX_TOKENS,
  } = params;

  // Enforce hard limit
  const effectiveLimit = Math.min(limit, MAX_CHUNKS);

  console.log(`[RAG] searchChunks called:`, { tenantId, applicationId, query: query.substring(0, 50), limit: effectiveLimit, minSimilarity });

  // Debug: Check what tenantIds exist for this application
  const tenantCheck = await prisma.$queryRaw<{ tenant_id: string; count: bigint }[]>`
    SELECT "tenantId"::text as tenant_id, COUNT(*) as count
    FROM document_chunks
    WHERE "applicationId" = ${applicationId}::uuid
      AND embedding IS NOT NULL
    GROUP BY "tenantId"
  `;
  console.log(`[RAG] TenantIds in chunks for app ${applicationId}:`, tenantCheck);

  // Step 1: Generate query embedding
  const embeddingStart = Date.now();
  const queryEmbedding = await generateQueryEmbedding(query);
  const queryEmbeddingMs = Date.now() - embeddingStart;

  // Step 2: Execute pgvector similarity search
  // Format embedding as PostgreSQL vector literal
  const embeddingVector = `[${queryEmbedding.join(",")}]`;

  console.log(`[RAG] Query embedding dimensions: ${queryEmbedding.length}`);
  console.log(`[RAG] First 5 values: ${queryEmbedding.slice(0, 5).join(", ")}`);
  console.log(`[RAG] Vector literal preview: ${embeddingVector.substring(0, 80)}...`);

  // DEBUG: Test cross-similarity without any filters
  try {
    const debugQuery = `
      SELECT id, 1 - (embedding <=> '${embeddingVector}'::vector) as similarity
      FROM document_chunks
      WHERE "applicationId" = '${applicationId}'::uuid
      AND embedding IS NOT NULL
      ORDER BY embedding <=> '${embeddingVector}'::vector
      LIMIT 5
    `;
    const debugResults = await prisma.$queryRawUnsafe(debugQuery);
    console.log(`[RAG] DEBUG cross-similarity (no tenant filter):`, JSON.stringify(debugResults));
  } catch (e: unknown) {
    console.error(`[RAG] DEBUG query error:`, e instanceof Error ? e.message : e);
  }

  const searchStart = Date.now();

  // Use $queryRawUnsafe because Prisma.raw() doesn't work correctly with pgvector
  // The vector literal must be interpolated directly into the SQL string
  const sqlQuery = `
    SELECT
      dc.id,
      dc."documentId" as document_id,
      ad.title as document_title,
      dc.content,
      dc.metadata::text,
      1 - (dc.embedding <=> '${embeddingVector}'::vector) as similarity,
      dc."tokenCount" as token_count
    FROM document_chunks dc
    JOIN application_documents ad ON dc."documentId" = ad.id
    WHERE dc."tenantId" = '${tenantId}'::uuid
      AND dc."applicationId" = '${applicationId}'::uuid
      AND dc.embedding IS NOT NULL
      AND 1 - (dc.embedding <=> '${embeddingVector}'::vector) >= ${minSimilarity}
    ORDER BY dc.embedding <=> '${embeddingVector}'::vector
    LIMIT ${effectiveLimit}
  `;

  const results = await prisma.$queryRawUnsafe<ChunkQueryResult[]>(sqlQuery);

  const searchMs = Date.now() - searchStart;

  // Step 3: Apply token budget post-query
  let totalTokens = 0;
  const budgetedChunks: RagChunk[] = [];

  for (const row of results) {
    const tokenCount = row.token_count ?? estimateTokens(row.content);
    if (totalTokens + tokenCount > maxTokens && budgetedChunks.length > 0) {
      // Stop if we would exceed budget (but always include at least one chunk)
      break;
    }

    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      // Keep empty metadata if parse fails
    }

    budgetedChunks.push({
      id: row.id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      content: row.content,
      metadata,
      similarity: row.similarity,
      tokenCount: row.token_count,
    });

    totalTokens += tokenCount;
  }

  console.log(
    `[RAG] Search complete: ${budgetedChunks.length}/${results.length} chunks, ` +
      `${totalTokens} tokens, embedding=${queryEmbeddingMs}ms, search=${searchMs}ms`
  );

  return {
    chunks: budgetedChunks,
    totalTokens,
    queryEmbeddingMs,
    searchMs,
  };
}

/**
 * Retrieve specific chunks by ID (for loading source chunks).
 */
export async function getChunksByIds(
  tenantId: string,
  chunkIds: string[]
): Promise<RagChunk[]> {
  if (chunkIds.length === 0) {
    return [];
  }

  const results = await prisma.$queryRaw<ChunkQueryResult[]>`
    SELECT
      dc.id,
      dc."documentId" as document_id,
      ad.title as document_title,
      dc.content,
      dc.metadata::text,
      1.0 as similarity,
      dc."tokenCount" as token_count
    FROM document_chunks dc
    JOIN application_documents ad ON dc."documentId" = ad.id
    WHERE dc."tenantId" = ${tenantId}::uuid
      AND dc.id = ANY(${chunkIds}::uuid[])
  `;

  return results.map((row) => {
    let metadata: Record<string, unknown> = {};
    try {
      metadata = JSON.parse(row.metadata);
    } catch {
      // Keep empty metadata
    }

    return {
      id: row.id,
      documentId: row.document_id,
      documentTitle: row.document_title,
      content: row.content,
      metadata,
      similarity: 1.0, // Direct lookup, not similarity search
      tokenCount: row.token_count,
    };
  });
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Rough token estimation: ~4 characters per token.
 * Used when tokenCount is not stored on the chunk.
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Format chunks for LLM context.
 * Returns formatted string with document titles and chunk content.
 */
export function formatChunksForContext(chunks: RagChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const header = chunk.documentTitle
        ? `[Document: ${chunk.documentTitle}] (Chunk ID: ${chunk.id})`
        : `[Chunk ID: ${chunk.id}]`;
      return `--- Source ${i + 1} ---\n${header}\n\n${chunk.content}`;
    })
    .join("\n\n");
}

/**
 * Convert chunks to source citations for ToolSpec.
 */
export function chunksToSources(chunks: RagChunk[]): Array<{
  docId: string;
  chunkId: string;
  excerpt: string;
}> {
  return chunks.map((chunk) => ({
    docId: chunk.documentId,
    chunkId: chunk.id,
    excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? "..." : ""),
  }));
}
