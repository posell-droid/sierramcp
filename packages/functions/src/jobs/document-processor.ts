/**
 * Document Processor Lambda
 *
 * Processes documents for RAG: fetch content → chunk → embed → store in pgvector
 *
 * Uses OpenAI text-embedding-3-small for embeddings (1536 dimensions)
 *
 * THROTTLING MITIGATIONS:
 * 1. p-limit for in-flight embedding calls (EMBEDDING_CONCURRENCY)
 * 2. Delay between embedding calls (EMBEDDING_DELAY_MS)
 * 3. Exponential backoff + jitter on rate limiting (max 8 retries)
 * 4. Chunk hash caching to skip re-embedding identical content
 * 5. Batch inserts to reduce DB round-trips
 *
 * TUNING GUIDE:
 * - EMBEDDING_CONCURRENCY: OpenAI allows higher concurrency than Bedrock
 * - CHUNK_SIZE: 2500 chars (~600-800 tokens), balance retrieval quality vs call count
 * - CHUNK_OVERLAP: 100 chars for context continuity
 * - BATCH_INSERT_SIZE: 100 rows per INSERT, tune based on payload size
 */

import { SQSHandler, SQSRecord } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import { prisma } from "@repo/db";
import { Resource } from "sst";

// p-limit is ESM-only, use dynamic import
let pLimit: typeof import("p-limit").default;

// ============================================
// CONFIGURATION
// ============================================

// Embedding concurrency: max in-flight OpenAI calls per invocation
// OpenAI has generous rate limits, so we can increase this
const EMBEDDING_CONCURRENCY = 5;

// Delay between embedding calls (ms) - can be lower for OpenAI
const EMBEDDING_DELAY_MS = 100;

// Retry configuration for rate limiting
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000; // 1 second base
const MAX_DELAY_MS = 32000; // 32 second cap

// Chunking configuration
// TUNING: Larger chunks = fewer embedding calls but coarser retrieval
const CHUNK_SIZE = 2500; // ~600-800 tokens
const CHUNK_OVERLAP = 100;
const MIN_CHUNK_SIZE = 50; // Skip tiny chunks

// Batch insert configuration
const BATCH_INSERT_SIZE = 100;

// OpenAI Embeddings model
const OPENAI_EMBEDDINGS_MODEL = "text-embedding-3-small";
const EMBEDDING_DIMENSIONS = 1536;

// ============================================
// CLIENTS
// ============================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// OpenAI API endpoint
const OPENAI_API_URL = "https://api.openai.com/v1/embeddings";

const db = prisma;

// ============================================
// TYPES
// ============================================

interface DocumentProcessingMessage {
  documentId: string;
  tenantId: string;
  applicationId: string;
  sourceType: "URL" | "UPLOAD" | "TEXT";
}

interface ChunkData {
  content: string;
  chunkIndex: number;
  chunkHash: string;
  startOffset: number;
  endOffset: number;
  charCount: number;
}

interface ChunkWithEmbedding extends ChunkData {
  embedding: number[];
  cached: boolean;
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Compute SHA-256 hash of normalized chunk content.
 * Used for deduplication - identical chunks reuse existing embeddings.
 */
function computeChunkHash(content: string): string {
  const normalized = content
    .trim()
    .replace(/\s+/g, " ") // Normalize whitespace
    .toLowerCase(); // Case-insensitive dedup
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

/**
 * Add jitter to delay for better distribution of retry attempts.
 * Jitter range: 0-25% of the delay.
 */
function addJitter(delayMs: number): number {
  const jitter = Math.random() * 0.25 * delayMs;
  return Math.floor(delayMs + jitter);
}

// ============================================
// CONTENT FETCHING
// ============================================

async function fetchDocumentContent(
  document: {
    sourceType: string;
    sourceUrl: string | null;
    s3Key: string | null;
  }
): Promise<string> {
  const sourceType = document.sourceType;

  if (sourceType === "TEXT") {
    return document.sourceUrl || "";
  }

  if (sourceType === "URL" && document.sourceUrl) {
    const response = await fetch(document.sourceUrl, {
      headers: {
        "User-Agent": "GateMCP Document Processor/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (contentType.includes("text/html")) {
      return extractTextFromHtml(text);
    }

    return text;
  }

  if (sourceType === "UPLOAD" && document.s3Key) {
    const uploads = (Resource as unknown as { Uploads?: { name: string } }).Uploads;
    if (!uploads?.name) {
      throw new Error("Uploads bucket not configured");
    }
    const command = new GetObjectCommand({
      Bucket: uploads.name,
      Key: document.s3Key,
    });

    const response = await s3Client.send(command);
    const body = await response.Body?.transformToString();

    if (!body) {
      throw new Error("Empty S3 object");
    }

    const contentType = response.ContentType || "";
    if (contentType.includes("text/html")) {
      return extractTextFromHtml(body);
    }

    return body;
  }

  throw new Error(`Unsupported source type: ${sourceType}`);
}

function extractTextFromHtml(html: string): string {
  // Remove script and style tags with their content
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ");

  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}

// ============================================
// CHUNKING
// ============================================

/**
 * Patterns indicating low-value content to skip.
 * These are typically navigation, boilerplate, or repetitive sections.
 */
const LOW_VALUE_PATTERNS = [
  /^(home|about|contact|privacy|terms|copyright|all rights reserved)/i,
  /^(skip to|jump to|go to|back to top)/i,
  /^(loading|please wait|processing)/i,
  /^(cookie|we use cookies)/i,
  /^(subscribe|newsletter|sign up|follow us)/i,
  /^(share|tweet|like|pin it)/i,
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})$/, // Just a date
  /^(page \d+|chapter \d+|\d+ of \d+)$/i,
];

/**
 * Check if a chunk is low-value and should be skipped.
 */
function isLowValueChunk(content: string): boolean {
  const trimmed = content.trim();

  // Too short
  if (trimmed.length < MIN_CHUNK_SIZE) {
    return true;
  }

  // Mostly whitespace or punctuation
  const alphanumCount = (trimmed.match(/[a-zA-Z0-9]/g) || []).length;
  if (alphanumCount < trimmed.length * 0.3) {
    return true;
  }

  // Matches low-value patterns
  for (const pattern of LOW_VALUE_PATTERNS) {
    if (pattern.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Split text into chunks with overlap.
 * Tries to break at sentence boundaries for better context.
 */
function chunkText(
  text: string,
  chunkSize: number = CHUNK_SIZE,
  overlap: number = CHUNK_OVERLAP
): ChunkData[] {
  const chunks: ChunkData[] = [];

  if (text.length <= chunkSize) {
    if (!isLowValueChunk(text)) {
      chunks.push({
        content: text,
        chunkIndex: 0,
        chunkHash: computeChunkHash(text),
        startOffset: 0,
        endOffset: text.length,
        charCount: text.length,
      });
    }
    return chunks;
  }

  let position = 0;
  let chunkIndex = 0;

  while (position < text.length) {
    let endPosition = Math.min(position + chunkSize, text.length);

    // Try to break at sentence boundary
    if (endPosition < text.length) {
      const chunk = text.slice(position, endPosition);
      const lastSentenceEnd = Math.max(
        chunk.lastIndexOf(". "),
        chunk.lastIndexOf(".\n"),
        chunk.lastIndexOf("! "),
        chunk.lastIndexOf("? "),
        chunk.lastIndexOf("\n\n")
      );

      // If we found a sentence boundary in the last 30% of the chunk, use it
      if (lastSentenceEnd > chunkSize * 0.7) {
        endPosition = position + lastSentenceEnd + 1;
      }
    }

    const chunkContent = text.slice(position, endPosition).trim();

    // Skip low-value chunks
    if (!isLowValueChunk(chunkContent)) {
      chunks.push({
        content: chunkContent,
        chunkIndex,
        chunkHash: computeChunkHash(chunkContent),
        startOffset: position,
        endOffset: endPosition,
        charCount: chunkContent.length,
      });
      chunkIndex++;
    }

    // Move position forward, accounting for overlap
    position = endPosition - overlap;

    // Don't go backwards
    if (chunks.length > 0 && position <= chunks[chunks.length - 1].startOffset) {
      position = endPosition;
    }
  }

  return chunks;
}

// ============================================
// EMBEDDING WITH RETRY (OpenAI)
// ============================================

/**
 * Get OpenAI API key from SST Resource.
 */
function getOpenAIApiKey(): string {
  const resource = Resource as unknown as { OpenaiApiKey?: { value: string } };
  if (!resource.OpenaiApiKey?.value) {
    throw new Error("OpenAI API key not configured");
  }
  return resource.OpenaiApiKey.value;
}

/**
 * Generate embedding using OpenAI with exponential backoff + jitter on rate limiting.
 * Returns null if all retries exhausted (caller should handle).
 */
async function generateEmbeddingWithRetry(
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
        // Rate limited - retry with backoff
        if (attempt < MAX_RETRIES) {
          const baseDelay = Math.min(BASE_DELAY_MS * Math.pow(2, attempt), MAX_DELAY_MS);
          const delayWithJitter = addJitter(baseDelay);

          console.log(
            `[Chunk ${chunkIndex}] Rate limited, attempt ${attempt + 1}/${MAX_RETRIES}, ` +
            `waiting ${delayWithJitter}ms`
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
      // Check if it's a network error or rate limit that we should retry
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
          `[Chunk ${chunkIndex}] Retryable error, attempt ${attempt + 1}/${MAX_RETRIES}, ` +
          `waiting ${delayWithJitter}ms`
        );
        await sleep(delayWithJitter);
        continue;
      }

      // Non-retryable error or exhausted retries
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
async function getCachedEmbeddings(
  tenantId: string,
  chunkHashes: string[]
): Promise<Map<string, number[]>> {
  const cached = new Map<string, number[]>();

  if (chunkHashes.length === 0) {
    return cached;
  }

  // Query existing chunks with matching hashes
  // Using raw SQL because Prisma doesn't support vector type directly
  // Note: Column names are camelCase with quotes in PostgreSQL
  const results = await db.$queryRaw<Array<{ chunk_hash: string; embedding: string }>>`
    SELECT chunk_hash, embedding::text
    FROM document_chunks
    WHERE "tenantId" = ${tenantId}::uuid
      AND chunk_hash = ANY(${chunkHashes})
      AND embedding IS NOT NULL
    LIMIT ${chunkHashes.length}
  `;

  for (const row of results) {
    // Parse the vector string: "[1.0,2.0,3.0]" -> number[]
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
// BATCH INSERT
// ============================================

/**
 * Escape a string for safe use in SQL.
 * Doubles single quotes to prevent SQL injection.
 */
function escapeSql(str: string): string {
  return str.replace(/'/g, "''");
}

/**
 * Insert chunks in batches to reduce DB round-trips.
 * Uses tagged template literals with Prisma for safe parameterization.
 */
async function batchInsertChunks(
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

    // Build VALUES clause for batch insert
    // Content is escaped to prevent SQL injection
    const values = batch.map((chunk) => {
      const embeddingVector = `[${chunk.embedding.join(",")}]`;
      const metadata = JSON.stringify({
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

    // Execute batch insert with ON CONFLICT to handle duplicate hashes
    await db.$executeRawUnsafe(
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

// ============================================
// MAIN PROCESSING LOGIC
// ============================================

async function processDocument(message: DocumentProcessingMessage): Promise<void> {
  console.log(`Processing document: ${message.documentId}`);

  // Ensure p-limit is loaded (ESM dynamic import)
  if (!pLimit) {
    const pLimitModule = await import("p-limit");
    pLimit = pLimitModule.default;
  }

  // Fetch document and check status (idempotency guard)
  const document = await db.applicationDocument.findUnique({
    where: { id: message.documentId },
  });

  if (!document) {
    console.log(`Document ${message.documentId} not found, skipping`);
    return;
  }

  // Guard: don't reprocess already completed documents
  if (document.status === "COMPLETED") {
    console.log(`Document ${message.documentId} already processed, skipping`);
    return;
  }

  // Update status to PROCESSING
  await db.applicationDocument.update({
    where: { id: message.documentId },
    data: {
      status: "PROCESSING",
      totalChunks: null,
      processedChunks: 0,
    },
  });

  try {
    // Step 1: Fetch content
    console.log(`Fetching content for document ${message.documentId}`);
    const content = await fetchDocumentContent(document);

    if (!content || content.length === 0) {
      throw new Error("Document content is empty");
    }

    console.log(`Fetched ${content.length} characters`);

    // Step 2: Chunk the content
    console.log(`Chunking content (size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP})`);
    const chunks = chunkText(content);
    console.log(`Created ${chunks.length} chunks (after filtering low-value)`);

    if (chunks.length === 0) {
      throw new Error("No valid chunks after filtering - content may be too short or low-value");
    }

    // Update total chunks count for progress tracking
    await db.applicationDocument.update({
      where: { id: message.documentId },
      data: { totalChunks: chunks.length },
    });

    // Step 3: Delete existing chunks (in case of reprocessing)
    await db.documentChunk.deleteMany({
      where: { documentId: message.documentId },
    });

    // Step 4: Check cache for existing embeddings
    const chunkHashes = chunks.map((c) => c.chunkHash);
    const cachedEmbeddings = await getCachedEmbeddings(message.tenantId, chunkHashes);

    // Step 5: Generate embeddings with concurrency limit and progress tracking
    console.log(`Generating embeddings (concurrency=${EMBEDDING_CONCURRENCY}, delay=${EMBEDDING_DELAY_MS}ms)`);
    const limit = pLimit(EMBEDDING_CONCURRENCY);
    let processedCount = 0;

    const embeddingTasks = chunks.map((chunk) =>
      limit(async (): Promise<ChunkWithEmbedding> => {
        // Check cache first
        const cached = cachedEmbeddings.get(chunk.chunkHash);
        if (cached) {
          // Update progress
          processedCount++;
          await db.applicationDocument.update({
            where: { id: message.documentId },
            data: { processedChunks: processedCount },
          });
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

        // Update progress
        processedCount++;
        await db.applicationDocument.update({
          where: { id: message.documentId },
          data: { processedChunks: processedCount },
        });

        return { ...chunk, embedding, cached: false };
      })
    );

    const chunksWithEmbeddings = await Promise.all(embeddingTasks);

    const cachedCount = chunksWithEmbeddings.filter((c) => c.cached).length;
    const generatedCount = chunksWithEmbeddings.length - cachedCount;
    console.log(`Embeddings: ${cachedCount} cached, ${generatedCount} generated`);

    // Step 6: Batch insert chunks
    await batchInsertChunks(
      chunksWithEmbeddings,
      message.documentId,
      message.tenantId,
      message.applicationId
    );

    // Step 7: Update document status to COMPLETED
    await db.applicationDocument.update({
      where: { id: message.documentId },
      data: {
        status: "COMPLETED",
        processedChunks: chunks.length,
        processedAt: new Date(),
      },
    });

    console.log(`Document ${message.documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing document ${message.documentId}:`, error);

    // Update status to FAILED
    await db.applicationDocument.update({
      where: { id: message.documentId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
}

async function processRecord(record: SQSRecord): Promise<void> {
  const message: DocumentProcessingMessage = JSON.parse(record.body);

  if (!message.documentId || !message.tenantId || !message.applicationId) {
    console.error("Invalid message format:", message);
    return;
  }

  await processDocument(message);
}

export const handler: SQSHandler = async (event) => {
  console.log(`Received ${event.Records.length} messages`);

  // Process records sequentially to avoid rate limiting
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (error) {
      console.error("Error processing record:", error);
      // Re-throw to let SQS handle retry
      throw error;
    }
  }

  console.log("Finished processing all messages");
};
