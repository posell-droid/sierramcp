/**
 * Parser Registry
 *
 * Exports all available parsers and provides a function to select
 * the appropriate parser for a given document type.
 */

import type { DocumentParser } from "./base";
import type { DetectedDocType } from "../types";
import { openApiParser } from "./openapi";
import { htmlCrawlerParser } from "./html-crawler";
import { postmanParser } from "./postman";

// ============================================
// PARSER REGISTRY
// ============================================

const parsers: DocumentParser[] = [
  openApiParser,
  postmanParser,
  htmlCrawlerParser,
  // Add more parsers here as implemented:
  // graphqlParser,
  // pdfParser,
  // markdownParser,
];

/**
 * Get the appropriate parser for a detected document type.
 */
export function getParser(type: DetectedDocType): DocumentParser | null {
  for (const parser of parsers) {
    if (parser.supportedTypes.includes(type)) {
      return parser;
    }
  }
  return null;
}

/**
 * Try to find a parser that can handle the content.
 * Used when type detection is uncertain.
 */
export function findParser(content: string, mimeType?: string): DocumentParser | null {
  for (const parser of parsers) {
    if (parser.canParse(content, mimeType)) {
      return parser;
    }
  }
  return null;
}

// Re-export parsers
export { openApiParser } from "./openapi";
export { htmlCrawlerParser } from "./html-crawler";
export { postmanParser } from "./postman";
export type { DocumentParser, ParserOptions, ParserProgress } from "./base";
