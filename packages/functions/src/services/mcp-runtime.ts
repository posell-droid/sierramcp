/**
 * MCP Runtime Service
 *
 * HTTP/SSE proxy for executing MCP tools. This service:
 * - Receives tool invocation requests from chat gateways (Slack, Teams, etc.)
 * - Executes HTTP requests based on ToolSpec definitions
 * - Handles authentication using stored credentials (Secrets Manager)
 * - Streams responses via SSE for long-running operations
 * - Collects usage metrics for billing
 *
 * ARCHITECTURE:
 * - Runs as a Lambda function behind API Gateway
 * - Invoked by the Chat Gateway with tool call requests
 * - Uses ToolSpec to construct and execute HTTP requests
 * - Returns results back to the Chat Gateway
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import { prisma } from "@repo/db";
import type {
  ToolSpec,
  ToolSpecInputs,
  JsonSchemaProperty,
} from "@repo/shared";

// =============================================================================
// CONFIGURATION
// =============================================================================

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// Request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 30000;

// =============================================================================
// TYPES
// =============================================================================

export interface ToolInvocationRequest {
  deploymentId: string;
  toolName: string;
  inputs: {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: Record<string, unknown>;
  };
  tenantId: string;
  userId?: string;
  conversationId?: string;
}

export interface ToolInvocationResult {
  success: boolean;
  status?: number;
  data?: unknown;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  duration: number;
  cached?: boolean;
}

interface CredentialConfig {
  type: "apiKey" | "bearer" | "basic" | "oauth2";
  apiKey?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  oauth2AccessToken?: string;
}

interface DeploymentContext {
  deployment: {
    id: string;
    tenantId: string;
    mcpId: string;
    environment: string;
    endpointUrl: string | null;
    configValues: Record<string, unknown>;
  };
  mcp: {
    id: string;
    name: string;
  };
  tool: ToolSpec | null;
  credentials: CredentialConfig | null;
}

// =============================================================================
// CREDENTIAL MANAGEMENT
// =============================================================================

/**
 * Retrieve credentials for a deployment from Secrets Manager
 */
async function getCredentials(
  tenantId: string,
  mcpId: string,
  environment: string
): Promise<CredentialConfig | null> {
  const secretName = `sierramcp/${tenantId}/${mcpId}/${environment}`;

  try {
    const response = await secretsClient.send(
      new GetSecretValueCommand({
        SecretId: secretName,
      })
    );

    if (response.SecretString) {
      return JSON.parse(response.SecretString) as CredentialConfig;
    }
    return null;
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === "ResourceNotFoundException") {
      console.warn(`No credentials found for ${secretName}`);
      return null;
    }
    console.error(`Failed to retrieve credentials: ${err.name}`);
    return null;
  }
}

/**
 * Build authorization headers based on credential type
 */
function buildAuthHeaders(
  credentials: CredentialConfig | null,
  toolAuth: { type: string }
): Record<string, string> {
  if (!credentials || toolAuth.type === "none") {
    return {};
  }

  switch (credentials.type) {
    case "apiKey":
      if (credentials.apiKey) {
        return { "X-API-Key": credentials.apiKey };
      }
      break;
    case "bearer":
      if (credentials.bearerToken) {
        return { Authorization: `Bearer ${credentials.bearerToken}` };
      }
      break;
    case "basic":
      if (credentials.username && credentials.password) {
        const encoded = Buffer.from(
          `${credentials.username}:${credentials.password}`
        ).toString("base64");
        return { Authorization: `Basic ${encoded}` };
      }
      break;
    case "oauth2":
      if (credentials.oauth2AccessToken) {
        return { Authorization: `Bearer ${credentials.oauth2AccessToken}` };
      }
      break;
  }

  return {};
}

// =============================================================================
// URL BUILDING
// =============================================================================

/**
 * Build the full URL for a tool invocation
 */
function buildUrl(
  baseUrl: string,
  path: string,
  pathParams: Record<string, unknown>,
  queryParams: Record<string, unknown>
): string {
  // Replace path parameters
  let resolvedPath = path;
  for (const [key, value] of Object.entries(pathParams)) {
    resolvedPath = resolvedPath.replace(
      `{${key}}`,
      encodeURIComponent(String(value))
    );
  }

  // Build query string
  const queryParts: string[] = [];
  for (const [key, value] of Object.entries(queryParams)) {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        for (const v of value) {
          queryParts.push(
            `${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`
          );
        }
      } else {
        queryParts.push(
          `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`
        );
      }
    }
  }

  const queryString = queryParts.length > 0 ? `?${queryParts.join("&")}` : "";

  // Ensure baseUrl doesn't end with slash and path starts with slash
  const normalizedBase = baseUrl.replace(/\/$/, "");
  const normalizedPath = resolvedPath.startsWith("/")
    ? resolvedPath
    : `/${resolvedPath}`;

  return `${normalizedBase}${normalizedPath}${queryString}`;
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/**
 * Validate inputs against the tool's schema
 */
function validateInputs(
  inputs: ToolInvocationRequest["inputs"],
  schema: ToolSpecInputs
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate path parameters
  if (schema.path.required) {
    for (const required of schema.path.required) {
      if (!(required in (inputs.path || {}))) {
        errors.push(`Missing required path parameter: ${required}`);
      }
    }
  }

  // Validate query parameters
  if (schema.query.required) {
    for (const required of schema.query.required) {
      if (!(required in (inputs.query || {}))) {
        errors.push(`Missing required query parameter: ${required}`);
      }
    }
  }

  // Validate body
  if (schema.body.required) {
    for (const required of schema.body.required) {
      if (!(required in (inputs.body || {}))) {
        errors.push(`Missing required body field: ${required}`);
      }
    }
  }

  // Type validation
  for (const [location, locationInputs] of Object.entries(inputs)) {
    const schemaLocation = schema[location as keyof ToolSpecInputs];
    if (!schemaLocation || !locationInputs) continue;

    for (const [key, value] of Object.entries(locationInputs)) {
      const propSchema = schemaLocation.properties[key] as
        | JsonSchemaProperty
        | undefined;
      if (!propSchema) continue;

      const typeError = validateType(key, value, propSchema);
      if (typeError) {
        errors.push(`${location}.${typeError}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateType(
  key: string,
  value: unknown,
  schema: JsonSchemaProperty
): string | null {
  if (value === null || value === undefined) {
    return null; // Optional values are fine
  }

  switch (schema.type) {
    case "string":
      if (typeof value !== "string") {
        return `${key} must be a string`;
      }
      if (schema.minLength && value.length < schema.minLength) {
        return `${key} must be at least ${schema.minLength} characters`;
      }
      if (schema.maxLength && value.length > schema.maxLength) {
        return `${key} must be at most ${schema.maxLength} characters`;
      }
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        return `${key} does not match required pattern`;
      }
      if (schema.enum && !schema.enum.includes(value)) {
        return `${key} must be one of: ${schema.enum.join(", ")}`;
      }
      break;

    case "number":
    case "integer":
      if (typeof value !== "number") {
        return `${key} must be a number`;
      }
      if (schema.type === "integer" && !Number.isInteger(value)) {
        return `${key} must be an integer`;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `${key} must be at least ${schema.minimum}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `${key} must be at most ${schema.maximum}`;
      }
      break;

    case "boolean":
      if (typeof value !== "boolean") {
        return `${key} must be a boolean`;
      }
      break;

    case "array":
      if (!Array.isArray(value)) {
        return `${key} must be an array`;
      }
      break;

    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        return `${key} must be an object`;
      }
      break;
  }

  return null;
}

// =============================================================================
// HTTP EXECUTION
// =============================================================================

/**
 * Execute an HTTP request based on the tool spec
 */
async function executeHttpRequest(
  url: string,
  method: string,
  headers: Record<string, string>,
  body?: unknown
): Promise<{ status: number; data: unknown; headers: Record<string, string> }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const requestInit: RequestInit = {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...headers,
      },
      signal: controller.signal,
    };

    if (body && ["POST", "PUT", "PATCH"].includes(method)) {
      requestInit.body = JSON.stringify(body);
    }

    const response = await fetch(url, requestInit);

    // Parse response
    let data: unknown;
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      data = await response.json();
    } else if (contentType.includes("text/")) {
      data = await response.text();
    } else {
      data = await response.arrayBuffer();
    }

    // Extract response headers
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    return {
      status: response.status,
      data,
      headers: responseHeaders,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// CONTEXT RESOLUTION
// =============================================================================

/**
 * Resolve deployment context including tool spec and credentials
 */
async function resolveDeploymentContext(
  deploymentId: string,
  toolName: string
): Promise<DeploymentContext | null> {
  // Fetch deployment with MCP and McpTool entries
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      mcp: {
        include: {
          tools: {
            where: { enabled: true },
            select: { toolId: true },
          },
        },
      },
    },
  });

  if (!deployment || deployment.status !== "RUNNING") {
    return null;
  }

  // Get the tool IDs associated with this MCP
  const toolIds = deployment.mcp.tools.map((mt) => mt.toolId);

  // Find the published tool with the matching name
  const tool = await prisma.tool.findFirst({
    where: {
      id: { in: toolIds },
      name: toolName,
      status: "PUBLISHED",
    },
  });

  const toolSpec = tool ? (tool.spec as unknown as ToolSpec) : null;

  // Get credentials
  const credentials = await getCredentials(
    deployment.tenantId,
    deployment.mcp.id,
    deployment.environment
  );

  return {
    deployment: {
      id: deployment.id,
      tenantId: deployment.tenantId,
      mcpId: deployment.mcpId,
      environment: deployment.environment,
      endpointUrl: deployment.endpointUrl,
      configValues: (deployment.configValues as Record<string, unknown>) || {},
    },
    mcp: {
      id: deployment.mcp.id,
      name: deployment.mcp.name,
    },
    tool: toolSpec,
    credentials,
  };
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

/**
 * Record usage event for billing
 */
async function recordUsageEvent(
  tenantId: string,
  mcpId: string,
  deploymentId: string,
  toolName: string,
  result: ToolInvocationResult,
  userId?: string
): Promise<void> {
  try {
    await prisma.usageEvent.create({
      data: {
        tenantId,
        mcpId,
        deploymentId,
        requestCount: 1,
        success: result.success,
        latencyMs: result.duration,
        userId,
        metadata: {
          toolName,
          status: result.status,
        },
      },
    });
  } catch (error) {
    console.error("Failed to record usage event:", error);
  }
}

// =============================================================================
// MAIN INVOCATION FUNCTION
// =============================================================================

/**
 * Invoke a tool and return the result
 */
export async function invokeTool(
  request: ToolInvocationRequest
): Promise<ToolInvocationResult> {
  const startTime = Date.now();

  try {
    // Resolve deployment context
    const context = await resolveDeploymentContext(
      request.deploymentId,
      request.toolName
    );

    if (!context) {
      return {
        success: false,
        error: {
          code: "DEPLOYMENT_NOT_FOUND",
          message: "Deployment not found or not running",
        },
        duration: Date.now() - startTime,
      };
    }

    if (!context.tool) {
      return {
        success: false,
        error: {
          code: "TOOL_NOT_FOUND",
          message: `Tool "${request.toolName}" not found in deployment`,
        },
        duration: Date.now() - startTime,
      };
    }

    const tool = context.tool;

    // Validate inputs
    const validation = validateInputs(request.inputs, tool.inputs);
    if (!validation.valid) {
      return {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Input validation failed",
          details: validation.errors,
        },
        duration: Date.now() - startTime,
      };
    }

    // Get base URL from deployment config or environment
    const baseUrlKey = tool.http.baseUrlEnvKey || "baseUrl";
    const baseUrl = context.deployment.configValues[baseUrlKey] as
      | string
      | undefined;

    if (!baseUrl) {
      return {
        success: false,
        error: {
          code: "CONFIG_ERROR",
          message: `Base URL not configured for environment`,
        },
        duration: Date.now() - startTime,
      };
    }

    // Build URL
    const url = buildUrl(
      baseUrl,
      tool.http.path,
      request.inputs.path || {},
      request.inputs.query || {}
    );

    // Build headers
    const authHeaders = buildAuthHeaders(context.credentials, tool.auth);
    const customHeaders = (request.inputs.headers || {}) as Record<
      string,
      string
    >;
    const headers = { ...authHeaders, ...customHeaders };

    // Execute request
    const response = await executeHttpRequest(
      url,
      tool.http.method,
      headers,
      request.inputs.body
    );

    const duration = Date.now() - startTime;
    const success = response.status >= 200 && response.status < 300;

    const result: ToolInvocationResult = {
      success,
      status: response.status,
      data: response.data,
      duration,
    };

    if (!success) {
      // Map to known error codes if possible
      const errorCase = tool.outputs.errors.find(
        (e) => e.status === response.status
      );
      result.error = {
        code: errorCase?.code || `HTTP_${response.status}`,
        message:
          errorCase?.description ||
          `Request failed with status ${response.status}`,
        details: response.data,
      };
    }

    // Record usage
    await recordUsageEvent(
      request.tenantId,
      context.mcp.id,
      request.deploymentId,
      request.toolName,
      result,
      request.userId
    );

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    const result: ToolInvocationResult = {
      success: false,
      error: {
        code: "EXECUTION_ERROR",
        message: errorMessage,
      },
      duration,
    };

    return result;
  }
}

// =============================================================================
// BATCH INVOCATION
// =============================================================================

/**
 * Invoke multiple tools in parallel
 */
export async function invokeToolsBatch(
  requests: ToolInvocationRequest[]
): Promise<ToolInvocationResult[]> {
  return Promise.all(requests.map(invokeTool));
}

// =============================================================================
// TOOL LISTING
// =============================================================================

export interface ToolListItem {
  name: string;
  title: string;
  description: string;
  method: string;
  path: string;
  safety: {
    readOnly: boolean;
    destructive: boolean;
    pii: boolean;
  };
}

/**
 * List available tools for a deployment
 */
export async function listDeploymentTools(
  deploymentId: string
): Promise<ToolListItem[]> {
  // Get deployment with MCP tools
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      mcp: {
        include: {
          tools: {
            where: { enabled: true },
            select: { toolId: true },
          },
        },
      },
    },
  });

  if (!deployment) {
    return [];
  }

  // Get the tool IDs associated with this MCP
  const toolIds = deployment.mcp.tools.map((mt) => mt.toolId);

  // Fetch published tools
  const tools = await prisma.tool.findMany({
    where: {
      id: { in: toolIds },
      status: "PUBLISHED",
    },
    select: {
      name: true,
      title: true,
      description: true,
      httpMethod: true,
      pathTemplate: true,
      readOnly: true,
      destructive: true,
      pii: true,
    },
  });

  return tools.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    method: t.httpMethod,
    path: t.pathTemplate,
    safety: {
      readOnly: t.readOnly,
      destructive: t.destructive,
      pii: t.pii,
    },
  }));
}

// =============================================================================
// SSE STREAMING SUPPORT
// =============================================================================

export interface SSEEvent {
  event: string;
  data: unknown;
  id?: string;
}

/**
 * Format an SSE event for streaming
 */
export function formatSSEEvent(event: SSEEvent): string {
  const lines: string[] = [];

  if (event.id) {
    lines.push(`id: ${event.id}`);
  }
  lines.push(`event: ${event.event}`);
  lines.push(`data: ${JSON.stringify(event.data)}`);
  lines.push(""); // Empty line to terminate event

  return lines.join("\n") + "\n";
}

/**
 * Stream tool invocation progress via SSE
 */
export async function* invokeToolStreaming(
  request: ToolInvocationRequest
): AsyncGenerator<SSEEvent> {
  const requestId = crypto.randomUUID();

  // Emit start event
  yield {
    event: "start",
    data: {
      requestId,
      toolName: request.toolName,
      deploymentId: request.deploymentId,
    },
    id: `${requestId}-start`,
  };

  // Emit progress event
  yield {
    event: "progress",
    data: { status: "executing", message: "Executing tool..." },
    id: `${requestId}-progress`,
  };

  // Execute the tool
  const result = await invokeTool(request);

  // Emit result event
  yield {
    event: result.success ? "success" : "error",
    data: result,
    id: `${requestId}-result`,
  };

  // Emit end event
  yield {
    event: "end",
    data: { requestId, duration: result.duration },
    id: `${requestId}-end`,
  };
}
