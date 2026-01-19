/**
 * Postman Collection Parser
 *
 * Parses Postman Collection v2.x format into semantic chunks.
 * Creates one chunk per request with full context.
 */

import { BaseParser, type ParserOptions } from "./base";
import type { ParseResult, ChunkData, DetectedDocType } from "../types";

// ============================================
// TYPES (Postman Collection v2.1)
// ============================================

interface PostmanCollection {
  info: {
    name: string;
    description?: string;
    schema: string;
  };
  item: PostmanItem[];
  variable?: PostmanVariable[];
  auth?: PostmanAuth;
}

interface PostmanItem {
  name: string;
  description?: string;
  item?: PostmanItem[];  // Nested folders
  request?: PostmanRequest;
  response?: PostmanResponse[];
}

interface PostmanRequest {
  method: string;
  url: PostmanUrl | string;
  header?: PostmanHeader[];
  body?: PostmanBody;
  description?: string;
  auth?: PostmanAuth;
}

interface PostmanUrl {
  raw?: string;
  protocol?: string;
  host?: string[];
  path?: string[];
  query?: PostmanQueryParam[];
  variable?: PostmanVariable[];
}

interface PostmanHeader {
  key: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanQueryParam {
  key: string;
  value?: string;
  description?: string;
  disabled?: boolean;
}

interface PostmanBody {
  mode?: "raw" | "urlencoded" | "formdata" | "file" | "graphql";
  raw?: string;
  urlencoded?: Array<{ key: string; value: string; description?: string }>;
  formdata?: Array<{ key: string; value: string; type?: string; description?: string }>;
  graphql?: { query?: string; variables?: string };
  options?: { raw?: { language?: string } };
}

interface PostmanResponse {
  name: string;
  status?: string;
  code?: number;
  body?: string;
  header?: PostmanHeader[];
}

interface PostmanVariable {
  key: string;
  value?: string;
  description?: string;
}

interface PostmanAuth {
  type: string;
  [key: string]: unknown;
}

// ============================================
// POSTMAN PARSER
// ============================================

export class PostmanParser extends BaseParser {
  readonly supportedTypes: DetectedDocType[] = ["postman"];

  canParse(content: string, mimeType?: string): boolean {
    try {
      const parsed = JSON.parse(content);
      return (
        parsed.info?.schema &&
        typeof parsed.info.schema === "string" &&
        parsed.info.schema.includes("collection.json") &&
        Array.isArray(parsed.item)
      );
    } catch {
      return false;
    }
  }

  async parse(content: string, options: ParserOptions): Promise<ParseResult> {
    const collection: PostmanCollection = JSON.parse(content);
    const chunks: ChunkData[] = [];
    let chunkIndex = 0;
    let endpointsFound = 0;

    // 1. Create overview chunk
    const overviewChunk = this.createOverviewChunk(collection, options, chunkIndex++);
    if (overviewChunk) {
      chunks.push(overviewChunk);
    }

    // 2. Process all items (recursively for folders)
    const processItems = (items: PostmanItem[], folderPath: string[] = []): void => {
      for (const item of items) {
        if (item.item) {
          // This is a folder - recurse
          processItems(item.item, [...folderPath, item.name]);
        } else if (item.request) {
          // This is a request
          const requestChunk = this.createRequestChunk(
            item,
            folderPath,
            collection,
            options,
            chunkIndex++
          );
          chunks.push(requestChunk);
          endpointsFound++;
        }
      }
    };

    processItems(collection.item);

    // 3. Create variables chunk if collection has variables
    if (collection.variable && collection.variable.length > 0) {
      const varsChunk = this.createVariablesChunk(collection, options, chunkIndex++);
      if (varsChunk) {
        chunks.push(varsChunk);
      }
    }

    return {
      chunks,
      detectedType: "postman",
      endpointsFound,
    };
  }

  // ============================================
  // CHUNK CREATION METHODS
  // ============================================

  private createOverviewChunk(
    collection: PostmanCollection,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData | null {
    const parts: string[] = [];

    parts.push(`# Postman Collection: ${collection.info.name}`);

    if (collection.info.description) {
      parts.push("");
      parts.push(collection.info.description);
    }

    // Count requests
    const countRequests = (items: PostmanItem[]): number => {
      let count = 0;
      for (const item of items) {
        if (item.item) {
          count += countRequests(item.item);
        } else if (item.request) {
          count++;
        }
      }
      return count;
    };

    const requestCount = countRequests(collection.item);
    parts.push("");
    parts.push(`Total Requests: ${requestCount}`);

    // List folders
    const folders = collection.item.filter(item => item.item);
    if (folders.length > 0) {
      parts.push("");
      parts.push("## Folders");
      for (const folder of folders) {
        const subCount = folder.item ? countRequests(folder.item) : 0;
        parts.push(`- ${folder.name} (${subCount} requests)`);
      }
    }

    // Auth info
    if (collection.auth) {
      parts.push("");
      parts.push(`## Authentication`);
      parts.push(`Type: ${collection.auth.type}`);
    }

    const content = parts.join("\n");
    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "overview",
      sourceUrl: options.sourceUrl,
    });
  }

  private createRequestChunk(
    item: PostmanItem,
    folderPath: string[],
    collection: PostmanCollection,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData {
    const request = item.request!;
    const parts: string[] = [];

    // Extract URL
    const url = this.formatUrl(request.url);
    const method = request.method.toUpperCase();

    // Header
    parts.push(`# ${method} ${item.name}`);
    if (folderPath.length > 0) {
      parts.push(`Folder: ${folderPath.join(" / ")}`);
    }

    // URL
    parts.push("");
    parts.push(`**URL:** \`${url}\``);

    // Description
    if (item.description || request.description) {
      parts.push("");
      parts.push(item.description || request.description || "");
    }

    // Headers
    const headers = request.header?.filter(h => !h.disabled);
    if (headers && headers.length > 0) {
      parts.push("");
      parts.push("## Headers");
      for (const header of headers) {
        parts.push(`- \`${header.key}\`: ${header.value}${header.description ? ` - ${header.description}` : ""}`);
      }
    }

    // Query Parameters
    if (typeof request.url === "object" && request.url.query) {
      const params = request.url.query.filter(q => !q.disabled);
      if (params.length > 0) {
        parts.push("");
        parts.push("## Query Parameters");
        for (const param of params) {
          parts.push(`- \`${param.key}\`: ${param.value || ""}${param.description ? ` - ${param.description}` : ""}`);
        }
      }
    }

    // Path Variables
    if (typeof request.url === "object" && request.url.variable) {
      const vars = request.url.variable;
      if (vars.length > 0) {
        parts.push("");
        parts.push("## Path Variables");
        for (const v of vars) {
          parts.push(`- \`${v.key}\`: ${v.value || ""}${v.description ? ` - ${v.description}` : ""}`);
        }
      }
    }

    // Request Body
    if (request.body) {
      parts.push("");
      parts.push("## Request Body");
      parts.push(this.formatBody(request.body));
    }

    // Example Responses
    if (item.response && item.response.length > 0) {
      parts.push("");
      parts.push("## Example Responses");
      for (const response of item.response.slice(0, 3)) { // Limit to 3 examples
        parts.push(`### ${response.name} (${response.code || response.status || "N/A"})`);
        if (response.body) {
          parts.push("```json");
          // Truncate large responses
          const body = response.body.length > 1000
            ? response.body.substring(0, 1000) + "\n... (truncated)"
            : response.body;
          parts.push(body);
          parts.push("```");
        }
      }
    }

    const content = parts.join("\n");

    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "endpoint",
      httpMethod: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      path: this.extractPath(request.url),
      sourceUrl: options.sourceUrl,
    });
  }

  private createVariablesChunk(
    collection: PostmanCollection,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData | null {
    if (!collection.variable || collection.variable.length === 0) {
      return null;
    }

    const parts: string[] = [];
    parts.push("# Collection Variables");
    parts.push("");

    for (const v of collection.variable) {
      const desc = v.description ? ` - ${v.description}` : "";
      parts.push(`- \`{{${v.key}}}\`: ${v.value || "(empty)"}${desc}`);
    }

    const content = parts.join("\n");
    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "auth",
      sourceUrl: options.sourceUrl,
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private formatUrl(url: PostmanUrl | string): string {
    if (typeof url === "string") {
      return url;
    }
    return url.raw || this.buildUrl(url);
  }

  private buildUrl(url: PostmanUrl): string {
    const protocol = url.protocol || "https";
    const host = url.host?.join(".") || "{{host}}";
    const path = url.path?.join("/") || "";
    return `${protocol}://${host}/${path}`;
  }

  private extractPath(url: PostmanUrl | string): string {
    if (typeof url === "string") {
      try {
        return new URL(url).pathname;
      } catch {
        return url;
      }
    }
    return "/" + (url.path?.join("/") || "");
  }

  private formatBody(body: PostmanBody): string {
    const parts: string[] = [];

    if (body.mode) {
      parts.push(`Mode: ${body.mode}`);
    }

    if (body.mode === "raw" && body.raw) {
      const language = body.options?.raw?.language || "json";
      parts.push(`\`\`\`${language}`);
      // Truncate large bodies
      const rawBody = body.raw.length > 2000
        ? body.raw.substring(0, 2000) + "\n... (truncated)"
        : body.raw;
      parts.push(rawBody);
      parts.push("```");
    }

    if (body.mode === "urlencoded" && body.urlencoded) {
      parts.push("| Key | Value |");
      parts.push("|-----|-------|");
      for (const param of body.urlencoded) {
        parts.push(`| ${param.key} | ${param.value} |`);
      }
    }

    if (body.mode === "formdata" && body.formdata) {
      parts.push("| Key | Value | Type |");
      parts.push("|-----|-------|------|");
      for (const param of body.formdata) {
        parts.push(`| ${param.key} | ${param.value} | ${param.type || "text"} |`);
      }
    }

    if (body.mode === "graphql" && body.graphql) {
      parts.push("```graphql");
      parts.push(body.graphql.query || "");
      parts.push("```");
      if (body.graphql.variables) {
        parts.push("Variables:");
        parts.push("```json");
        parts.push(body.graphql.variables);
        parts.push("```");
      }
    }

    return parts.join("\n");
  }
}

// Export singleton instance
export const postmanParser = new PostmanParser();
