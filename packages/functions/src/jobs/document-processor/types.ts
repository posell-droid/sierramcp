/**
 * Types for Smart Document Processing
 */

// ============================================
// DETECTED DOCUMENT TYPES
// ============================================

export type DetectedDocType =
  | "openapi3"
  | "swagger2"
  | "postman"
  | "graphql"
  | "html"
  | "html-api"      // HTML with API endpoint patterns
  | "markdown"
  | "pdf"
  | "yaml"
  | "json"
  | "text";

// ============================================
// CHUNK TYPES (for semantic chunking)
// ============================================

export type ChunkType =
  | "endpoint"      // API endpoint definition
  | "schema"        // Data schema/type definition
  | "narrative"     // Descriptive text
  | "example"       // Code example or sample
  | "auth"          // Authentication documentation
  | "overview";     // General overview/introduction

// ============================================
// SQS MESSAGE FORMAT
// ============================================

export interface DocumentProcessingMessage {
  documentId: string;
  tenantId: string;
  applicationId: string;
  sourceType: "URL" | "URL_CRAWL" | "UPLOAD" | "TEXT" | "OPENAPI_URL" | "POSTMAN_URL";
}

// ============================================
// CHUNK DATA STRUCTURES
// ============================================

export interface ChunkData {
  content: string;
  chunkIndex: number;
  chunkHash: string;
  startOffset: number;
  endOffset: number;
  charCount: number;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  // Common fields
  chunkType: ChunkType;
  sourceUrl?: string;
  pageNumber?: number;

  // Endpoint-specific
  httpMethod?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;

  // Schema-specific
  schemaName?: string;
  schemaType?: "object" | "array" | "enum" | "input";

  // Crawl-specific
  crawlDepth?: number;
  parentUrl?: string;
}

export interface ChunkWithEmbedding extends ChunkData {
  embedding: number[];
  cached: boolean;
}

// ============================================
// PARSER RESULT
// ============================================

export interface ParseResult {
  chunks: ChunkData[];
  detectedType: DetectedDocType;
  endpointsFound?: number;
  schemasFound?: number;
  pagesProcessed?: number;
}

// ============================================
// CRAWL CONFIGURATION
// ============================================

export interface CrawlConfig {
  maxDepth: number;
  maxPages: number;
  rateLimit: number;  // requests per second
  urlPattern?: string;
  respectRobotsTxt: boolean;
}

export const DEFAULT_CRAWL_CONFIG: CrawlConfig = {
  maxDepth: 2,
  maxPages: 500,
  rateLimit: 2,
  respectRobotsTxt: true,
};

// ============================================
// CONTENT DETECTION RESULT
// ============================================

export interface ContentDetectionResult {
  type: DetectedDocType;
  confidence: number;  // 0-1
  mimeType?: string;
  hints: string[];     // Reasons for detection
}
