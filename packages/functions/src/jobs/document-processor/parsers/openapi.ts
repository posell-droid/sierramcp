/**
 * OpenAPI/Swagger Parser
 *
 * Parses OpenAPI 3.x and Swagger 2.0 specifications into semantic chunks.
 * Creates one chunk per endpoint with full context for optimal RAG retrieval.
 */

import { BaseParser, type ParserOptions } from "./base";
import type { ParseResult, ChunkData, DetectedDocType } from "../types";

// ============================================
// TYPES
// ============================================

interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    description?: string;
    version?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  host?: string; // Swagger 2.0
  basePath?: string; // Swagger 2.0
  paths?: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  definitions?: Record<string, SchemaObject>; // Swagger 2.0
  securityDefinitions?: Record<string, SecurityScheme>; // Swagger 2.0
}

interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  parameters?: Parameter[];
}

interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  deprecated?: boolean;
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, Response>;
  security?: Array<Record<string, string[]>>;
}

interface Parameter {
  name: string;
  in: "query" | "header" | "path" | "cookie" | "body"; // body is Swagger 2.0
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
  type?: string; // Swagger 2.0
}

interface RequestBody {
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
}

interface MediaType {
  schema?: SchemaObject;
  example?: unknown;
}

interface Response {
  description?: string;
  content?: Record<string, MediaType>;
  schema?: SchemaObject; // Swagger 2.0
}

interface SchemaObject {
  type?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  description?: string;
  enum?: string[];
  example?: unknown;
  $ref?: string;
}

interface SecurityScheme {
  type: string;
  description?: string;
  name?: string;
  in?: string;
  scheme?: string;
  flows?: unknown;
}

// ============================================
// OPENAPI PARSER
// ============================================

export class OpenApiParser extends BaseParser {
  readonly supportedTypes: DetectedDocType[] = ["openapi3", "swagger2"];

  canParse(content: string, mimeType?: string): boolean {
    try {
      const parsed = JSON.parse(content);
      return (
        (parsed.openapi && parsed.openapi.startsWith("3.")) ||
        parsed.swagger === "2.0"
      );
    } catch {
      // Try YAML detection
      return (
        content.includes("openapi:") && content.includes("3.") ||
        content.includes("swagger:") && content.includes("2.0")
      );
    }
  }

  async parse(content: string, options: ParserOptions): Promise<ParseResult> {
    let spec: OpenApiSpec;

    // Parse JSON or YAML
    try {
      spec = JSON.parse(content);
    } catch {
      // Try YAML parsing
      const yaml = await import("yaml");
      spec = yaml.parse(content);
    }

    const isSwagger = !!spec.swagger;
    const detectedType: DetectedDocType = isSwagger ? "swagger2" : "openapi3";

    const chunks: ChunkData[] = [];
    let chunkIndex = 0;
    let endpointsFound = 0;

    // 1. Create overview chunk
    const overviewChunk = this.createOverviewChunk(spec, options, chunkIndex++);
    if (overviewChunk) {
      chunks.push(overviewChunk);
    }

    // 2. Create auth chunk
    const authChunk = this.createAuthChunk(spec, options, chunkIndex);
    if (authChunk) {
      chunks.push(authChunk);
      chunkIndex++;
    }

    // 3. Create endpoint chunks
    if (spec.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        const methods = ["get", "post", "put", "patch", "delete", "options", "head"] as const;

        for (const method of methods) {
          const operation = pathItem[method];
          if (operation) {
            const endpointChunk = this.createEndpointChunk(
              path,
              method.toUpperCase(),
              operation,
              pathItem.parameters || [],
              spec,
              options,
              chunkIndex++
            );
            chunks.push(endpointChunk);
            endpointsFound++;
          }
        }
      }
    }

    // 4. Create schema chunks for complex types
    const schemas = spec.components?.schemas || spec.definitions || {};
    for (const [name, schema] of Object.entries(schemas)) {
      if (this.isComplexSchema(schema)) {
        const schemaChunk = this.createSchemaChunk(name, schema, options, chunkIndex++);
        chunks.push(schemaChunk);
      }
    }

    return {
      chunks,
      detectedType,
      endpointsFound,
      schemasFound: Object.keys(schemas).length,
    };
  }

  // ============================================
  // CHUNK CREATION METHODS
  // ============================================

  private createOverviewChunk(
    spec: OpenApiSpec,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData | null {
    const info = spec.info;
    if (!info?.title && !info?.description) {
      return null;
    }

    const parts: string[] = [];

    parts.push(`# API Overview: ${info.title || "API Documentation"}`);

    if (info.version) {
      parts.push(`Version: ${info.version}`);
    }

    if (info.description) {
      parts.push("");
      parts.push(info.description);
    }

    // Add servers/base URL
    if (spec.servers && spec.servers.length > 0) {
      parts.push("");
      parts.push("## Base URLs");
      for (const server of spec.servers) {
        parts.push(`- ${server.url}${server.description ? ` (${server.description})` : ""}`);
      }
    } else if (spec.host) {
      // Swagger 2.0
      const scheme = "https";
      parts.push("");
      parts.push(`Base URL: ${scheme}://${spec.host}${spec.basePath || ""}`);
    }

    const content = parts.join("\n");

    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "overview",
      sourceUrl: options.sourceUrl,
    });
  }

  private createAuthChunk(
    spec: OpenApiSpec,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData | null {
    const securitySchemes =
      spec.components?.securitySchemes || spec.securityDefinitions;

    if (!securitySchemes || Object.keys(securitySchemes).length === 0) {
      return null;
    }

    const parts: string[] = [];
    parts.push("# Authentication");
    parts.push("");

    for (const [name, scheme] of Object.entries(securitySchemes)) {
      parts.push(`## ${name}`);
      parts.push(`Type: ${scheme.type}`);

      if (scheme.description) {
        parts.push(scheme.description);
      }

      if (scheme.in && scheme.name) {
        parts.push(`Location: ${scheme.in} (${scheme.name})`);
      }

      if (scheme.scheme) {
        parts.push(`Scheme: ${scheme.scheme}`);
      }

      parts.push("");
    }

    const content = parts.join("\n");

    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "auth",
      sourceUrl: options.sourceUrl,
    });
  }

  private createEndpointChunk(
    path: string,
    method: string,
    operation: Operation,
    pathParams: Parameter[],
    spec: OpenApiSpec,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData {
    const parts: string[] = [];

    // Header
    parts.push(`# ${method} ${path}`);
    if (operation.deprecated) {
      parts.push("**DEPRECATED**");
    }

    // Summary/Description
    if (operation.summary) {
      parts.push(`**${operation.summary}**`);
    }
    if (operation.description) {
      parts.push("");
      parts.push(operation.description);
    }

    // Operation ID and Tags
    if (operation.operationId) {
      parts.push("");
      parts.push(`Operation ID: \`${operation.operationId}\``);
    }
    if (operation.tags && operation.tags.length > 0) {
      parts.push(`Tags: ${operation.tags.join(", ")}`);
    }

    // Parameters
    const allParams = [...pathParams, ...(operation.parameters || [])];
    if (allParams.length > 0) {
      parts.push("");
      parts.push("## Parameters");

      const paramsByLocation = this.groupParamsByLocation(allParams);

      for (const [location, params] of Object.entries(paramsByLocation)) {
        parts.push(`### ${this.formatLocation(location)}`);
        for (const param of params) {
          const required = param.required ? " (required)" : "";
          const type = param.schema?.type || param.type || "string";
          parts.push(`- \`${param.name}\`: ${type}${required}`);
          if (param.description) {
            parts.push(`  ${param.description}`);
          }
        }
      }
    }

    // Request Body
    if (operation.requestBody) {
      parts.push("");
      parts.push("## Request Body");
      if (operation.requestBody.required) {
        parts.push("*Required*");
      }
      if (operation.requestBody.description) {
        parts.push(operation.requestBody.description);
      }

      const content = operation.requestBody.content;
      if (content) {
        for (const [mediaType, mediaValue] of Object.entries(content)) {
          parts.push(`\nContent-Type: \`${mediaType}\``);
          if (mediaValue.schema) {
            parts.push("```");
            parts.push(this.formatSchema(mediaValue.schema, spec));
            parts.push("```");
          }
          if (mediaValue.example) {
            parts.push("Example:");
            parts.push("```json");
            parts.push(JSON.stringify(mediaValue.example, null, 2));
            parts.push("```");
          }
        }
      }
    }

    // Responses
    if (operation.responses) {
      parts.push("");
      parts.push("## Responses");

      for (const [code, response] of Object.entries(operation.responses)) {
        parts.push(`### ${code}`);
        if (response.description) {
          parts.push(response.description);
        }

        // OpenAPI 3.x
        if (response.content) {
          for (const [mediaType, mediaValue] of Object.entries(response.content)) {
            parts.push(`Content-Type: \`${mediaType}\``);
            if (mediaValue.schema) {
              parts.push("```");
              parts.push(this.formatSchema(mediaValue.schema, spec));
              parts.push("```");
            }
          }
        }

        // Swagger 2.0
        if (response.schema) {
          parts.push("```");
          parts.push(this.formatSchema(response.schema, spec));
          parts.push("```");
        }
      }
    }

    const content = parts.join("\n");

    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "endpoint",
      httpMethod: method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
      path,
      operationId: operation.operationId,
      tags: operation.tags,
      deprecated: operation.deprecated,
      sourceUrl: options.sourceUrl,
    });
  }

  private createSchemaChunk(
    name: string,
    schema: SchemaObject,
    options: ParserOptions,
    chunkIndex: number
  ): ChunkData {
    const parts: string[] = [];

    parts.push(`# Schema: ${name}`);

    if (schema.description) {
      parts.push(schema.description);
    }

    parts.push("");
    parts.push("```");
    parts.push(this.formatSchemaDetailed(name, schema));
    parts.push("```");

    if (schema.example) {
      parts.push("");
      parts.push("Example:");
      parts.push("```json");
      parts.push(JSON.stringify(schema.example, null, 2));
      parts.push("```");
    }

    const content = parts.join("\n");

    return this.createChunk(content, chunkIndex, 0, {
      chunkType: "schema",
      schemaName: name,
      schemaType: schema.type as "object" | "array" | "enum" | undefined,
      sourceUrl: options.sourceUrl,
    });
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private groupParamsByLocation(params: Parameter[]): Record<string, Parameter[]> {
    const grouped: Record<string, Parameter[]> = {};

    for (const param of params) {
      const location = param.in;
      if (!grouped[location]) {
        grouped[location] = [];
      }
      grouped[location].push(param);
    }

    return grouped;
  }

  private formatLocation(location: string): string {
    const labels: Record<string, string> = {
      path: "Path Parameters",
      query: "Query Parameters",
      header: "Headers",
      cookie: "Cookies",
      body: "Body",
    };
    return labels[location] || location;
  }

  private formatSchema(schema: SchemaObject, spec: OpenApiSpec, depth = 0): string {
    const indent = "  ".repeat(depth);

    if (schema.$ref) {
      const refName = schema.$ref.split("/").pop();
      return `${indent}$ref: ${refName}`;
    }

    if (schema.type === "array" && schema.items) {
      return `${indent}array of:\n${this.formatSchema(schema.items, spec, depth + 1)}`;
    }

    if (schema.type === "object" && schema.properties) {
      const lines: string[] = [];
      lines.push(`${indent}{`);
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(propName) ? " (required)" : "";
        const type = propSchema.type || propSchema.$ref?.split("/").pop() || "any";
        lines.push(`${indent}  ${propName}: ${type}${required}`);
      }
      lines.push(`${indent}}`);
      return lines.join("\n");
    }

    if (schema.enum) {
      return `${indent}enum: [${schema.enum.join(", ")}]`;
    }

    return `${indent}${schema.type || "any"}`;
  }

  private formatSchemaDetailed(name: string, schema: SchemaObject): string {
    const lines: string[] = [];

    lines.push(`${name}: {`);

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        const required = schema.required?.includes(propName) ? " // required" : "";
        const type = propSchema.type || propSchema.$ref?.split("/").pop() || "any";
        const desc = propSchema.description ? ` - ${propSchema.description}` : "";
        lines.push(`  ${propName}: ${type}${required}${desc}`);
      }
    }

    lines.push("}");

    return lines.join("\n");
  }

  private isComplexSchema(schema: SchemaObject): boolean {
    // Include schemas with properties, enums, or detailed descriptions
    return (
      (schema.properties && Object.keys(schema.properties).length > 2) ||
      (schema.enum && schema.enum.length > 0) ||
      (schema.description && schema.description.length > 100)
    );
  }
}

// Export singleton instance
export const openApiParser = new OpenApiParser();
