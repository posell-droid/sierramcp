/**
 * Content Type Detector
 *
 * Automatically detects the type of API documentation from content.
 * Detection is performed in order of confidence:
 * 1. File extension (from URL or filename)
 * 2. Content-Type header
 * 3. Magic bytes (for binary formats)
 * 4. Content inspection (JSON/YAML/HTML patterns)
 */

import type { DetectedDocType, ContentDetectionResult } from "./types";

// ============================================
// DETECTION FUNCTIONS
// ============================================

/**
 * Detect document type from file extension.
 */
export function detectFromExtension(urlOrFilename: string): DetectedDocType | null {
  const ext = urlOrFilename.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "graphql":
    case "gql":
      return "graphql";
    case "md":
    case "markdown":
      return "markdown";
    case "pdf":
      return "pdf";
    case "html":
    case "htm":
      return "html";
    default:
      return null;
  }
}

/**
 * Detect document type from Content-Type header.
 */
export function detectFromMimeType(mimeType: string): DetectedDocType | null {
  const normalized = mimeType.toLowerCase().split(";")[0].trim();

  switch (normalized) {
    case "application/json":
      return "json";
    case "text/yaml":
    case "application/x-yaml":
    case "application/yaml":
      return "yaml";
    case "application/pdf":
      return "pdf";
    case "text/html":
      return "html";
    case "text/markdown":
      return "markdown";
    case "text/plain":
      return "text";
    default:
      return null;
  }
}

/**
 * Detect OpenAPI/Swagger from JSON content.
 */
function detectOpenApiFromJson(content: string): DetectedDocType | null {
  try {
    const parsed = JSON.parse(content);

    // OpenAPI 3.x
    if (parsed.openapi && typeof parsed.openapi === "string" && parsed.openapi.startsWith("3.")) {
      return "openapi3";
    }

    // Swagger 2.0
    if (parsed.swagger && parsed.swagger === "2.0") {
      return "swagger2";
    }

    // Postman Collection v2.x
    if (
      parsed.info?.schema &&
      typeof parsed.info.schema === "string" &&
      parsed.info.schema.includes("collection.json")
    ) {
      return "postman";
    }

    // GraphQL introspection response
    if (parsed.data?.__schema || parsed.__schema) {
      return "graphql";
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Detect OpenAPI/Swagger from YAML content.
 */
function detectOpenApiFromYaml(content: string): DetectedDocType | null {
  // Simple YAML parsing for openapi/swagger keys
  const lines = content.split("\n").slice(0, 20); // Check first 20 lines

  for (const line of lines) {
    const trimmed = line.trim();

    // OpenAPI 3.x
    if (trimmed.match(/^openapi:\s*["']?3\./)) {
      return "openapi3";
    }

    // Swagger 2.0
    if (trimmed.match(/^swagger:\s*["']?2\.0/)) {
      return "swagger2";
    }
  }

  return null;
}

/**
 * Detect API documentation patterns in HTML.
 */
function detectApiDocFromHtml(content: string): DetectedDocType | null {
  const lowerContent = content.toLowerCase();

  // Swagger UI
  if (
    lowerContent.includes("swagger-ui") ||
    lowerContent.includes("swagger.json") ||
    lowerContent.includes("swagger.yaml")
  ) {
    return "html-api";
  }

  // ReDoc
  if (lowerContent.includes("redoc") || lowerContent.includes("openapi-spec")) {
    return "html-api";
  }

  // API documentation indicators - patterns in HTML structure
  const apiPatterns = [
    /\/(api|docs|apidocs|api-docs|documentation)\//i,
    /<code[^>]*>.*?(GET|POST|PUT|DELETE|PATCH)\s+\//i,
    /class=["'][^"']*endpoint["']/i,
    /class=["'][^"']*api-method["']/i,
    /data-method=["'](get|post|put|delete|patch)["']/i,
  ];

  for (const pattern of apiPatterns) {
    if (pattern.test(content)) {
      return "html-api";
    }
  }

  // Count HTTP method mentions - if there are several, it's likely API docs
  const methodMatches = content.match(/\b(GET|POST|PUT|DELETE|PATCH)\b/g);
  if (methodMatches && methodMatches.length >= 3) {
    return "html-api";
  }

  // Check for common API doc table of contents / navigation patterns
  const navPatterns = [
    /href=["'][^"']*#[^"']*endpoint/i,
    /href=["'][^"']*#[^"']*method/i,
    /href=["'][^"']*\/api\//i,
    /<nav[^>]*>[\s\S]*?(endpoint|resource|api)/i,
    /<aside[^>]*>[\s\S]*?(endpoint|resource|api)/i,
  ];

  let navMatches = 0;
  for (const pattern of navPatterns) {
    if (pattern.test(content)) {
      navMatches++;
    }
  }

  if (navMatches >= 2) {
    return "html-api";
  }

  // Check for multiple internal links that look like API pages
  const apiLinkPattern = /<a[^>]+href=["'][^"']*\/(api|endpoint|method|resource|operation)[^"']*["']/gi;
  const apiLinks = content.match(apiLinkPattern);
  if (apiLinks && apiLinks.length >= 3) {
    return "html-api";
  }

  return "html";
}

/**
 * Detect GraphQL schema from content.
 */
function detectGraphqlSchema(content: string): boolean {
  // SDL patterns
  const sdlPatterns = [
    /^type\s+Query\s*\{/m,
    /^type\s+Mutation\s*\{/m,
    /^type\s+Subscription\s*\{/m,
    /^schema\s*\{/m,
    /^input\s+\w+\s*\{/m,
    /^enum\s+\w+\s*\{/m,
    /^interface\s+\w+\s*\{/m,
  ];

  return sdlPatterns.some((pattern) => pattern.test(content));
}

// ============================================
// MAIN DETECTION FUNCTION
// ============================================

/**
 * Detect the document type from content and metadata.
 *
 * @param content - The document content
 * @param options - Detection options
 * @returns Detection result with type and confidence
 */
export function detectDocumentType(
  content: string,
  options: {
    url?: string;
    filename?: string;
    mimeType?: string;
  } = {}
): ContentDetectionResult {
  const hints: string[] = [];
  let type: DetectedDocType = "text";
  let confidence = 0.5;

  // 1. Check file extension
  const source = options.url || options.filename;
  if (source) {
    const extType = detectFromExtension(source);
    if (extType) {
      hints.push(`Extension suggests ${extType}`);
      type = extType;
      confidence = 0.7;
    }
  }

  // 2. Check MIME type
  if (options.mimeType) {
    const mimeDetected = detectFromMimeType(options.mimeType);
    if (mimeDetected) {
      hints.push(`MIME type: ${options.mimeType}`);
      if (confidence < 0.8) {
        type = mimeDetected;
        confidence = 0.8;
      }
    }
  }

  // 3. Check magic bytes for PDF
  if (content.startsWith("%PDF")) {
    hints.push("PDF magic bytes detected");
    return { type: "pdf", confidence: 0.99, hints };
  }

  // 4. Content inspection
  const trimmedContent = content.trim();

  // Try JSON parsing
  if (trimmedContent.startsWith("{") || trimmedContent.startsWith("[")) {
    const jsonType = detectOpenApiFromJson(content);
    if (jsonType) {
      hints.push(`JSON content matches ${jsonType} spec`);
      return { type: jsonType, confidence: 0.95, mimeType: "application/json", hints };
    }
    hints.push("Valid JSON but no spec detected");
    type = "json";
    confidence = 0.85;
  }

  // Try YAML detection
  if (
    type === "yaml" ||
    trimmedContent.includes("openapi:") ||
    trimmedContent.includes("swagger:")
  ) {
    const yamlType = detectOpenApiFromYaml(content);
    if (yamlType) {
      hints.push(`YAML content matches ${yamlType} spec`);
      return { type: yamlType, confidence: 0.95, mimeType: "application/yaml", hints };
    }
  }

  // Check for GraphQL SDL
  if (detectGraphqlSchema(content)) {
    hints.push("GraphQL SDL patterns detected");
    return { type: "graphql", confidence: 0.9, hints };
  }

  // Check HTML
  if (trimmedContent.startsWith("<!DOCTYPE") || trimmedContent.startsWith("<html")) {
    const htmlType = detectApiDocFromHtml(content);
    hints.push(`HTML content detected${htmlType === "html-api" ? " with API patterns" : ""}`);
    return { type: htmlType || "html", confidence: 0.85, mimeType: "text/html", hints };
  }

  // Check Markdown
  if (
    type === "markdown" ||
    /^#{1,6}\s/m.test(content) ||
    /^\*\*[^*]+\*\*/m.test(content) ||
    /^```/m.test(content)
  ) {
    hints.push("Markdown patterns detected");
    type = "markdown";
    confidence = Math.max(confidence, 0.75);
  }

  return { type, confidence, mimeType: options.mimeType, hints };
}

// ============================================
// URL DETECTION FOR CRAWLING
// ============================================

/**
 * Detect if a URL should trigger crawling (nested documentation).
 */
export function shouldCrawlUrl(url: string, content: string): boolean {
  // Known nested documentation patterns
  const crawlPatterns = [
    /\/apidocs\/?$/i,
    /\/api-docs\/?$/i,
    /\/docs\/api\/?$/i,
    /\/swagger-ui\/?$/i,
    /\/redoc\/?$/i,
  ];

  if (crawlPatterns.some((pattern) => pattern.test(url))) {
    return true;
  }

  // Check if HTML has multiple internal links to API pages
  if (content.includes("<html") || content.includes("<!DOCTYPE")) {
    const apiLinkCount = (content.match(/<a[^>]+href=["'][^"']*\/(api|endpoint|method|resource)/gi) || []).length;
    return apiLinkCount >= 5;
  }

  return false;
}

/**
 * Extract the base URL for crawling from a source URL.
 */
export function extractCrawlBaseUrl(url: string): string {
  try {
    const parsed = new URL(url);
    // Keep path up to and including /api, /docs, /apidocs, etc.
    const pathMatch = parsed.pathname.match(/^(.*?\/(api|docs|apidocs|api-docs|documentation)\/?)/i);
    if (pathMatch) {
      return `${parsed.origin}${pathMatch[1]}`;
    }
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}
