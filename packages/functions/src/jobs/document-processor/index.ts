/**
 * Smart Document Processor
 *
 * Processes documents for RAG with intelligent type detection and specialized parsing.
 *
 * Pipeline:
 * 1. Receive SQS message with document info
 * 2. Fetch content (URL or S3)
 * 3. Detect document type (OpenAPI, Postman, HTML, etc.)
 * 4. Route to specialized parser for semantic chunking
 * 5. Generate embeddings with caching
 * 6. Store in PostgreSQL with pgvector
 *
 * Supported document types:
 * - OpenAPI 3.x / Swagger 2.0 (one chunk per endpoint)
 * - HTML API docs (recursive crawling)
 * - Postman Collections (one chunk per request)
 * - GraphQL Schemas (one chunk per type/operation)
 * - PDF, Markdown, plain text (intelligent chunking)
 */

import { SQSHandler, SQSRecord } from "aws-lambda";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { prisma } from "@repo/db";
import { Resource } from "sst";

import type { DocumentProcessingMessage, ChunkData, ParseResult, CrawlConfig } from "./types";
import { detectDocumentType, shouldCrawlUrl } from "./type-detector";
import { chunkText, extractTextFromHtml } from "./chunker";
import { generateEmbeddings, batchInsertChunks } from "./embeddings";
import { getParser, findParser, type ParserOptions } from "./parsers";

// ============================================
// CONFIGURATION
// ============================================

const MAX_CRAWL_PAGES = parseInt(process.env.MAX_CRAWL_PAGES || "500", 10);
const CRAWL_RATE_LIMIT = parseInt(process.env.CRAWL_RATE_LIMIT || "2", 10);
const DEFAULT_CRAWL_DEPTH = parseInt(process.env.DEFAULT_CRAWL_DEPTH || "2", 10);

// ============================================
// CLIENTS
// ============================================

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
});

// ============================================
// CONTENT FETCHING
// ============================================

interface FetchResult {
  content: string;
  mimeType?: string;
  url?: string;
}

async function fetchDocumentContent(
  document: {
    sourceType: string;
    sourceUrl: string | null;
    s3Key: string | null;
  }
): Promise<FetchResult> {
  const sourceType = document.sourceType;

  if (sourceType === "TEXT") {
    return { content: document.sourceUrl || "" };
  }

  if (
    (sourceType === "URL" || sourceType === "URL_CRAWL" || sourceType === "OPENAPI_URL" || sourceType === "POSTMAN_URL") &&
    document.sourceUrl
  ) {
    const response = await fetch(document.sourceUrl, {
      headers: {
        "User-Agent": "SierraMCP Document Processor/1.0",
        "Accept": "application/json, application/yaml, text/html, */*",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const mimeType = response.headers.get("content-type") || undefined;
    const content = await response.text();

    return { content, mimeType, url: document.sourceUrl };
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

    return {
      content: body,
      mimeType: response.ContentType,
    };
  }

  throw new Error(`Unsupported source type: ${sourceType}`);
}

// ============================================
// MAIN PROCESSING LOGIC
// ============================================

async function processDocument(message: DocumentProcessingMessage): Promise<void> {
  console.log(`Processing document: ${message.documentId}`);

  // Fetch document and check status (idempotency guard)
  const document = await prisma.applicationDocument.findUnique({
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
  await prisma.applicationDocument.update({
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
    const { content, mimeType, url } = await fetchDocumentContent(document);

    if (!content || content.length === 0) {
      throw new Error("Document content is empty");
    }

    console.log(`Fetched ${content.length} characters`);

    // Step 2: Detect document type
    const detection = detectDocumentType(content, {
      url: url || document.sourceUrl || undefined,
      mimeType,
    });

    console.log(`Detected type: ${detection.type} (confidence: ${detection.confidence})`);
    console.log(`Detection hints: ${detection.hints.join(", ")}`);

    // Update detected type
    await prisma.applicationDocument.update({
      where: { id: message.documentId },
      data: { detectedType: detection.type },
    });

    // Step 3: Get appropriate parser and process
    let chunks: ChunkData[];
    let endpointsFound = 0;
    let pagesProcessed: number | undefined;

    const parser = getParser(detection.type) || findParser(content, mimeType);

    if (parser) {
      console.log(`Using parser for: ${detection.type}`);

      // Build parser options
      const parserOptions: ParserOptions = {
        tenantId: message.tenantId,
        applicationId: message.applicationId,
        documentId: message.documentId,
        sourceUrl: url || document.sourceUrl || undefined,
        onProgress: async (progress) => {
          // Update progress in database
          if (progress.phase === "fetching") {
            await prisma.applicationDocument.update({
              where: { id: message.documentId },
              data: {
                pagesDiscovered: progress.total,
                pagesCrawled: progress.current,
              },
            });
          }
        },
      };

      // Add crawl config for HTML crawler
      if (detection.type === "html" || detection.type === "html-api") {
        // Always crawl if:
        // 1. sourceType explicitly set to URL_CRAWL
        // 2. OR detected as html-api (contains API documentation patterns)
        // 3. OR shouldCrawlUrl returns true (URL patterns or many API links)
        const shouldCrawl = document.sourceType === "URL_CRAWL" ||
          detection.type === "html-api" ||
          (url && shouldCrawlUrl(url, content));

        if (shouldCrawl) {
          console.log(`[Crawler] Enabling crawl for ${detection.type} document`);
          parserOptions.crawlConfig = {
            maxDepth: document.crawlDepth ?? DEFAULT_CRAWL_DEPTH,
            maxPages: MAX_CRAWL_PAGES,
            rateLimit: CRAWL_RATE_LIMIT,
            urlPattern: document.crawlPattern || undefined,
            respectRobotsTxt: false,  // User explicitly wants to index this
          };
        }
      }

      // Parse with specialized parser
      const result: ParseResult = await parser.parse(content, parserOptions);

      chunks = result.chunks;
      endpointsFound = result.endpointsFound || 0;
      pagesProcessed = result.pagesProcessed;

      console.log(`Parser extracted ${chunks.length} chunks, ${endpointsFound} endpoints`);
    } else {
      // Fall back to default text chunking
      console.log("No specialized parser, using default text chunking");

      // Handle HTML
      let textContent = content;
      if (detection.type === "html" || mimeType?.includes("text/html")) {
        textContent = extractTextFromHtml(content);
      }

      chunks = chunkText(textContent, {
        metadata: {
          chunkType: "narrative",
          sourceUrl: url || document.sourceUrl || undefined,
        },
      });
    }

    if (chunks.length === 0) {
      throw new Error("No valid chunks after processing - content may be too short or low-value");
    }

    // Update total chunks count and endpoints
    await prisma.applicationDocument.update({
      where: { id: message.documentId },
      data: {
        totalChunks: chunks.length,
        endpointsFound: endpointsFound > 0 ? endpointsFound : null,
        pagesCrawled: pagesProcessed,
      },
    });

    // Step 4: Delete existing chunks (in case of reprocessing)
    await prisma.documentChunk.deleteMany({
      where: { documentId: message.documentId },
    });

    // Step 5: Generate embeddings with caching and progress tracking
    console.log(`Generating embeddings for ${chunks.length} chunks`);

    const chunksWithEmbeddings = await generateEmbeddings(
      chunks,
      message.tenantId,
      async (processed, total) => {
        // Update progress
        await prisma.applicationDocument.update({
          where: { id: message.documentId },
          data: { processedChunks: processed },
        });
      }
    );

    // Step 6: Batch insert chunks
    await batchInsertChunks(
      chunksWithEmbeddings,
      message.documentId,
      message.tenantId,
      message.applicationId
    );

    // Step 7: Update document status to COMPLETED
    await prisma.applicationDocument.update({
      where: { id: message.documentId },
      data: {
        status: "COMPLETED",
        processedChunks: chunks.length,
        processedAt: new Date(),
      },
    });

    console.log(`Document ${message.documentId} processed successfully: ${chunks.length} chunks, ${endpointsFound} endpoints`);
  } catch (error) {
    console.error(`Error processing document ${message.documentId}:`, error);

    // Update status to FAILED
    await prisma.applicationDocument.update({
      where: { id: message.documentId },
      data: {
        status: "FAILED",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });

    throw error;
  }
}

// ============================================
// SQS HANDLER
// ============================================

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
