/**
 * OpenAI Embeddings Module
 *
 * Handles embedding generation with:
 * - Exponential backoff + jitter for rate limiting
 * - Chunk hash caching for deduplication
 * - Batch processing with concurrency limits
 */

import { Resource } from "sst";
import { prisma } from "@repo/db";
import type { ChunkData, ChunkWithEmbedding } from "./types";

// ============================================
// CONFIGURATION
// ============================================

// OpenAI Embeddings model
export const OPENAI_EMBEDDINGS_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

// Embedding concurrency: max in-flight OpenAI calls per invocation
export const EMBEDDING_CONCURRENCY = 5;

// Delay between embedding calls (ms)
export const EMBEDDING_DELAY_MS = 100;

// Retry configuration for rate limiting
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 32000;

// Batch insert configuration
export const BATCH_INSERT_SIZE = 100;

// OpenAI API endpoint
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function addJitter(delayMs: number): number {
  const jitter = Math.random() * 0.25 * delayMs;
  return Math.floor(delayMs + jitter);
}

// ============================================
// API KEY
// ============================================

export function getOpenAIApiKey(): string {
  const resource = Resource as unknown as { OpenaiApiKey?: { value: string } };
  if (!resource.OpenaiApiKey?.value) {
    throw new Error("OpenAI API key not configured");
  }
  return resource.OpenaiApiKey.value;
}

// ============================================
// EMBEDDING GENERATION
// ============================================

/**
 * Generate embedding using OpenAI with exponential backoff + jitter on rate limiting.
 */
export async function generateEmbeddingWithRetry(
  text: string,
  chunkIndex: number
): Promise<number[] | null> {
  const apiKey = getOpenAIApiKey();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(OPENAI_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: OPENAI_EMBEDDINGS_MODEL,
          input: text,
          dimensions: EMBEDDING_DIMENSIONS,
        }),
      });

      if (response.status === 429) {
        if (attempt < MAX_RETRIES) {
          const baseDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
          const delayWithJitter = addJitter(baseDelay);
          console.log(
            `[Chunk ${chunkIndex}] Rate limited, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delayWithJitter}ms`
          );
          await sleep(delayWithJitter);
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
        const baseDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
        const delayWithJitter = addJitter(baseDelay);
        console.log(
          `[Chunk ${chunkIndex}] Retryable error, attempt ${attempt + 1}/${MAX_RETRIES}, waiting ${delayWithJitter}ms`
        );
        await sleep(delayWithJitter);
        continue;
      }

      console.error(`[Chunk ${chunkIndex}] Embedding failed after ${attempt + 1} attempts:`, error);
      throw error;
    }
  }

  return null;
}

// ============================================
// CHUNK HASH CACHING
// ============================================

/**
 * Look up existing embeddings by chunk hash.
 * Returns a map of hash -> embedding for cached chunks.
 */
export async function getCachedEmbeddings(
  tenantId: string,
  chunkHashes: string[]
): Promise<Map<string, number[]>> {
  const cached = new Map<string, number[]>();

  if (chunkHashes.length === 0) {
    return cached;
  }

  const results = await prisma.$queryRaw<Array<{ chunk_hash: string; embedding: string }>>`
    SELECT chunk_hash, embedding::text
    FROM document_chunks
    WHERE "tenantId" = ${tenantId}::uuid
      AND chunk_hash = ANY(${chunkHashes})
      AND embedding IS NOT NULL
    LIMIT ${chunkHashes.length}
  `;

  for (const row of results) {
    const embeddingStr = row.embedding.replace(/[\[\]]/g, "");
    const embedding = embeddingStr.split(",").map(Number);
    if (embedding.length === EMBEDDING_DIMENSIONS) {
      cached.set(row.chunk_hash, embedding);
    }
  }

  console.log(`Cache hit: ${cached.size}/${chunkHashes.length} chunks`);
  return cached;
}

// ============================================
// BATCH EMBEDDING GENERATION
// ============================================

/**
 * Generate embeddings for all chunks with caching and progress tracking.
 */
export async function generateEmbeddings(
  chunks: ChunkData[],
  tenantId: string,
  onProgress?: (processed: number, total: number) => Promise<void>
): Promise<ChunkWithEmbedding[]> {
  // Dynamic import for p-limit (ESM-only)
  const pLimitModule = await import("p-limit");
  const pLimit = pLimitModule.default;

  // Check cache for existing embeddings
  const chunkHashes = chunks.map((c) => c.chunkHash);
  const cachedEmbeddings = await getCachedEmbeddings(tenantId, chunkHashes);

  console.log(`Generating embeddings (concurrency=${EMBEDDING_CONCURRENCY}, delay=${EMBEDDING_DELAY_MS}ms)`);
  const limit = pLimit(EMBEDDING_CONCURRENCY);
  let processedCount = 0;

  const embeddingTasks = chunks.map((chunk) =>
    limit(async (): Promise<ChunkWithEmbedding> => {
      // Check cache first
      const cached = cachedEmbeddings.get(chunk.chunkHash);
      if (cached) {
        processedCount++;
        if (onProgress) {
          await onProgress(processedCount, chunks.length);
        }
        return { ...chunk, embedding: cached, cached: true };
      }

      // Add delay before embedding to avoid burst throttling
      if (EMBEDDING_DELAY_MS > 0) {
        await sleep(EMBEDDING_DELAY_MS);
      }

      // Generate new embedding
      const embedding = await generateEmbeddingWithRetry(chunk.content, chunk.chunkIndex);
      if (!embedding) {
        throw new Error(`Failed to generate embedding for chunk ${chunk.chunkIndex}`);
      }

      processedCount++;
      if (onProgress) {
        await onProgress(processedCount, chunks.length);
      }

      return { ...chunk, embedding, cached: false };
    })
  );

  const chunksWithEmbeddings = await Promise.all(embeddingTasks);

  const cachedCount = chunksWithEmbeddings.filter((c) => c.cached).length;
  const generatedCount = chunksWithEmbeddings.length - cachedCount;
  console.log(`Embeddings: ${cachedCount} cached, ${generatedCount} generated`);

  return chunksWithEmbeddings;
}

// ============================================
// BATCH INSERT
// ============================================

function escapeSql(str: string): string {
  return str
    // Remove null bytes (PostgreSQL doesn't allow them in text)
    .replace(/\0/g, "")
    // Escape backslashes first (before escaping quotes)
    .replace(/\\/g, "\\\\")
    // Escape single quotes
    .replace(/'/g, "''");
}

/**
 * Insert chunks in batches to reduce DB round-trips.
 */
export async function batchInsertChunks(
  chunks: ChunkWithEmbedding[],
  documentId: string,
  tenantId: string,
  applicationId: string
): Promise<void> {
  const batches: ChunkWithEmbedding[][] = [];

  for (let i = 0; i < chunks.length; i += BATCH_INSERT_SIZE) {
    batches.push(chunks.slice(i, i + BATCH_INSERT_SIZE));
  }

  console.log(`Inserting ${chunks.length} chunks in ${batches.length} batches`);

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];

    const values = batch.map((chunk) => {
      const embeddingVector = `[${chunk.embedding.join(",")}]`;
      const metadata = JSON.stringify({
        ...chunk.metadata,
        startOffset: chunk.startOffset,
        endOffset: chunk.endOffset,
        charCount: chunk.charCount,
        cached: chunk.cached,
      });
      const escapedContent = escapeSql(chunk.content);

      return `(
        uuid_generate_v4(),
        '${documentId}'::uuid,
        '${escapedContent}',
        ${chunk.chunkIndex},
        '${metadata}'::jsonb,
        '${embeddingVector}'::vector,
        '${tenantId}'::uuid,
        '${applicationId}'::uuid,
        '${chunk.chunkHash}',
        NOW()
      )`;
    });

    await prisma.$executeRawUnsafe(
      `
      INSERT INTO document_chunks (
        id, "documentId", content, "chunkIndex", metadata, embedding,
        "tenantId", "applicationId", chunk_hash, "createdAt"
      ) VALUES ${values.join(", ")}
      ON CONFLICT ("tenantId", chunk_hash) WHERE chunk_hash IS NOT NULL
      DO NOTHING
      `
    );

    console.log(`Batch ${batchIdx + 1}/${batches.length} inserted`);
  }
}
