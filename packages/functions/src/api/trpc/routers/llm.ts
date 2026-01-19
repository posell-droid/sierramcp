import { z } from "zod";
import { router, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import Anthropic from "@anthropic-ai/sdk";
import { Resource } from "sst";
import { Prisma } from "@repo/db";
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";
import {
  searchChunks,
  getChunksByIds,
  formatChunksForContext,
  chunksToSources,
  type RagChunk,
} from "../../../services/rag";
import type {
  ToolSpec,
  ToolSpecSource,
  HttpMethod,
} from "@repo/shared/toolspec";
import { inferSafetyFromMethod, validateToolSpec } from "@repo/shared/toolspec";

// =============================================================================
// TEST EXECUTION HELPER
// =============================================================================

interface TestExecutionResult {
  success: boolean;
  httpStatusCode: number | null;
  durationMs: number;
  responseBody: unknown;
  errorMessage: string | null;
  requestUrl: string;
  requestMethod: string;
}

interface IterationStep {
  type: "generate" | "test" | "fix" | "success" | "error" | "question";
  message: string;
  details?: unknown;
  timestamp: number;
}

async function executeToolTest(
  toolSpec: ToolSpec,
  testInputs: Record<string, unknown>,
  environment: {
    baseUrl: string;
    authType: string;
    secretArn: string | null;
  }
): Promise<TestExecutionResult> {
  const startTime = Date.now();
  let httpStatusCode: number | null = null;
  let responseBody: unknown = null;
  let errorMessage: string | null = null;

  try {
    // Build URL from path template
    let path = toolSpec.http?.path || "/";

    // Replace path parameters
    for (const [key, value] of Object.entries(testInputs)) {
      path = path.replace(`{${key}}`, encodeURIComponent(String(value)));
    }

    const url = new URL(path, environment.baseUrl);

    // Add query parameters
    const queryProps = toolSpec.inputs?.query?.properties;
    if (queryProps) {
      for (const key of Object.keys(queryProps)) {
        if (key in testInputs && testInputs[key] !== undefined && testInputs[key] !== null) {
          url.searchParams.set(key, String(testInputs[key]));
        }
      }
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "SierraMCP/1.0",
    };

    // Retrieve and apply credentials
    if (environment.secretArn && environment.authType !== "NONE") {
      try {
        const secretsClient = new SecretsManagerClient({});
        const secretResponse = await secretsClient.send(
          new GetSecretValueCommand({ SecretId: environment.secretArn })
        );

        if (secretResponse.SecretString) {
          const credentials = JSON.parse(secretResponse.SecretString);

          switch (environment.authType) {
            case "API_KEY":
              headers[credentials.headerName || "X-API-Key"] = credentials.apiKey;
              break;
            case "BASIC":
              const basicAuth = Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64");
              headers["Authorization"] = `Basic ${basicAuth}`;
              break;
            case "BEARER":
              headers["Authorization"] = `Bearer ${credentials.token}`;
              break;
            case "CUSTOM_HEADER":
              headers[credentials.headerName] = credentials.headerValue;
              break;
            case "OAUTH2":
              if (credentials.accessToken) {
                headers["Authorization"] = `Bearer ${credentials.accessToken}`;
              }
              break;
          }
        }
      } catch (secretError) {
        errorMessage = `Failed to retrieve credentials: ${secretError instanceof Error ? secretError.message : "Unknown error"}`;
      }
    }

    if (!errorMessage) {
      // Build request body for non-GET requests
      let body: string | undefined;
      const httpMethod = toolSpec.http?.method || "GET";

      if (httpMethod !== "GET") {
        const bodyProps = toolSpec.inputs?.body?.properties;
        if (bodyProps) {
          const bodyData: Record<string, unknown> = {};
          for (const key of Object.keys(bodyProps)) {
            if (key in testInputs) {
              bodyData[key] = testInputs[key];
            }
          }
          if (Object.keys(bodyData).length > 0) {
            body = JSON.stringify(bodyData);
          }
        }
      }

      // Execute request with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s for agentic loop

      try {
        const response = await fetch(url.toString(), {
          method: httpMethod,
          headers,
          body,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        httpStatusCode = response.status;

        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          responseBody = await response.json();
        } else {
          responseBody = { body: await response.text() };
        }

        if (!response.ok) {
          errorMessage = `HTTP ${response.status}: ${JSON.stringify(responseBody).substring(0, 300)}`;
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          errorMessage = "Request timed out after 15 seconds";
        } else {
          errorMessage = fetchError instanceof Error ? fetchError.message : "Request failed";
        }
      }
    }

    return {
      success: httpStatusCode !== null && httpStatusCode >= 200 && httpStatusCode < 300,
      httpStatusCode,
      durationMs: Date.now() - startTime,
      responseBody,
      errorMessage,
      requestUrl: url.toString(),
      requestMethod: toolSpec.http?.method || "GET",
    };
  } catch (error) {
    return {
      success: false,
      httpStatusCode: null,
      durationMs: Date.now() - startTime,
      responseBody: null,
      errorMessage: error instanceof Error ? error.message : "Test execution failed",
      requestUrl: "",
      requestMethod: toolSpec.http?.method || "GET",
    };
  }
}

// =============================================================================
// LLM PROVIDER CONFIGURATION
// =============================================================================

// Provider preference: "anthropic" (direct API) or "bedrock" (AWS)
// Uses Anthropic by default if API key is available, falls back to Bedrock
type LlmProvider = "anthropic" | "bedrock";

function getAnthropicApiKey(): string | null {
  try {
    const resource = Resource as unknown as { AnthropicApiKey?: { value: string } };
    return resource.AnthropicApiKey?.value || null;
  } catch {
    return null;
  }
}

// Initialize Anthropic client (lazy - only when API key is available)
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const apiKey = getAnthropicApiKey();
  if (apiKey) {
    anthropicClient = new Anthropic({ apiKey });
    return anthropicClient;
  }
  return null;
}

// Initialize Bedrock client (fallback)
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || "us-east-1",
});

// Claude 3.5 Sonnet v2 - use cross-region inference profile for Bedrock
const BEDROCK_MODEL_ID = "us.anthropic.claude-3-5-sonnet-20241022-v2:0";
// Direct Anthropic model ID
const ANTHROPIC_MODEL_ID = "claude-sonnet-4-20250514";

// JSON Schema type for validation
const jsonSchemaSchema = z.object({
  type: z.string(),
  properties: z.record(z.unknown()).optional(),
  required: z.array(z.string()).optional(),
  description: z.string().optional(),
}).passthrough();

// Timeout helper
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, operation: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

/**
 * Invoke Claude via Anthropic API directly
 */
async function invokeClaudeAnthropic(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4096
): Promise<string> {
  console.log("[LLM] Using Anthropic direct API");

  const message = await withTimeout(
    client.messages.create({
      model: ANTHROPIC_MODEL_ID,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    }),
    50000, // 50 second timeout
    "Anthropic API call"
  );

  const textBlock = message.content.find((block) => block.type === "text");
  if (textBlock && textBlock.type === "text") {
    return textBlock.text;
  }

  throw new Error("Unexpected response format from Anthropic API");
}

/**
 * Invoke Claude via AWS Bedrock (fallback)
 */
async function invokeClaudeBedrock(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4096
): Promise<string> {
  console.log("[LLM] Using AWS Bedrock");

  const payload = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: userPrompt,
      },
    ],
  };

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify(payload),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));

  if (responseBody.content && responseBody.content[0]?.text) {
    return responseBody.content[0].text;
  }

  throw new Error("Unexpected response format from Bedrock");
}

/**
 * Invoke Claude - tries Anthropic direct API first, falls back to Bedrock
 */
async function invokeClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 4096
): Promise<string> {
  // Try Anthropic direct API first
  const anthropic = getAnthropicClient();
  if (anthropic) {
    try {
      return await invokeClaudeAnthropic(anthropic, systemPrompt, userPrompt, maxTokens);
    } catch (error) {
      console.error("[LLM] Anthropic API failed, falling back to Bedrock:", error);
      // Fall through to Bedrock
    }
  }

  // Fallback to Bedrock
  return await invokeClaudeBedrock(systemPrompt, userPrompt, maxTokens);
}

/**
 * Extract JSON from Claude's response (handles markdown code blocks)
 */
function extractJson(text: string): unknown {
  // Try to find JSON in code blocks first
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    return JSON.parse(codeBlockMatch[1].trim());
  }

  // Try to find raw JSON object/array
  const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[1]);
  }

  // Last resort: try parsing the whole text
  return JSON.parse(text);
}

export const llmRouter = router({
  /**
   * Generate a complete tool definition from a natural language description
   */
  generateToolDefinition: protectedProcedure
    .input(
      z.object({
        prompt: z.string().min(10).max(2000),
        authType: z.enum(["NONE", "API_KEY", "OAUTH2", "BASIC", "BEARER", "CUSTOM_HEADER", "MTLS"]).optional(),
        baseUrl: z.string().url().optional(),
        applicationContext: z.string().optional(), // e.g., "Google Workspace", "Salesforce"
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `You are an expert API tool designer. Your job is to generate MCP (Model Context Protocol) tool definitions from natural language descriptions.

You must respond with ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{
  "name": "snake_case_name",
  "displayName": "Human Readable Name",
  "description": "A clear, detailed description of what this tool does, including when to use it and what it returns.",
  "httpMethod": "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  "pathTemplate": "/api/v1/resource/{resourceId}",
  "inputSchema": {
    "type": "object",
    "properties": {
      "paramName": {
        "type": "string" | "number" | "boolean" | "array" | "object",
        "description": "What this parameter does"
      }
    },
    "required": ["requiredParams"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "fieldName": {
        "type": "string",
        "description": "What this field contains"
      }
    }
  },
  "queryParams": {
    "paramName": "{{paramName}}"
  },
  "headers": {},
  "exampleInvocation": {
    "paramName": "example_value"
  }
}

Guidelines:
- Use snake_case for the tool name (e.g., get_user, create_order)
- Use clear, actionable displayName (e.g., "Get User Details", "Create New Order")
- Write descriptions that help an LLM understand WHEN to use this tool
- Include all likely parameters with sensible defaults
- Path parameters use {paramName} syntax
- Query params use {{paramName}} template syntax
- For POST/PUT/PATCH, include bodyTemplate if needed
- Consider pagination params (limit, offset, page) for list operations
- Consider filter params (status, date ranges) where appropriate`;

      let userPrompt = `Generate a tool definition for: ${input.prompt}`;

      if (input.applicationContext) {
        userPrompt += `\n\nThis tool is for the ${input.applicationContext} API.`;
      }

      if (input.baseUrl) {
        userPrompt += `\n\nBase URL: ${input.baseUrl}`;
      }

      if (input.authType) {
        userPrompt += `\n\nAuthentication type: ${input.authType}`;
      }

      try {
        const response = await invokeClaude(systemPrompt, userPrompt);
        const toolDefinition = extractJson(response) as {
          name: string;
          displayName: string;
          description: string;
          httpMethod: string;
          pathTemplate: string;
          inputSchema: Record<string, unknown>;
          outputSchema: Record<string, unknown>;
          queryParams?: Record<string, string>;
          headers?: Record<string, string>;
          bodyTemplate?: Record<string, unknown>;
          exampleInvocation?: Record<string, unknown>;
        };

        // Validate required fields
        if (!toolDefinition.name || !toolDefinition.description || !toolDefinition.httpMethod) {
          throw new Error("Invalid tool definition: missing required fields");
        }

        // Normalize httpMethod to uppercase
        toolDefinition.httpMethod = toolDefinition.httpMethod.toUpperCase();

        return {
          success: true,
          tool: {
            name: toolDefinition.name,
            displayName: toolDefinition.displayName || toolDefinition.name,
            description: toolDefinition.description,
            httpMethod: toolDefinition.httpMethod as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
            pathTemplate: toolDefinition.pathTemplate || "/",
            inputSchema: toolDefinition.inputSchema || { type: "object", properties: {} },
            outputSchema: toolDefinition.outputSchema || { type: "object", properties: {} },
            queryParams: toolDefinition.queryParams || {},
            headers: toolDefinition.headers || {},
            bodyTemplate: toolDefinition.bodyTemplate,
            exampleInvocation: toolDefinition.exampleInvocation,
          },
        };
      } catch (error) {
        console.error("Failed to generate tool definition:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate tool definition",
        });
      }
    }),

  /**
   * Suggest input/output schemas based on a tool description and optional example data
   */
  suggestSchema: protectedProcedure
    .input(
      z.object({
        description: z.string().min(10).max(2000),
        httpMethod: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
        pathTemplate: z.string().optional(),
        exampleRequest: z.string().optional(), // JSON string of example request
        exampleResponse: z.string().optional(), // JSON string of example response
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `You are an expert at designing JSON schemas for API tools. Given a tool description and optional examples, generate comprehensive input and output schemas.

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "inputSchema": {
    "type": "object",
    "properties": {
      "paramName": {
        "type": "string",
        "description": "Clear description"
      }
    },
    "required": ["requiredParams"]
  },
  "outputSchema": {
    "type": "object",
    "properties": {
      "fieldName": {
        "type": "string",
        "description": "What this field contains"
      }
    }
  },
  "queryParams": {
    "paramName": "{{paramName}}"
  },
  "bodyTemplate": null
}

Guidelines:
- Extract path parameters from the pathTemplate (e.g., {userId} -> userId in inputSchema)
- For GET requests, parameters typically go in queryParams
- For POST/PUT/PATCH, include bodyTemplate with the request structure
- Use accurate types: string, number, integer, boolean, array, object
- Add format hints where appropriate: "format": "date-time", "format": "email", etc.
- Include sensible descriptions for each field
- Mark truly required fields in the "required" array`;

      let userPrompt = `Tool description: ${input.description}\nHTTP Method: ${input.httpMethod}`;

      if (input.pathTemplate) {
        userPrompt += `\nPath template: ${input.pathTemplate}`;
      }

      if (input.exampleRequest) {
        userPrompt += `\n\nExample request:\n${input.exampleRequest}`;
      }

      if (input.exampleResponse) {
        userPrompt += `\n\nExample response:\n${input.exampleResponse}`;
      }

      try {
        const response = await invokeClaude(systemPrompt, userPrompt);
        const schemas = extractJson(response) as {
          inputSchema: Record<string, unknown>;
          outputSchema: Record<string, unknown>;
          queryParams?: Record<string, string>;
          bodyTemplate?: Record<string, unknown> | null;
        };

        return {
          success: true,
          inputSchema: schemas.inputSchema || { type: "object", properties: {} },
          outputSchema: schemas.outputSchema || { type: "object", properties: {} },
          queryParams: schemas.queryParams || {},
          bodyTemplate: schemas.bodyTemplate || undefined,
        };
      } catch (error) {
        console.error("Failed to suggest schema:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to suggest schema",
        });
      }
    }),

  /**
   * Improve a tool's description for better LLM understanding
   */
  improveDescription: protectedProcedure
    .input(
      z.object({
        currentDescription: z.string().min(1).max(2000),
        toolName: z.string().optional(),
        inputSchema: jsonSchemaSchema.optional(),
        outputSchema: jsonSchemaSchema.optional(),
        context: z.string().optional(), // Additional context about the API/application
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `You are an expert at writing tool descriptions for LLM-based AI assistants. Your job is to improve tool descriptions to be more clear, actionable, and useful for an AI deciding when to use this tool.

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "improvedDescription": "The improved description text",
  "suggestions": ["Optional list of additional improvements or considerations"]
}

Guidelines for good tool descriptions:
1. Start with a clear action verb (Get, Create, Update, Delete, List, Search, etc.)
2. Explain WHAT the tool does in one sentence
3. Explain WHEN to use it (what user intent triggers this tool)
4. Mention key inputs and what they affect
5. Describe what the output contains
6. Note any limitations or prerequisites
7. Keep it concise but complete (2-4 sentences ideal)
8. Avoid jargon - use plain language an LLM can understand`;

      let userPrompt = `Current description: ${input.currentDescription}`;

      if (input.toolName) {
        userPrompt += `\n\nTool name: ${input.toolName}`;
      }

      if (input.inputSchema) {
        userPrompt += `\n\nInput schema: ${JSON.stringify(input.inputSchema, null, 2)}`;
      }

      if (input.outputSchema) {
        userPrompt += `\n\nOutput schema: ${JSON.stringify(input.outputSchema, null, 2)}`;
      }

      if (input.context) {
        userPrompt += `\n\nAdditional context: ${input.context}`;
      }

      try {
        const response = await invokeClaude(systemPrompt, userPrompt, 1024);
        const result = extractJson(response) as {
          improvedDescription: string;
          suggestions?: string[];
        };

        return {
          success: true,
          improvedDescription: result.improvedDescription,
          suggestions: result.suggestions || [],
        };
      } catch (error) {
        console.error("Failed to improve description:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to improve description",
        });
      }
    }),

  /**
   * Generate tools from API documentation or OpenAPI spec
   */
  generateFromDocs: protectedProcedure
    .input(
      z.object({
        documentation: z.string().min(50).max(50000),
        applicationName: z.string().optional(),
        maxTools: z.number().min(1).max(20).default(5),
      })
    )
    .mutation(async ({ input }) => {
      const systemPrompt = `You are an expert at extracting API tool definitions from documentation. Analyze the provided documentation and generate MCP tool definitions for the most useful endpoints.

Respond with ONLY a valid JSON object (no markdown, no explanation):
{
  "tools": [
    {
      "name": "snake_case_name",
      "displayName": "Human Readable Name",
      "description": "Clear description of what this tool does",
      "httpMethod": "GET",
      "pathTemplate": "/api/v1/resource/{id}",
      "inputSchema": {
        "type": "object",
        "properties": {},
        "required": []
      },
      "outputSchema": {
        "type": "object",
        "properties": {}
      },
      "queryParams": {},
      "headers": {},
      "priority": 1
    }
  ],
  "summary": "Brief summary of what was extracted"
}

Guidelines:
- Prioritize the most commonly used/useful endpoints
- Focus on CRUD operations and search/list endpoints
- Extract accurate path templates and parameters
- Infer schemas from examples in the documentation
- Set priority 1-5 (1 = most useful)
- Skip deprecated or internal endpoints`;

      const userPrompt = `Extract up to ${input.maxTools} tool definitions from this documentation${input.applicationName ? ` for ${input.applicationName}` : ""}:\n\n${input.documentation}`;

      try {
        const response = await invokeClaude(systemPrompt, userPrompt, 8192);
        const result = extractJson(response) as {
          tools: Array<{
            name: string;
            displayName: string;
            description: string;
            httpMethod: string;
            pathTemplate: string;
            inputSchema: Record<string, unknown>;
            outputSchema: Record<string, unknown>;
            queryParams?: Record<string, string>;
            headers?: Record<string, string>;
            priority?: number;
          }>;
          summary: string;
        };

        // Validate and normalize tools
        const tools = (result.tools || []).map((tool) => ({
          name: tool.name,
          displayName: tool.displayName || tool.name,
          description: tool.description,
          httpMethod: (tool.httpMethod || "GET").toUpperCase() as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          pathTemplate: tool.pathTemplate || "/",
          inputSchema: tool.inputSchema || { type: "object", properties: {} },
          outputSchema: tool.outputSchema || { type: "object", properties: {} },
          queryParams: tool.queryParams || {},
          headers: tool.headers || {},
          priority: tool.priority || 5,
        }));

        return {
          success: true,
          tools,
          summary: result.summary || `Extracted ${tools.length} tools`,
        };
      } catch (error) {
        console.error("Failed to generate from docs:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate tools from documentation",
        });
      }
    }),

  /**
   * Generate a complete ToolSpec from natural language intent.
   * Uses RAG to retrieve relevant documentation chunks and Claude to generate the tool.
   */
  generateTool: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        intent: z.string().min(5).max(500),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify application access
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.applicationId },
        include: {
          environments: {
            where: { environment: "PRODUCTION" },
            take: 1,
          },
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      // Step 1: Search for relevant documentation chunks
      console.log("[generateTool] Starting RAG search:", {
        tenantId: ctx.tenant.tenantId,
        applicationId: input.applicationId,
        intent: input.intent,
      });

      // NOTE: Using low similarity threshold (0.3) because stored embeddings
      // may have been created with a different model. TODO: Re-embed documents
      // with text-embedding-3-small for proper similarity scores.
      const ragResult = await searchChunks({
        tenantId: ctx.tenant.tenantId,
        applicationId: input.applicationId,
        query: input.intent,
        limit: 5,
        minSimilarity: 0.3, // Lowered due to embedding model mismatch
      });

      console.log("[generateTool] RAG result:", {
        chunksFound: ragResult.chunks.length,
        queryEmbeddingMs: ragResult.queryEmbeddingMs,
        searchMs: ragResult.searchMs,
      });

      if (ragResult.chunks.length === 0) {
        return {
          success: false,
          error: "no_documentation",
          message:
            "No relevant API documentation found for this intent. " +
            "Please add documentation that describes the API endpoint you want to create a tool for.",
        };
      }

      // Step 2: Format documentation for Claude
      const documentationContext = formatChunksForContext(ragResult.chunks);
      const sources = chunksToSources(ragResult.chunks);

      // Step 3: Build Claude prompt
      const systemPrompt = `You are an expert API tool designer for SierraMCP. Your job is to generate complete ToolSpec JSON definitions from user intent and API documentation.

CRITICAL APPROACH - ALWAYS GENERATE A TOOLSPEC:
Even if documentation is incomplete, ALWAYS generate a best-guess ToolSpec. Make reasonable assumptions based on:
- Common REST API patterns (e.g., GET /resources/{id} for "get by ID")
- The user's intent (e.g., "Get customer" → GET method, "Create order" → POST method)
- Standard naming conventions

Mark ALL assumptions in the "assumptions" array so the user knows what to review.

RULES:
1. ALWAYS generate a complete ToolSpec - never refuse or return an error
2. Use documentation when available, but make educated guesses when it's incomplete
3. Mark each assumption with the field path and what was assumed
4. Infer HTTP method from intent: "Get/List/Search" → GET, "Create/Add" → POST, "Update/Edit" → PUT/PATCH, "Delete/Remove" → DELETE
5. Use common path patterns: /api/v1/{resource}s/{id} for single item, /api/v1/{resource}s for collections
6. Generate 2-3 REALISTIC test cases with actual sample values (not placeholders like "string" or "example")

TEST CASE REQUIREMENTS:
- Use realistic sample data from the documentation or domain (e.g., actual customer IDs, real-looking names)
- Include a "happy path" test case (expected success)
- Include an "error case" test case if applicable (e.g., not found, invalid input)
- For path parameters, use realistic IDs (e.g., "12345", "cust_abc123")
- For query parameters, use realistic filter values
- expectedBodyContains should check for specific fields that indicate success

ToolSpec Schema (include ALL fields):
{
  "applicationId": "uuid",
  "version": 1,
  "status": "DRAFT",
  "name": "snake_case_name",
  "title": "Human Readable Title",
  "description": "Clear description for LLM understanding",
  "http": {
    "method": "GET|POST|PUT|PATCH|DELETE",
    "path": "/api/path/{param}"
  },
  "auth": {
    "type": "oauth2|apiKey|basic|bearer|none",
    "scopes": ["optional", "scopes"]
  },
  "inputs": {
    "path": { "type": "object", "properties": {}, "required": [] },
    "query": { "type": "object", "properties": {}, "required": [] },
    "headers": { "type": "object", "properties": {}, "required": [] },
    "body": { "type": "object", "properties": {}, "required": [] }
  },
  "outputs": {
    "success": { "type": "object", "properties": {} },
    "errors": [{ "status": 404, "code": "NOT_FOUND", "description": "..." }]
  },
  "safety": {
    "readOnly": true|false,
    "destructive": true|false,
    "pii": true|false
  },
  "examples": {
    "request": { "path": {}, "query": {}, "headers": {}, "body": {} },
    "response": {}
  },
  "testCases": [
    {
      "name": "Successfully retrieve customer by ID",
      "inputs": { "path": { "customerId": "12345" }, "query": {}, "headers": {}, "body": {} },
      "expectedStatus": 200,
      "expectedBodyContains": { "id": "12345" }
    },
    {
      "name": "Customer not found returns 404",
      "inputs": { "path": { "customerId": "nonexistent" }, "query": {}, "headers": {}, "body": {} },
      "expectedStatus": 404,
      "expectedBodyContains": {}
    }
  ],
  "sources": [{ "docId": "doc-uuid", "chunkId": "chunk-uuid", "excerpt": "relevant text" }],
  "assumptions": [
    { "field": "http.path", "assumed": "/api/customers/{id}", "reason": "Standard REST pattern for single resource" },
    { "field": "http.method", "assumed": "GET", "reason": "Inferred from 'Get customer' intent" }
  ],
  "confidence": "high|medium|low"
}

Set confidence based on how much was found in documentation:
- "high": Most fields found in docs, few assumptions
- "medium": Some fields from docs, several assumptions
- "low": Mostly assumptions, minimal documentation match

ONLY as a last resort, if you truly cannot make any reasonable guess (e.g., completely unrelated documentation), respond with:
{
  "error": "missing_info",
  "missing": ["list", "of", "missing", "fields"],
  "question": "A clarifying question for the user"
}`;

      const userPrompt = `Generate a ToolSpec for this intent: "${input.intent}"

Application ID: ${input.applicationId}

API Documentation (use these sources in your response):
${documentationContext}

Source IDs to include in your response:
${sources.map((s) => `- docId: ${s.docId}, chunkId: ${s.chunkId}`).join("\n")}

Respond with ONLY valid JSON. No markdown, no explanation.`;

      try {
        const response = await invokeClaude(systemPrompt, userPrompt, 4096);
        const parsed = extractJson(response);

        // Check if it's an error response
        if (
          parsed &&
          typeof parsed === "object" &&
          "error" in parsed &&
          (parsed as { error: string }).error === "missing_info"
        ) {
          const errorResponse = parsed as {
            error: string;
            missing: string[];
            question: string;
          };
          return {
            success: false,
            error: "missing_info",
            missing: errorResponse.missing,
            question: errorResponse.question,
          };
        }

        // Extract the generated ToolSpec and metadata
        const rawSpec = parsed as ToolSpec & {
          assumptions?: Array<{ field: string; assumed: string; reason: string }>;
          confidence?: "high" | "medium" | "low";
        };

        // Extract assumptions and confidence before cleaning up the toolSpec
        const assumptions = rawSpec.assumptions || [];
        const confidence = rawSpec.confidence || "medium";

        // Create a clean toolSpec without the metadata fields
        const { assumptions: _, confidence: __, ...toolSpec } = rawSpec as ToolSpec & {
          assumptions?: unknown;
          confidence?: unknown;
        };

        // Ensure applicationId is set
        toolSpec.applicationId = input.applicationId;

        // Ensure sources are included (use from RAG if not in response)
        if (!toolSpec.sources || toolSpec.sources.length === 0) {
          toolSpec.sources = sources;
        }

        const validationErrors = validateToolSpec(toolSpec);
        if (validationErrors.length > 0) {
          console.error("ToolSpec validation errors:", validationErrors);
          return {
            success: false,
            error: "validation_failed",
            errors: validationErrors,
            message: "Generated tool failed validation: " + validationErrors.map((e) => e.message).join(", "),
          };
        }

        return {
          success: true,
          toolSpec,
          assumptions,
          confidence,
          sources: ragResult.chunks.map((c) => ({
            chunkId: c.id,
            documentId: c.documentId,
            documentTitle: c.documentTitle,
            excerpt: c.content.substring(0, 300),
            similarity: c.similarity,
          })),
          ragStats: {
            chunksRetrieved: ragResult.chunks.length,
            totalTokens: ragResult.totalTokens,
            queryEmbeddingMs: ragResult.queryEmbeddingMs,
            searchMs: ragResult.searchMs,
          },
        };
      } catch (error) {
        console.error("Failed to generate tool:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to generate tool from intent",
        });
      }
    }),

  /**
   * Generate a tool with automatic testing and iteration.
   * This agentic flow:
   * 1. Generates initial tool spec from intent
   * 2. Automatically runs a test against the environment
   * 3. If test fails, diagnoses the issue and fixes the spec
   * 4. Iterates until success or max attempts
   * 5. Returns the full iteration history for UI display
   */
  generateToolWithTesting: protectedProcedure
    .input(
      z.object({
        applicationId: z.string().uuid(),
        intent: z.string().min(5).max(500),
        environmentId: z.string().uuid().optional(), // If not provided, will use first available sandbox/dev env
        maxIterations: z.number().min(1).max(5).default(3),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const steps: IterationStep[] = [];
      const addStep = (type: IterationStep["type"], message: string, details?: unknown) => {
        steps.push({ type, message, details, timestamp: Date.now() });
      };

      // Step 1: Verify application and get environment
      const application = await ctx.tenant.db.application.findUnique({
        where: { id: input.applicationId },
        include: {
          environments: true,
        },
      });

      if (!application) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Application not found",
        });
      }

      // Find the environment to test against
      let environment = application.environments.find((e) => e.id === input.environmentId);
      if (!environment) {
        // Default to sandbox/development, then any available
        environment =
          application.environments.find((e) => e.environment === "SANDBOX") ||
          application.environments.find((e) => e.environment === "DEVELOPMENT") ||
          application.environments[0];
      }

      if (!environment) {
        addStep("error", "No environment configured for testing. Please add an environment first.");
        return {
          success: false,
          steps,
          error: "no_environment",
          message: "No environment configured. Add an environment to enable automatic testing.",
        };
      }

      addStep("generate", `Starting tool generation for: "${input.intent}"`);

      // Step 2: Search for relevant documentation
      const ragResult = await searchChunks({
        tenantId: ctx.tenant.tenantId,
        applicationId: input.applicationId,
        query: input.intent,
        limit: 5,
        minSimilarity: 0.3,
      });

      if (ragResult.chunks.length === 0) {
        addStep("error", "No API documentation found. Please upload documentation for this API.");
        return {
          success: false,
          steps,
          error: "no_documentation",
          message: "No relevant API documentation found. Please add documentation first.",
        };
      }

      addStep("generate", `Found ${ragResult.chunks.length} relevant documentation chunks`);

      const documentationContext = formatChunksForContext(ragResult.chunks);
      const sources = chunksToSources(ragResult.chunks);

      let currentSpec: ToolSpec | null = null;
      let lastTestResult: TestExecutionResult | null = null;
      let iteration = 0;

      // Agentic loop: generate → test → fix → repeat
      while (iteration < input.maxIterations) {
        iteration++;

        if (iteration === 1) {
          // Initial generation
          addStep("generate", "Generating initial tool definition...");

          const systemPrompt = `You are an expert API tool designer for SierraMCP. Generate a complete ToolSpec JSON from the user's intent and API documentation.

CRITICAL RULES:
1. Use the exact paths and methods from the documentation
2. Pay close attention to HTTP methods - check the documentation carefully
3. Generate realistic test inputs based on the documentation
4. The tool will be automatically tested - make sure the spec is correct

ToolSpec Schema:
{
  "applicationId": "uuid",
  "version": 1,
  "status": "DRAFT",
  "name": "snake_case_name",
  "title": "Human Readable Title",
  "description": "Clear description",
  "http": { "method": "GET|POST|PUT|PATCH|DELETE", "path": "/api/path/{param}" },
  "auth": { "type": "oauth2|apiKey|basic|bearer|none", "scopes": [] },
  "inputs": {
    "path": { "type": "object", "properties": {}, "required": [] },
    "query": { "type": "object", "properties": {}, "required": [] },
    "headers": { "type": "object", "properties": {}, "required": [] },
    "body": { "type": "object", "properties": {}, "required": [] }
  },
  "outputs": {
    "success": { "type": "object", "properties": {} },
    "errors": [{ "status": 404, "code": "NOT_FOUND", "description": "..." }]
  },
  "safety": { "readOnly": true|false, "destructive": true|false, "pii": true|false },
  "examples": { "request": { "path": {}, "query": {}, "headers": {}, "body": {} }, "response": {} },
  "testCases": [
    { "name": "Test name", "inputs": { "path": {}, "query": {}, "headers": {}, "body": {} }, "expectedStatus": 200, "expectedBodyContains": {} }
  ],
  "sources": [{ "docId": "uuid", "chunkId": "uuid", "excerpt": "text" }]
}

Respond with ONLY valid JSON.`;

          const userPrompt = `Generate a ToolSpec for: "${input.intent}"

Application ID: ${input.applicationId}

API Documentation:
${documentationContext}

Source IDs:
${sources.map((s) => `- docId: ${s.docId}, chunkId: ${s.chunkId}`).join("\n")}`;

          try {
            const response = await invokeClaude(systemPrompt, userPrompt, 4096);
            const parsed = extractJson(response) as ToolSpec;

            if (!parsed || !parsed.http) {
              addStep("error", "Failed to generate valid tool specification");
              return { success: false, steps, error: "generation_failed", message: "Could not generate valid tool spec" };
            }

            parsed.applicationId = input.applicationId;
            if (!parsed.sources || parsed.sources.length === 0) {
              parsed.sources = sources;
            }

            currentSpec = parsed;
            addStep("generate", `Generated tool: ${parsed.title || parsed.name}`, {
              httpMethod: parsed.http.method,
              path: parsed.http.path,
            });
          } catch (error) {
            addStep("error", `Generation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
            return { success: false, steps, error: "generation_failed", message: "Tool generation failed" };
          }
        } else {
          // Fix based on test failure
          addStep("fix", `Iteration ${iteration}: Analyzing failure and adjusting...`);

          const fixSystemPrompt = `You are debugging an API tool that failed testing. Analyze the error and fix the ToolSpec.

COMMON ISSUES AND FIXES:
- HTTP 405 Method Not Allowed: Wrong HTTP method. Check documentation for correct method (GET vs POST, etc.)
- HTTP 404 Not Found: Wrong path or missing path parameters. Check the exact path in documentation.
- HTTP 400 Bad Request: Missing required parameters or wrong format. Check required fields.
- HTTP 401/403: Authentication issue - tool spec may be correct, just missing credentials.

Current ToolSpec:
${JSON.stringify(currentSpec, null, 2)}

Last Test Result:
- URL: ${lastTestResult?.requestUrl}
- Method: ${lastTestResult?.requestMethod}
- Status: ${lastTestResult?.httpStatusCode}
- Error: ${lastTestResult?.errorMessage}
- Response: ${JSON.stringify(lastTestResult?.responseBody)?.substring(0, 500)}

API Documentation:
${documentationContext}

Fix the ToolSpec and respond with ONLY the complete updated JSON.`;

          try {
            const response = await invokeClaude(fixSystemPrompt, "Fix the tool based on the test failure.", 4096);
            const fixedSpec = extractJson(response) as ToolSpec;

            if (fixedSpec && fixedSpec.http) {
              fixedSpec.applicationId = input.applicationId;
              if (!fixedSpec.sources || fixedSpec.sources.length === 0) {
                fixedSpec.sources = sources;
              }

              const changes: string[] = [];
              if (currentSpec?.http?.method !== fixedSpec.http.method) {
                changes.push(`HTTP method: ${currentSpec?.http?.method} → ${fixedSpec.http.method}`);
              }
              if (currentSpec?.http?.path !== fixedSpec.http.path) {
                changes.push(`Path: ${currentSpec?.http?.path} → ${fixedSpec.http.path}`);
              }

              currentSpec = fixedSpec;
              addStep("fix", changes.length > 0 ? `Applied fixes: ${changes.join(", ")}` : "Made adjustments to the tool");
            }
          } catch (error) {
            addStep("error", `Fix attempt failed: ${error instanceof Error ? error.message : "Unknown error"}`);
          }
        }

        if (!currentSpec) {
          break;
        }

        // Run test
        addStep("test", `Testing against ${environment.environment} (${environment.baseUrl})...`);

        // Get test inputs from first test case or examples
        const testCase = currentSpec.testCases?.[0];
        const testInputs: Record<string, unknown> = testCase
          ? {
              ...(testCase.inputs?.path || {}),
              ...(testCase.inputs?.query || {}),
              ...(testCase.inputs?.body || {}),
            }
          : {};

        lastTestResult = await executeToolTest(currentSpec, testInputs, {
          baseUrl: environment.baseUrl,
          authType: environment.authType,
          secretArn: environment.secretArn,
        });

        if (lastTestResult.success) {
          addStep("success", `Test passed! Status ${lastTestResult.httpStatusCode} in ${lastTestResult.durationMs}ms`, {
            statusCode: lastTestResult.httpStatusCode,
            durationMs: lastTestResult.durationMs,
          });

          // Validate and return success
          const validationErrors = validateToolSpec(currentSpec);
          if (validationErrors.length > 0) {
            console.warn("Validation warnings:", validationErrors);
          }

          return {
            success: true,
            steps,
            toolSpec: currentSpec,
            testResult: {
              success: true,
              httpStatusCode: lastTestResult.httpStatusCode,
              durationMs: lastTestResult.durationMs,
              responsePreview: JSON.stringify(lastTestResult.responseBody)?.substring(0, 500),
            },
            iterations: iteration,
            sources: ragResult.chunks.map((c) => ({
              chunkId: c.id,
              documentId: c.documentId,
              documentTitle: c.documentTitle,
              excerpt: c.content.substring(0, 300),
              similarity: c.similarity,
            })),
          };
        } else {
          // Explain the error in user-friendly terms
          let userFriendlyError = lastTestResult.errorMessage || "Test failed";
          if (lastTestResult.httpStatusCode === 405) {
            userFriendlyError = `The API doesn't accept ${lastTestResult.requestMethod} requests at this endpoint. Checking documentation for correct method...`;
          } else if (lastTestResult.httpStatusCode === 404) {
            userFriendlyError = `Endpoint not found at ${lastTestResult.requestUrl}. Checking documentation for correct path...`;
          } else if (lastTestResult.httpStatusCode === 401 || lastTestResult.httpStatusCode === 403) {
            userFriendlyError = `Authentication failed. Please check your credentials are configured correctly.`;
          }

          addStep("test", `Test failed (HTTP ${lastTestResult.httpStatusCode}): ${userFriendlyError}`, {
            statusCode: lastTestResult.httpStatusCode,
            error: lastTestResult.errorMessage,
          });
        }
      }

      // Max iterations reached without success
      addStep("error", `Could not create a working tool after ${iteration} attempts. The tool may need manual adjustment.`);

      return {
        success: false,
        steps,
        toolSpec: currentSpec,
        testResult: lastTestResult
          ? {
              success: false,
              httpStatusCode: lastTestResult.httpStatusCode,
              durationMs: lastTestResult.durationMs,
              error: lastTestResult.errorMessage,
            }
          : null,
        iterations: iteration,
        error: "max_iterations",
        message: "Could not create a working tool automatically. Please review the generated spec and test manually.",
        sources: ragResult.chunks.map((c) => ({
          chunkId: c.id,
          documentId: c.documentId,
          documentTitle: c.documentTitle,
          excerpt: c.content.substring(0, 300),
          similarity: c.similarity,
        })),
      };
    }),

  /**
   * Refine an existing tool with natural language instruction.
   * Preserves source grounding while applying user's refinement.
   */
  refineTool: protectedProcedure
    .input(
      z.object({
        toolId: z.string().uuid(),
        instruction: z.string().min(5).max(1000),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Load existing tool
      const tool = await ctx.tenant.db.tool.findUnique({
        where: { id: input.toolId },
        include: {
          application: true,
        },
      });

      if (!tool) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tool not found",
        });
      }

      if (tool.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only DRAFT tools can be refined. Create a new version first.",
        });
      }

      // Get existing sources
      const existingSources = (tool.sources as unknown as ToolSpecSource[]) || [];
      const existingChunkIds = existingSources.map((s) => s.chunkId);

      // Retrieve original documentation chunks
      let originalChunks: RagChunk[] = [];
      if (existingChunkIds.length > 0) {
        originalChunks = await getChunksByIds(ctx.tenant.tenantId, existingChunkIds);
      }

      // Optionally search for additional relevant chunks based on instruction
      const additionalSearch = await searchChunks({
        tenantId: ctx.tenant.tenantId,
        applicationId: tool.applicationId,
        query: input.instruction,
        limit: 3,
        minSimilarity: 0.7,
      });

      // Combine chunks, avoiding duplicates
      const allChunks = [...originalChunks];
      for (const chunk of additionalSearch.chunks) {
        if (!existingChunkIds.includes(chunk.id)) {
          allChunks.push(chunk);
        }
      }

      const documentationContext = formatChunksForContext(allChunks);

      // Build current ToolSpec from tool record
      const currentSpec = tool.spec as unknown as ToolSpec;

      const systemPrompt = `You are refining an existing API tool definition for SierraMCP. Apply the user's instruction while maintaining grounding in the documentation.

CRITICAL RULES:
1. Preserve all existing source citations
2. Only add new sources if you reference new documentation
3. Keep the tool grounded in the documentation - don't invent endpoints
4. Output ONLY valid JSON matching the ToolSpec schema
5. Preserve the applicationId, version, and status from the current spec

Current ToolSpec Schema matches what you received - update it according to the instruction.`;

      const userPrompt = `Current ToolSpec:
${JSON.stringify(currentSpec, null, 2)}

Documentation Context:
${documentationContext}

User Instruction: "${input.instruction}"

Apply the instruction and respond with the complete updated ToolSpec JSON. No markdown, no explanation.`;

      try {
        const response = await invokeClaude(systemPrompt, userPrompt, 4096);
        const updatedSpec = extractJson(response) as ToolSpec;

        // Preserve critical fields
        updatedSpec.applicationId = tool.applicationId;
        updatedSpec.version = tool.version;
        updatedSpec.status = "DRAFT";

        // Merge sources (keep original + any new ones)
        const newSourceIds = new Set((updatedSpec.sources || []).map((s) => s.chunkId));
        for (const source of existingSources) {
          if (!newSourceIds.has(source.chunkId)) {
            updatedSpec.sources = updatedSpec.sources || [];
            updatedSpec.sources.push(source);
          }
        }

        const validationErrors = validateToolSpec(updatedSpec);
        if (validationErrors.length > 0) {
          console.error("Refined ToolSpec validation errors:", validationErrors);
          return {
            success: false,
            error: "validation_failed",
            errors: validationErrors,
            message: "Refined tool failed validation: " + validationErrors.map((e) => e.message).join(", "),
          };
        }

        // Save the updated tool to the database
        await ctx.tenant.db.tool.update({
          where: { id: input.toolId },
          data: {
            name: updatedSpec.name,
            title: updatedSpec.title,
            displayName: updatedSpec.title,
            description: updatedSpec.description,
            httpMethod: updatedSpec.http?.method || "GET",
            pathTemplate: updatedSpec.http?.path || "/",
            readOnly: updatedSpec.safety?.readOnly ?? true,
            destructive: updatedSpec.safety?.destructive ?? false,
            pii: updatedSpec.safety?.pii ?? false,
            spec: updatedSpec as unknown as Prisma.InputJsonValue,
            sources: updatedSpec.sources as unknown as Prisma.InputJsonValue,
            testCases: updatedSpec.testCases as unknown as Prisma.InputJsonValue,
            examples: updatedSpec.examples as unknown as Prisma.InputJsonValue,
          },
        });

        // Generate a summary of what changed
        const summary = `Updated tool based on: "${input.instruction.substring(0, 50)}${input.instruction.length > 50 ? "..." : ""}"`;

        return {
          success: true,
          toolSpec: updatedSpec,
          sourcesAdded: additionalSearch.chunks.length,
          summary,
        };
      } catch (error) {
        console.error("Failed to refine tool:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: error instanceof Error ? error.message : "Failed to refine tool",
        });
      }
    }),
});
