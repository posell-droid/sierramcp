/**
 * HTML Crawler Parser
 *
 * Recursively crawls HTML documentation to extract API endpoint information.
 * Features:
 * - Breadth-first crawl with configurable depth
 * - Rate limiting to avoid overwhelming servers
 * - robots.txt respect
 * - Deduplication of URLs
 * - Progress tracking
 */

import { BaseParser, type ParserOptions, type ParserProgress } from "./base";
import type { ParseResult, ChunkData, DetectedDocType, CrawlConfig, DEFAULT_CRAWL_CONFIG } from "../types";
import { extractTextFromHtml, chunkText } from "../chunker";
import { openApiParser } from "./openapi";

// ============================================
// CONFIGURATION
// ============================================

const DEFAULT_CONFIG: CrawlConfig = {
  maxDepth: 2,
  maxPages: 500,
  rateLimit: 2,  // requests per second
  respectRobotsTxt: false,  // User explicitly wants to index this documentation
};

// ============================================
// TYPES
// ============================================

interface CrawlPage {
  url: string;
  depth: number;
  parentUrl?: string;
}

interface CrawledContent {
  url: string;
  content: string;
  title?: string;
  links: string[];
}

// ============================================
// HTML CRAWLER PARSER
// ============================================

export class HtmlCrawlerParser extends BaseParser {
  readonly supportedTypes: DetectedDocType[] = ["html", "html-api"];

  private visitedUrls = new Set<string>();
  private robotsCache = new Map<string, Set<string>>();

  canParse(content: string, mimeType?: string): boolean {
    if (mimeType?.includes("text/html")) {
      return true;
    }
    return content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html");
  }

  async parse(content: string, options: ParserOptions): Promise<ParseResult> {
    const config: CrawlConfig = {
      ...DEFAULT_CONFIG,
      ...options.crawlConfig,
    };

    this.visitedUrls.clear();

    const chunks: ChunkData[] = [];
    let chunkIndex = 0;
    let endpointsFound = 0;
    let pagesProcessed = 0;

    // If no source URL, just parse the content directly
    if (!options.sourceUrl) {
      const textChunks = this.extractChunksFromHtml(content, options, chunkIndex);
      return {
        chunks: textChunks,
        detectedType: "html",
        pagesProcessed: 1,
      };
    }

    const baseUrl = this.extractBaseUrl(options.sourceUrl);

    // Initialize crawl queue with the source URL
    const queue: CrawlPage[] = [{ url: options.sourceUrl, depth: 0 }];
    this.visitedUrls.add(this.normalizeUrl(options.sourceUrl));

    // Fetch and parse robots.txt if configured
    if (config.respectRobotsTxt) {
      await this.loadRobotsTxt(baseUrl);
    }

    // Process initial content first
    console.log(`[Crawler] Base URL: ${baseUrl}`);
    console.log(`[Crawler] Source URL: ${options.sourceUrl}`);
    console.log(`[Crawler] Config: maxDepth=${config.maxDepth}, maxPages=${config.maxPages}`);

    const initialLinks = this.extractLinks(content, options.sourceUrl, baseUrl, config.urlPattern);
    console.log(`[Crawler] Found ${initialLinks.length} links on initial page`);
    if (initialLinks.length > 0) {
      console.log(`[Crawler] Sample links: ${initialLinks.slice(0, 5).join(", ")}`);
    }

    const initialChunks = this.extractChunksFromHtml(content, options, chunkIndex, options.sourceUrl, 0);

    chunks.push(...initialChunks);
    chunkIndex += initialChunks.length;
    endpointsFound += this.countEndpoints(content);
    pagesProcessed++;

    // Add discovered links to queue
    for (const link of initialLinks) {
      const normalizedLink = this.normalizeUrl(link);
      if (!this.visitedUrls.has(normalizedLink)) {
        this.visitedUrls.add(normalizedLink);
        queue.push({ url: link, depth: 1, parentUrl: options.sourceUrl });
      }
    }

    console.log(`[Crawler] Queue size after initial: ${queue.length}`);

    // Report initial progress
    if (options.onProgress) {
      await options.onProgress({
        phase: "fetching",
        current: pagesProcessed,
        total: queue.length + pagesProcessed,
        message: `Discovered ${initialLinks.length} links`,
      });
    }

    // Breadth-first crawl
    console.log(`[Crawler] Starting crawl loop, queue size: ${queue.length}`);
    while (queue.length > 0 && pagesProcessed < config.maxPages) {
      const page = queue.shift()!;
      console.log(`[Crawler] Processing: ${page.url} (depth ${page.depth})`);

      // Skip if beyond max depth
      if (page.depth > config.maxDepth) {
        console.log(`[Crawler] Skipping: depth ${page.depth} > max ${config.maxDepth}`);
        continue;
      }

      // Skip if already visited (source URL is pre-added)
      if (this.visitedUrls.has(this.normalizeUrl(page.url)) && page.depth === 0) {
        console.log(`[Crawler] Skipping: already processed initial page`);
        continue;
      }

      // Skip if blocked by robots.txt
      if (config.respectRobotsTxt && this.isBlockedByRobots(page.url)) {
        console.log(`[Crawler] Skipping: blocked by robots.txt`);
        continue;
      }

      try {
        // Rate limiting
        await this.sleep(1000 / config.rateLimit);

        // Fetch page
        const response = await fetch(page.url, {
          headers: {
            "User-Agent": "SierraMCP Document Crawler/1.0",
          },
        });

        if (!response.ok) {
          console.log(`[Crawler] Skip ${page.url}: ${response.status}`);
          continue;
        }

        const contentType = response.headers.get("content-type") || "";
        const responseText = await response.text();
        pagesProcessed++;

        let pageChunks: ChunkData[] = [];
        let pageEndpoints = 0;

        // Handle JSON content - check if it's an OpenAPI spec
        if (contentType.includes("application/json") || contentType.includes("text/json")) {
          try {
            const jsonData = JSON.parse(responseText);

            // Check if this is an OpenAPI/Swagger spec
            if (jsonData.openapi || jsonData.swagger) {
              console.log(`[Crawler] Found OpenAPI spec at ${page.url}`);

              const openApiResult = await openApiParser.parse(responseText, {
                ...options,
                sourceUrl: page.url,
              });

              // Re-index chunks starting from current chunkIndex
              pageChunks = openApiResult.chunks.map((chunk, i) => ({
                ...chunk,
                chunkIndex: chunkIndex + i,
              }));
              pageEndpoints = openApiResult.endpointsFound || 0;
            } else {
              // Generic JSON - create a single chunk with the structure
              console.log(`[Crawler] Found JSON at ${page.url} (not OpenAPI)`);
              const jsonStr = JSON.stringify(jsonData, null, 2);
              if (jsonStr.length > 100) {
                pageChunks = [this.createChunk(
                  `JSON Document from ${page.url}:\n\`\`\`json\n${jsonStr.slice(0, 10000)}\n\`\`\``,
                  chunkIndex,
                  0,
                  {
                    chunkType: "narrative",
                    sourceUrl: page.url,
                    crawlDepth: page.depth,
                  }
                )];
              }
            }
          } catch (parseError) {
            console.log(`[Crawler] Failed to parse JSON at ${page.url}:`, parseError);
          }
        } else if (contentType.includes("text/html") || responseText.trim().startsWith("<!DOCTYPE") || responseText.trim().startsWith("<html")) {
          // HTML content - but skip Swagger UI wrapper pages that have no real content
          if (this.isSwaggerUiWrapper(responseText)) {
            console.log(`[Crawler] Skip ${page.url}: Swagger UI wrapper (no content without JS)`);
            // Don't extract chunks or links from these pages
          } else {
            pageChunks = this.extractChunksFromHtml(
              responseText,
              options,
              chunkIndex,
              page.url,
              page.depth
            );
            pageEndpoints = this.countEndpoints(responseText);
          }
        } else if (contentType.includes("application/yaml") || contentType.includes("text/yaml") || contentType.includes("text/x-yaml")) {
          // YAML content - could be OpenAPI
          try {
            if (responseText.includes("openapi:") || responseText.includes("swagger:")) {
              console.log(`[Crawler] Found YAML OpenAPI spec at ${page.url}`);

              const openApiResult = await openApiParser.parse(responseText, {
                ...options,
                sourceUrl: page.url,
              });

              pageChunks = openApiResult.chunks.map((chunk, i) => ({
                ...chunk,
                chunkIndex: chunkIndex + i,
              }));
              pageEndpoints = openApiResult.endpointsFound || 0;
            } else {
              // Generic YAML
              console.log(`[Crawler] Found YAML at ${page.url} (not OpenAPI)`);
              if (responseText.length > 100) {
                pageChunks = [this.createChunk(
                  `YAML Document from ${page.url}:\n\`\`\`yaml\n${responseText.slice(0, 10000)}\n\`\`\``,
                  chunkIndex,
                  0,
                  {
                    chunkType: "narrative",
                    sourceUrl: page.url,
                    crawlDepth: page.depth,
                  }
                )];
              }
            }
          } catch (parseError) {
            console.log(`[Crawler] Failed to parse YAML at ${page.url}:`, parseError);
          }
        } else {
          console.log(`[Crawler] Skip ${page.url}: unsupported content type (${contentType})`);
          // Don't continue - fall through to report progress
        }

        chunks.push(...pageChunks);
        chunkIndex += pageChunks.length;
        endpointsFound += pageEndpoints;

        // Extract and queue new links (only from HTML content)
        const isHtmlContent = contentType.includes("text/html") ||
          responseText.trim().startsWith("<!DOCTYPE") ||
          responseText.trim().startsWith("<html");
        const links = isHtmlContent
          ? this.extractLinks(responseText, page.url, baseUrl, config.urlPattern)
          : [];
        for (const link of links) {
          const normalizedLink = this.normalizeUrl(link);
          if (!this.visitedUrls.has(normalizedLink)) {
            this.visitedUrls.add(normalizedLink);
            queue.push({ url: link, depth: page.depth + 1, parentUrl: page.url });
          }
        }

        // Report progress
        if (options.onProgress) {
          await options.onProgress({
            phase: "fetching",
            current: pagesProcessed,
            total: Math.min(queue.length + pagesProcessed, config.maxPages),
            message: `Processing ${page.url}`,
          });
        }
      } catch (error) {
        console.error(`[Crawler] Error fetching ${page.url}:`, error);
      }
    }

    console.log(`[Crawler] Completed: ${pagesProcessed} pages, ${chunks.length} chunks, ${endpointsFound} endpoints`);

    return {
      chunks,
      detectedType: "html-api",
      endpointsFound,
      pagesProcessed,
    };
  }

  // ============================================
  // CONTENT EXTRACTION
  // ============================================

  private extractChunksFromHtml(
    html: string,
    options: ParserOptions,
    startIndex: number,
    sourceUrl?: string,
    crawlDepth?: number
  ): ChunkData[] {
    // Try to extract API endpoint information
    const endpointChunks = this.extractEndpointChunks(html, options, startIndex, sourceUrl, crawlDepth);

    if (endpointChunks.length > 0) {
      return endpointChunks;
    }

    // Fall back to text extraction
    const text = extractTextFromHtml(html);

    if (!text || text.length < 100) {
      return [];
    }

    const textChunks = chunkText(text, {
      metadata: {
        chunkType: "narrative",
        sourceUrl,
        crawlDepth,
      },
    });

    // Reindex chunks
    return textChunks.map((chunk, i) => ({
      ...chunk,
      chunkIndex: startIndex + i,
    }));
  }

  private extractEndpointChunks(
    html: string,
    options: ParserOptions,
    startIndex: number,
    sourceUrl?: string,
    crawlDepth?: number
  ): ChunkData[] {
    const chunks: ChunkData[] = [];

    // Pattern 1: Xytech-style API documentation listing
    // <div class='opblock'><a ... href='...'>Endpoint Name</a> (Type)</div>
    const xytechPattern = /<div[^>]*class=['"]opblock['"][^>]*>[\s\S]*?<a[^>]*href=['"]([^'"]+)['"][^>]*>([^<]+)<\/a>\s*\(([^)]+)\)/gi;
    let xytechMatch;
    const xytechEndpoints: Array<{url: string; name: string; type: string}> = [];

    while ((xytechMatch = xytechPattern.exec(html)) !== null) {
      xytechEndpoints.push({
        url: xytechMatch[1],
        name: xytechMatch[2].trim(),
        type: xytechMatch[3].trim(),
      });
    }

    if (xytechEndpoints.length > 0) {
      console.log(`[Crawler] Found ${xytechEndpoints.length} Xytech-style API endpoints`);

      // Group endpoints by type for better organization
      const byType: Record<string, typeof xytechEndpoints> = {};
      for (const ep of xytechEndpoints) {
        if (!byType[ep.type]) byType[ep.type] = [];
        byType[ep.type].push(ep);
      }

      // Create chunks - one per endpoint for better RAG retrieval
      for (const ep of xytechEndpoints) {
        // Extract the API path from URL
        const urlMatch = ep.url.match(/\/spec\/([^?#]+)/);
        const apiName = urlMatch?.[1] || ep.name;

        const content = `API Endpoint: ${ep.name}
Type: ${ep.type}
API Name: ${apiName}
Spec URL: ${ep.url}

This is a ${ep.type.toLowerCase()} endpoint in the Xytech API. Use this endpoint to work with ${ep.name.toLowerCase()} data.`;

        chunks.push(
          this.createChunk(content, startIndex + chunks.length, 0, {
            chunkType: "endpoint",
            path: `/api/${apiName}`,
            sourceUrl,
            crawlDepth,
            tags: [ep.type],
          })
        );
      }

      return chunks;
    }

    // Pattern 2: Common API documentation patterns (fallback)
    const patterns = [
      // Swagger UI style
      /<div[^>]*class="[^"]*opblock[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
      // Method + path pattern
      /<(?:span|div|code)[^>]*class="[^"]*method[^"]*"[^>]*>[\s\S]*?<\/(?:span|div|code)>/gi,
      // API endpoint sections
      /<section[^>]*(?:id|class)="[^"]*(?:endpoint|operation|method)[^"]*"[^>]*>[\s\S]*?<\/section>/gi,
    ];

    for (const pattern of patterns) {
      const matches = html.match(pattern);
      if (matches && matches.length > 0) {
        for (const match of matches) {
          const text = extractTextFromHtml(match);
          if (text.length > 50) {
            // Try to extract method and path
            const methodMatch = text.match(/\b(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/i);
            const pathMatch = text.match(/\/(api|v\d+)?\/[\w\-\/\{\}]+/);

            chunks.push(
              this.createChunk(text, startIndex + chunks.length, 0, {
                chunkType: "endpoint",
                httpMethod: methodMatch?.[1]?.toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | undefined,
                path: pathMatch?.[0],
                sourceUrl,
                crawlDepth,
              })
            );
          }
        }
        break; // Use first pattern that matches
      }
    }

    return chunks;
  }

  private countEndpoints(html: string): number {
    // Count Xytech-style API endpoints
    const xytechPattern = /<div[^>]*class=['"]opblock['"][^>]*>[\s\S]*?<a[^>]*href=['"][^'"]+['"][^>]*>[^<]+<\/a>\s*\([^)]+\)/gi;
    const xytechMatches = html.match(xytechPattern);
    if (xytechMatches && xytechMatches.length > 0) {
      return xytechMatches.length;
    }

    // Fallback: Count HTTP method indicators
    const methodPattern = /\b(GET|POST|PUT|PATCH|DELETE)\s+\//gi;
    const matches = html.match(methodPattern);
    return matches?.length || 0;
  }

  private isSwaggerUiWrapper(html: string): boolean {
    // Detect Swagger UI pages that just load content via JavaScript
    // These have SwaggerUIBundle but no actual API content
    return (
      html.includes("SwaggerUIBundle") &&
      html.includes("swagger-ui") &&
      !html.includes("opblock-summary") // Real Swagger UI pages have rendered content
    );
  }

  // ============================================
  // LINK EXTRACTION
  // ============================================

  private extractLinks(
    html: string,
    currentUrl: string,
    baseUrl: string,
    urlPattern?: string
  ): string[] {
    const links: string[] = [];
    const rejectedReasons: Record<string, number> = {};

    // Extract href attributes - match both single and double quotes
    const hrefPattern = /<a[^>]+href=["']([^"']+)["']/gi;
    let match;
    let totalLinks = 0;

    while ((match = hrefPattern.exec(html)) !== null) {
      const href = match[1];
      totalLinks++;

      // Skip pure fragments
      if (href.startsWith("#")) {
        rejectedReasons["fragment"] = (rejectedReasons["fragment"] || 0) + 1;
        continue;
      }

      // Resolve relative URLs
      let absoluteUrl: string;
      try {
        absoluteUrl = new URL(href, currentUrl).href;
      } catch {
        rejectedReasons["invalid_url"] = (rejectedReasons["invalid_url"] || 0) + 1;
        continue;
      }

      // Filter URLs
      const includeResult = this.shouldIncludeUrlWithReason(absoluteUrl, baseUrl, urlPattern);
      if (includeResult.include) {
        links.push(absoluteUrl);
      } else {
        rejectedReasons[includeResult.reason] = (rejectedReasons[includeResult.reason] || 0) + 1;
      }
    }

    console.log(`[Crawler] Link extraction: ${totalLinks} total, ${links.length} accepted`);
    console.log(`[Crawler] Rejected reasons: ${JSON.stringify(rejectedReasons)}`);

    return [...new Set(links)]; // Deduplicate
  }

  private shouldIncludeUrlWithReason(url: string, baseUrl: string, urlPattern?: string): { include: boolean; reason: string } {
    try {
      const parsed = new URL(url);
      const baseParsed = new URL(baseUrl);

      // Must be same domain (case-insensitive)
      if (parsed.host.toLowerCase() !== baseParsed.host.toLowerCase()) {
        return { include: false, reason: "different_host" };
      }

      // Skip static files
      if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|pdf|zip|tar|gz)$/i.test(parsed.pathname)) {
        return { include: false, reason: "static_file" };
      }

      // Check custom pattern if provided
      if (urlPattern) {
        const regex = new RegExp(urlPattern.replace(/\*/g, ".*"));
        if (!regex.test(parsed.pathname)) {
          return { include: false, reason: "custom_pattern_mismatch" };
        }
      }

      // Same domain + not static = allow
      return { include: true, reason: "ok" };
    } catch {
      return { include: false, reason: "url_parse_error" };
    }
  }

  private shouldIncludeUrl(url: string, baseUrl: string, urlPattern?: string): boolean {
    return this.shouldIncludeUrlWithReason(url, baseUrl, urlPattern).include;
  }

  // ============================================
  // URL UTILITIES
  // ============================================

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slash, fragments, and normalize query params
      let normalized = `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
      if (parsed.search) {
        normalized += parsed.search;
      }
      return normalized.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private extractBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);

      // Use the full path from the source URL as the base
      // This ensures we crawl pages under /APIdocs, not just /API
      let basePath = parsed.pathname;

      // Remove trailing slash for consistent comparison
      basePath = basePath.replace(/\/$/, "");

      // If path ends with a file-like segment (has extension), use parent directory
      if (/\.[a-z0-9]+$/i.test(basePath)) {
        const lastSlash = basePath.lastIndexOf("/");
        basePath = basePath.substring(0, lastSlash) || "/";
      }

      return `${parsed.origin}${basePath}`;
    } catch {
      return url;
    }
  }

  // ============================================
  // ROBOTS.TXT
  // ============================================

  private async loadRobotsTxt(baseUrl: string): Promise<void> {
    try {
      const parsed = new URL(baseUrl);
      const robotsUrl = `${parsed.origin}/robots.txt`;

      if (this.robotsCache.has(parsed.origin)) {
        return;
      }

      const response = await fetch(robotsUrl);
      if (!response.ok) {
        this.robotsCache.set(parsed.origin, new Set());
        return;
      }

      const text = await response.text();
      const disallowed = new Set<string>();

      // Simple robots.txt parsing
      const lines = text.split("\n");
      let isUserAgentMatch = false;

      for (const line of lines) {
        const trimmed = line.trim().toLowerCase();

        if (trimmed.startsWith("user-agent:")) {
          const agent = trimmed.substring(11).trim();
          isUserAgentMatch = agent === "*" || agent.includes("bot");
        } else if (isUserAgentMatch && trimmed.startsWith("disallow:")) {
          const path = trimmed.substring(9).trim();
          if (path) {
            disallowed.add(path);
          }
        }
      }

      this.robotsCache.set(parsed.origin, disallowed);
    } catch {
      // Ignore robots.txt errors
    }
  }

  private isBlockedByRobots(url: string): boolean {
    try {
      const parsed = new URL(url);
      const disallowed = this.robotsCache.get(parsed.origin);

      if (!disallowed || disallowed.size === 0) {
        return false;
      }

      for (const path of disallowed) {
        if (parsed.pathname.startsWith(path)) {
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  // ============================================
  // UTILITIES
  // ============================================

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const htmlCrawlerParser = new HtmlCrawlerParser();
