/**
 * Text Chunking Utilities
 *
 * Default text chunking for documents that don't have specialized parsers.
 * Tries to break at sentence boundaries for better context.
 */

import { createHash } from "crypto";
import type { ChunkData, ChunkMetadata } from "./types";

// ============================================
// CONFIGURATION
// ============================================

// Chunking configuration
export const CHUNK_SIZE = 2500;       // ~600-800 tokens
export const CHUNK_OVERLAP = 100;
export const MIN_CHUNK_SIZE = 50;     // Skip tiny chunks

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Compute SHA-256 hash of normalized chunk content.
 */
export function computeChunkHash(content: string): string {
  const normalized = content
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

// ============================================
// LOW-VALUE CONTENT DETECTION
// ============================================

/**
 * Patterns indicating low-value content to skip.
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
export function isLowValueChunk(content: string): boolean {
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

// ============================================
// TEXT CHUNKING
// ============================================

export interface ChunkOptions {
  chunkSize?: number;
  overlap?: number;
  minChunkSize?: number;
  metadata?: Partial<ChunkMetadata>;
}

/**
 * Split text into chunks with overlap.
 * Tries to break at sentence boundaries for better context.
 */
export function chunkText(
  text: string,
  options: ChunkOptions = {}
): ChunkData[] {
  const {
    chunkSize = CHUNK_SIZE,
    overlap = CHUNK_OVERLAP,
    minChunkSize = MIN_CHUNK_SIZE,
    metadata = {},
  } = options;

  const chunks: ChunkData[] = [];

  // Handle short documents
  if (text.length <= chunkSize) {
    if (!isLowValueChunk(text)) {
      chunks.push({
        content: text.trim(),
        chunkIndex: 0,
        chunkHash: computeChunkHash(text),
        startOffset: 0,
        endOffset: text.length,
        charCount: text.trim().length,
        metadata: {
          chunkType: "narrative",
          ...metadata,
        },
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
        metadata: {
          chunkType: "narrative",
          ...metadata,
        },
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
// HTML TEXT EXTRACTION
// ============================================

/**
 * Extract text from HTML, removing scripts, styles, and tags.
 */
export function extractTextFromHtml(html: string): string {
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
// MARKDOWN CHUNKING
// ============================================

/**
 * Split markdown by headers, preserving hierarchy.
 */
export function chunkMarkdown(
  markdown: string,
  options: ChunkOptions = {}
): ChunkData[] {
  const { chunkSize = CHUNK_SIZE, metadata = {} } = options;

  const chunks: ChunkData[] = [];
  let chunkIndex = 0;

  // Split by headers (##, ###, etc.)
  const sections = markdown.split(/(?=^#{1,6}\s)/m);

  for (const section of sections) {
    const trimmedSection = section.trim();
    if (!trimmedSection || isLowValueChunk(trimmedSection)) {
      continue;
    }

    // Extract header for metadata
    const headerMatch = trimmedSection.match(/^(#{1,6})\s+(.+)$/m);
    const headerLevel = headerMatch ? headerMatch[1].length : 0;
    const headerText = headerMatch ? headerMatch[2] : undefined;

    // If section is small enough, keep it as one chunk
    if (trimmedSection.length <= chunkSize) {
      chunks.push({
        content: trimmedSection,
        chunkIndex,
        chunkHash: computeChunkHash(trimmedSection),
        startOffset: 0,  // Not tracking for markdown
        endOffset: trimmedSection.length,
        charCount: trimmedSection.length,
        metadata: {
          chunkType: "narrative",
          ...metadata,
          ...(headerText && { sectionTitle: headerText, headerLevel }),
        },
      });
      chunkIndex++;
    } else {
      // Split large sections with regular chunking
      const subChunks = chunkText(trimmedSection, {
        ...options,
        metadata: {
          ...metadata,
          ...(headerText && { sectionTitle: headerText, headerLevel }),
        },
      });

      for (const subChunk of subChunks) {
        chunks.push({
          ...subChunk,
          chunkIndex,
        });
        chunkIndex++;
      }
    }
  }

  return chunks;
}
