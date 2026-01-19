/**
 * ToolSpec - SierraMCP Tool Definition Schema
 *
 * This is the canonical schema for all tool definitions in SierraMCP.
 * Tools are generated from API documentation using LLM and must be
 * grounded in retrieved documentation chunks (citations required).
 *
 * Constraints:
 * - Output MUST be valid JSON
 * - Never invent endpoints; must be grounded in documentation
 * - Must include citations to chunk IDs used
 * - Supports versioning and draft/published states
 */

// =============================================================================
// ENUMS
// =============================================================================

export type ToolStatus = "DRAFT" | "PUBLISHED";

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type AuthType = "oauth2" | "apiKey" | "basic" | "bearer" | "none";

// =============================================================================
// JSON SCHEMA SUBSET (for inputs/outputs)
// =============================================================================

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean" | "array" | "object";
  description?: string;
  format?: string; // e.g., "date-time", "email", "uri"
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: JsonSchemaProperty; // For arrays
  properties?: Record<string, JsonSchemaProperty>; // For nested objects
  required?: string[]; // For nested objects
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  example?: unknown;
}

export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

// =============================================================================
// TOOLSPEC COMPONENTS
// =============================================================================

/**
 * HTTP configuration for the tool
 */
export interface ToolSpecHttp {
  method: HttpMethod;
  path: string; // e.g., "/customers/{customerId}"
  baseUrlEnvKey?: string; // e.g., "prod", "staging" - references ApplicationEnvironment
}

/**
 * Authentication requirements
 */
export interface ToolSpecAuth {
  type: AuthType;
  scopes?: string[]; // OAuth2 scopes if applicable
}

/**
 * Input parameters organized by location
 */
export interface ToolSpecInputs {
  path: JsonSchemaObject;
  query: JsonSchemaObject;
  headers: JsonSchemaObject;
  body: JsonSchemaObject;
}

/**
 * Error case definition
 */
export interface ToolSpecErrorCase {
  status: number; // HTTP status code
  code: string; // Error code (e.g., "NOT_FOUND", "INVALID_REQUEST")
  description: string;
}

/**
 * Output definitions
 */
export interface ToolSpecOutputs {
  success: JsonSchemaObject;
  errors: ToolSpecErrorCase[];
}

/**
 * Safety classification
 */
export interface ToolSpecSafety {
  readOnly: boolean; // GET operations that don't modify state
  destructive: boolean; // DELETE or operations that can't be undone
  pii: boolean; // Handles personally identifiable information
}

/**
 * Example request/response pair
 */
export interface ToolSpecExample {
  request: {
    path: Record<string, unknown>;
    query: Record<string, unknown>;
    headers: Record<string, unknown>;
    body: Record<string, unknown>;
  };
  response: Record<string, unknown>;
}

/**
 * Test case definition
 */
export interface ToolSpecTestCase {
  name: string;
  inputs: {
    path: Record<string, unknown>;
    query: Record<string, unknown>;
    headers: Record<string, unknown>;
    body: Record<string, unknown>;
  };
  expectedStatus: number;
  expectedBodyContains?: Record<string, unknown>; // Partial match
}

/**
 * Source citation - links tool to documentation chunks
 */
export interface ToolSpecSource {
  docId: string; // ApplicationDocument ID
  chunkId: string; // DocumentChunk ID
  excerpt: string; // Relevant snippet from the chunk
}

// =============================================================================
// MAIN TOOLSPEC
// =============================================================================

/**
 * Complete ToolSpec definition
 */
export interface ToolSpec {
  id?: string; // UUID, optional for new tools
  applicationId: string;
  version: number;
  status: ToolStatus;
  name: string; // snake_case identifier (e.g., "get_customer")
  title: string; // Human readable (e.g., "Get Customer by ID")
  description: string;
  http: ToolSpecHttp;
  auth: ToolSpecAuth;
  inputs: ToolSpecInputs;
  outputs: ToolSpecOutputs;
  safety: ToolSpecSafety;
  examples: ToolSpecExample;
  testCases: ToolSpecTestCase[];
  sources: ToolSpecSource[];
}

// =============================================================================
// ERROR RESPONSE (when tool cannot be generated)
// =============================================================================

/**
 * Returned when LLM cannot generate a complete tool from documentation
 */
export interface ToolSpecError {
  error: "missing_info";
  missing: string[]; // Fields that couldn't be derived
  question: string; // Clarifying question for the user
}

export type ToolSpecResult = ToolSpec | ToolSpecError;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

export function isToolSpecError(result: ToolSpecResult): result is ToolSpecError {
  return "error" in result && result.error === "missing_info";
}

export function isValidToolSpec(result: ToolSpecResult): result is ToolSpec {
  return !isToolSpecError(result);
}

/**
 * Create an empty inputs object with proper structure
 */
export function createEmptyInputs(): ToolSpecInputs {
  return {
    path: { type: "object", properties: {}, required: [] },
    query: { type: "object", properties: {}, required: [] },
    headers: { type: "object", properties: {}, required: [] },
    body: { type: "object", properties: {}, required: [] },
  };
}

/**
 * Create an empty outputs object with proper structure
 */
export function createEmptyOutputs(): ToolSpecOutputs {
  return {
    success: { type: "object", properties: {} },
    errors: [],
  };
}

/**
 * Create a default safety object based on HTTP method
 */
export function inferSafetyFromMethod(method: HttpMethod): ToolSpecSafety {
  switch (method) {
    case "GET":
      return { readOnly: true, destructive: false, pii: false };
    case "DELETE":
      return { readOnly: false, destructive: true, pii: false };
    case "POST":
    case "PUT":
    case "PATCH":
      return { readOnly: false, destructive: false, pii: false };
  }
}

/**
 * Convert tool name to snake_case
 */
export function toSnakeCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[\s\-]+/g, "_")
    .toLowerCase();
}

/**
 * Convert snake_case to Title Case
 */
export function toTitleCase(str: string): string {
  return str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

// =============================================================================
// VALIDATION
// =============================================================================

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validate a ToolSpec object
 */
export function validateToolSpec(spec: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!spec || typeof spec !== "object") {
    errors.push({ path: "", message: "ToolSpec must be an object" });
    return errors;
  }

  const s = spec as Record<string, unknown>;

  // Required string fields
  const requiredStrings = ["applicationId", "name", "title", "description"];
  for (const field of requiredStrings) {
    if (typeof s[field] !== "string" || (s[field] as string).trim() === "") {
      errors.push({ path: field, message: `${field} is required and must be a non-empty string` });
    }
  }

  // Version must be a positive integer
  if (typeof s.version !== "number" || s.version < 1 || !Number.isInteger(s.version)) {
    errors.push({ path: "version", message: "version must be a positive integer" });
  }

  // Status must be valid
  if (!["DRAFT", "PUBLISHED"].includes(s.status as string)) {
    errors.push({ path: "status", message: "status must be DRAFT or PUBLISHED" });
  }

  // Name must be snake_case
  if (typeof s.name === "string" && !/^[a-z][a-z0-9_]*$/.test(s.name)) {
    errors.push({ path: "name", message: "name must be snake_case (lowercase, underscores, start with letter)" });
  }

  // HTTP validation
  if (!s.http || typeof s.http !== "object") {
    errors.push({ path: "http", message: "http configuration is required" });
  } else {
    const http = s.http as Record<string, unknown>;
    if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(http.method as string)) {
      errors.push({ path: "http.method", message: "http.method must be GET, POST, PUT, PATCH, or DELETE" });
    }
    if (typeof http.path !== "string" || !http.path.startsWith("/")) {
      errors.push({ path: "http.path", message: "http.path must be a string starting with /" });
    }
  }

  // Auth validation
  if (!s.auth || typeof s.auth !== "object") {
    errors.push({ path: "auth", message: "auth configuration is required" });
  } else {
    const auth = s.auth as Record<string, unknown>;
    if (!["oauth2", "apiKey", "basic", "bearer", "none"].includes(auth.type as string)) {
      errors.push({ path: "auth.type", message: "auth.type must be oauth2, apiKey, basic, bearer, or none" });
    }
  }

  // Sources must not be empty (grounded in documentation)
  if (!Array.isArray(s.sources) || s.sources.length === 0) {
    errors.push({ path: "sources", message: "sources must contain at least one documentation citation" });
  }

  return errors;
}

// =============================================================================
// JSON SERIALIZATION
// =============================================================================

/**
 * Convert ToolSpec to JSON string with proper formatting
 */
export function toolSpecToJson(spec: ToolSpec): string {
  return JSON.stringify(spec, null, 2);
}

/**
 * Parse JSON string to ToolSpec with validation
 */
export function jsonToToolSpec(json: string): ToolSpec | ValidationError[] {
  try {
    const parsed = JSON.parse(json);
    const errors = validateToolSpec(parsed);
    if (errors.length > 0) {
      return errors;
    }
    return parsed as ToolSpec;
  } catch (e) {
    return [{ path: "", message: `Invalid JSON: ${e instanceof Error ? e.message : "unknown error"}` }];
  }
}
