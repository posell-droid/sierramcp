/**
 * MCP Runtime API Handler
 *
 * Lambda handler for MCP tool invocation API.
 * Exposes HTTP endpoints for:
 * - POST /mcp/invoke - Execute a single tool
 * - POST /mcp/invoke/batch - Execute multiple tools
 * - GET /mcp/tools - List available tools for a deployment
 * - POST /mcp/sse - Stream tool invocation via Server-Sent Events
 *
 * Authentication:
 * - API key authentication via X-API-Key header
 * - Tenant context derived from API key
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { prisma } from "@repo/db";
import { createHash } from "crypto";
import {
  invokeTool,
  invokeToolsBatch,
  listDeploymentTools,
  invokeToolStreaming,
  formatSSEEvent,
  type ToolInvocationRequest,
} from "../services/mcp-runtime";

// =============================================================================
// TYPES
// =============================================================================

interface InvokeBody {
  deploymentId: string;
  toolName: string;
  inputs?: {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
    headers?: Record<string, unknown>;
    body?: Record<string, unknown>;
  };
  conversationId?: string;
}

interface BatchInvokeBody {
  requests: InvokeBody[];
}

// =============================================================================
// AUTHENTICATION
// =============================================================================

/**
 * Hash an API key for comparison with stored hash
 */
function hashApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey).digest("hex");
}

async function authenticateRequest(
  event: APIGatewayProxyEventV2
): Promise<{ tenantId: string; userId?: string } | null> {
  const apiKey = event.headers["x-api-key"];

  if (!apiKey) {
    return null;
  }

  // Hash the provided key and look it up
  const keyHash = hashApiKey(apiKey);

  // Look up API key by hash in database
  const key = await prisma.apiKey.findFirst({
    where: {
      keyHash,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: {
      id: true,
      tenantId: true,
    },
  });

  if (!key) {
    return null;
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: key.id },
    data: { lastUsedAt: new Date() },
  });

  return { tenantId: key.tenantId };
}

// =============================================================================
// RESPONSE HELPERS
// =============================================================================

function jsonResponse(
  statusCode: number,
  body: unknown
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "Content-Type, X-API-Key, Authorization",
    },
    body: JSON.stringify(body),
  };
}

function errorResponse(
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResultV2 {
  return jsonResponse(statusCode, { error: { code, message } });
}

// =============================================================================
// ROUTE HANDLERS
// =============================================================================

async function handleInvoke(
  body: InvokeBody,
  auth: { tenantId: string; userId?: string }
): Promise<APIGatewayProxyResultV2> {
  // Validate required fields
  if (!body.deploymentId || !body.toolName) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "deploymentId and toolName are required"
    );
  }

  // Verify deployment belongs to tenant
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: body.deploymentId,
      tenantId: auth.tenantId,
      status: "RUNNING",
    },
    select: { id: true },
  });

  if (!deployment) {
    return errorResponse(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found or not running"
    );
  }

  // Build invocation request
  const request: ToolInvocationRequest = {
    deploymentId: body.deploymentId,
    toolName: body.toolName,
    inputs: body.inputs || {},
    tenantId: auth.tenantId,
    userId: auth.userId,
    conversationId: body.conversationId,
  };

  // Execute tool
  const result = await invokeTool(request);

  return jsonResponse(result.success ? 200 : 400, result);
}

async function handleBatchInvoke(
  body: BatchInvokeBody,
  auth: { tenantId: string; userId?: string }
): Promise<APIGatewayProxyResultV2> {
  if (!Array.isArray(body.requests) || body.requests.length === 0) {
    return errorResponse(400, "INVALID_REQUEST", "requests array is required");
  }

  if (body.requests.length > 10) {
    return errorResponse(
      400,
      "BATCH_TOO_LARGE",
      "Maximum 10 requests per batch"
    );
  }

  // Collect unique deployment IDs
  const deploymentIdSet: Record<string, boolean> = {};
  for (const r of body.requests) {
    deploymentIdSet[r.deploymentId] = true;
  }
  const deploymentIds = Object.keys(deploymentIdSet);

  // Verify all deployments belong to tenant
  const deployments = await prisma.deployment.findMany({
    where: {
      id: { in: deploymentIds },
      tenantId: auth.tenantId,
      status: "RUNNING",
    },
    select: { id: true },
  });

  const validDeploymentIds: Record<string, boolean> = {};
  for (const d of deployments) {
    validDeploymentIds[d.id] = true;
  }

  // Build invocation requests
  const requests: ToolInvocationRequest[] = body.requests
    .filter((r) => validDeploymentIds[r.deploymentId])
    .map((r) => ({
      deploymentId: r.deploymentId,
      toolName: r.toolName,
      inputs: r.inputs || {},
      tenantId: auth.tenantId,
      userId: auth.userId,
      conversationId: r.conversationId,
    }));

  if (requests.length !== body.requests.length) {
    return errorResponse(
      400,
      "INVALID_DEPLOYMENTS",
      "Some deployments not found or not running"
    );
  }

  // Execute all tools
  const results = await invokeToolsBatch(requests);

  return jsonResponse(200, { results });
}

async function handleListTools(
  deploymentId: string,
  auth: { tenantId: string }
): Promise<APIGatewayProxyResultV2> {
  // Verify deployment belongs to tenant
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: deploymentId,
      tenantId: auth.tenantId,
    },
    select: { id: true },
  });

  if (!deployment) {
    return errorResponse(404, "DEPLOYMENT_NOT_FOUND", "Deployment not found");
  }

  const tools = await listDeploymentTools(deploymentId);

  return jsonResponse(200, { tools });
}

// =============================================================================
// SSE HANDLER (for streaming responses)
// =============================================================================

async function handleSSE(
  body: InvokeBody,
  auth: { tenantId: string; userId?: string }
): Promise<APIGatewayProxyResultV2> {
  // Note: Full SSE streaming requires API Gateway HTTP API with response streaming
  // or Lambda Function URLs. This implementation collects events and returns them.

  // Validate required fields
  if (!body.deploymentId || !body.toolName) {
    return errorResponse(
      400,
      "INVALID_REQUEST",
      "deploymentId and toolName are required"
    );
  }

  // Verify deployment belongs to tenant
  const deployment = await prisma.deployment.findFirst({
    where: {
      id: body.deploymentId,
      tenantId: auth.tenantId,
      status: "RUNNING",
    },
    select: { id: true },
  });

  if (!deployment) {
    return errorResponse(
      404,
      "DEPLOYMENT_NOT_FOUND",
      "Deployment not found or not running"
    );
  }

  // Build invocation request
  const request: ToolInvocationRequest = {
    deploymentId: body.deploymentId,
    toolName: body.toolName,
    inputs: body.inputs || {},
    tenantId: auth.tenantId,
    userId: auth.userId,
    conversationId: body.conversationId,
  };

  // Collect SSE events
  const events: string[] = [];
  for await (const event of invokeToolStreaming(request)) {
    events.push(formatSSEEvent(event));
  }

  return {
    statusCode: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
    body: events.join(""),
  };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  // Handle CORS preflight
  if (event.requestContext.http.method === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, X-API-Key, Authorization",
      },
      body: "",
    };
  }

  // Authenticate
  const auth = await authenticateRequest(event);
  if (!auth) {
    return errorResponse(401, "UNAUTHORIZED", "Invalid or missing API key");
  }

  const method = event.requestContext.http.method;
  const path = event.rawPath;

  try {
    // Route: POST /mcp/invoke
    if (method === "POST" && (path === "/invoke" || path === "/mcp/invoke")) {
      const body = JSON.parse(event.body || "{}") as InvokeBody;
      return handleInvoke(body, auth);
    }

    // Route: POST /mcp/invoke/batch
    if (method === "POST" && (path === "/invoke/batch" || path === "/mcp/invoke/batch")) {
      const body = JSON.parse(event.body || "{}") as BatchInvokeBody;
      return handleBatchInvoke(body, auth);
    }

    // Route: GET /mcp/tools?deploymentId=xxx
    if (method === "GET" && (path === "/tools" || path === "/mcp/tools")) {
      const deploymentId = event.queryStringParameters?.deploymentId;
      if (!deploymentId) {
        return errorResponse(
          400,
          "INVALID_REQUEST",
          "deploymentId query parameter required"
        );
      }
      return handleListTools(deploymentId, auth);
    }

    // Route: POST /mcp/sse (SSE streaming)
    if (method === "POST" && (path === "/sse" || path === "/mcp/sse")) {
      const body = JSON.parse(event.body || "{}") as InvokeBody;
      return handleSSE(body, auth);
    }

    return errorResponse(404, "NOT_FOUND", "Route not found");
  } catch (error) {
    console.error("MCP Runtime error:", error);

    if (error instanceof SyntaxError) {
      return errorResponse(400, "INVALID_JSON", "Invalid JSON in request body");
    }

    return errorResponse(
      500,
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Internal server error"
    );
  }
}

// =============================================================================
// HEALTH CHECK HANDLER
// =============================================================================

export async function healthHandler(): Promise<APIGatewayProxyResultV2> {
  try {
    // Quick DB connectivity check
    await prisma.$queryRaw`SELECT 1`;

    return jsonResponse(200, {
      status: "healthy",
      service: "mcp-runtime",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return jsonResponse(503, {
      status: "unhealthy",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
