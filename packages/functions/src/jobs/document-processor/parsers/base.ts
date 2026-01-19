/**
 * Base Parser Interface
 *
 * All document parsers implement this interface to ensure consistent behavior.
 */

import type { ParseResult, DetectedDocType, CrawlConfig } from "../types";

export interface ParserOptions {
  tenantId: string;
  applicationId: string;
  documentId: string;
  sourceUrl?: string;
  crawlConfig?: CrawlConfig;
  onProgress?: (progress: ParserProgress) => Promise<void>;
}

export interface ParserProgress {
  phase: "fetching" | "parsing" | "chunking";
  current: number;
  total: number;
  message?: string;
}

/**
 * Base parser interface that all specialized parsers must implement.
 */
export interface DocumentParser {
  /**
   * The document types this parser can handle.
   */
  readonly supportedTypes: DetectedDocType[];

  /**
   * Check if this parser can handle the given content.
   * Used for fallback detection when content-type headers are unreliable.
   */
  canParse(content: string, mimeType?: string): boolean;

  /**
   * Parse the content and return chunks with metadata.
   */
  parse(content: string, options: ParserOptions): Promise<ParseResult>;
}

/**
 * Base class providing common functionality for parsers.
 */
export abstract class BaseParser implements DocumentParser {
  abstract readonly supportedTypes: DetectedDocType[];

  abstract canParse(content: string, mimeType?: string): boolean;

  abstract parse(content: string, options: ParserOptions): Promise<ParseResult>;

  /**
   * Compute SHA-256 hash of normalized chunk content.
   * Used for deduplication - identical chunks reuse existing embeddings.
   */
  protected computeChunkHash(content: string): string {
    const crypto = require("crypto");
    const normalized = content
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
    return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
  }

  /**
   * Create a chunk data object with metadata.
   */
  protected createChunk(
    content: string,
    chunkIndex: number,
    startOffset: number,
    metadata: Partial<import("../types").ChunkMetadata>
  ): import("../types").ChunkData {
    const trimmedContent = content.trim();
    return {
      content: trimmedContent,
      chunkIndex,
      chunkHash: this.computeChunkHash(trimmedContent),
      startOffset,
      endOffset: startOffset + content.length,
      charCount: trimmedContent.length,
      metadata: {
        chunkType: metadata.chunkType || "narrative",
        ...metadata,
      },
    };
  }
}
