/**
 * Chat Gateway Service
 *
 * Orchestrates LLM interactions with MCP tools. This service:
 * - Routes incoming chat messages to appropriate deployments
 * - Uses Claude to understand user intent and select tools
 * - Executes tool calls via the MCP Runtime
 * - Formats and returns responses
 *
 * ARCHITECTURE:
 * - Invoked by platform-specific handlers (Slack, Teams, etc.)
 * - Uses ChatRoute to determine which deployment handles a channel
 * - Uses BotProfile to customize LLM behavior
 * - Streams responses via SSE when supported
 */

import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@repo/db";
import {
  invokeTool,
  listDeploymentTools,
  type ToolInvocationRequest,
  type ToolInvocationResult,
  type ToolListItem,
} from "./mcp-runtime";

// =============================================================================
// CONFIGURATION
// =============================================================================

const ANTHROPIC_MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOOL_CALLS = 10; // Maximum tool calls per message

// =============================================================================
// TYPES
// =============================================================================

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  // Platform identification
  platform: "slack" | "teams" | "web";
  workspaceId: string;
  channelId: string;
  userId: string;
  threadId?: string;

  // Message content
  message: string;

  // Conversation history (for context)
  history?: ChatMessage[];
}

export interface ChatResponse {
  success: boolean;
  message: string;
  toolCalls?: {
    toolName: string;
    success: boolean;
    duration: number;
  }[];
  error?: string;
}

interface RouteContext {
  route: {
    id: string;
    deploymentId: string;
    botProfileId: string | null;
  };
  deployment: {
    id: string;
    tenantId: string;
    mcpId: string;
    name: string;
  };
  botProfile: {
    systemPrompt: string;
    responseStyle: string;
    toolBehavior: string;
  } | null;
  tools: ToolListItem[];
}

// =============================================================================
// ROUTE RESOLUTION
// =============================================================================

/**
 * Map platform string to enum value
 */
function mapPlatformToEnum(platform: string): "SLACK" | "TEAMS" {
  return platform.toUpperCase() as "SLACK" | "TEAMS";
}

/**
 * Resolve the route context for an incoming chat request
 */
async function resolveRouteContext(
  request: ChatRequest
): Promise<RouteContext | null> {
  const platformEnum = mapPlatformToEnum(request.platform);

  // Find route for this channel
  let route = await prisma.chatRoute.findFirst({
    where: {
      platform: platformEnum,
      workspaceId: request.workspaceId,
      channelId: request.channelId,
      isActive: true,
    },
    include: {
      deployment: true,
      botProfile: true,
    },
  });

  // Fall back to workspace-level route if no channel-specific route
  if (!route) {
    route = await prisma.chatRoute.findFirst({
      where: {
        platform: platformEnum,
        workspaceId: request.workspaceId,
        channelId: null, // Workspace-level fallback
        isActive: true,
        isFallback: true,
      },
      include: {
        deployment: true,
        botProfile: true,
      },
    });
  }

  if (!route || !route.deployment || route.deployment.status !== "RUNNING") {
    return null;
  }

  // Get available tools for this deployment
  const tools = await listDeploymentTools(route.deploymentId!);

  return {
    route: {
      id: route.id,
      deploymentId: route.deploymentId!,
      botProfileId: route.botProfileId,
    },
    deployment: {
      id: route.deployment.id,
      tenantId: route.deployment.tenantId,
      mcpId: route.deployment.mcpId,
      name: route.deployment.name,
    },
    botProfile: route.botProfile
      ? {
          systemPrompt: route.botProfile.systemPrompt || "",
          responseStyle: route.botProfile.responseStyle,
          toolBehavior: route.botProfile.toolBehavior,
        }
      : null,
    tools,
  };
}

// =============================================================================
// TOOL FORMATTING
// =============================================================================

/**
 * Convert tool list to Anthropic tool format
 */
function formatToolsForClaude(tools: ToolListItem[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: `${tool.title}: ${tool.description}`,
    input_schema: {
      type: "object" as const,
      properties: {
        // Tools accept a generic inputs object since schemas vary
        inputs: {
          type: "object" as const,
          description: "Tool input parameters",
        },
      },
    },
  }));
}

/**
 * Build system prompt incorporating bot profile settings
 */
function buildSystemPrompt(
  context: RouteContext,
  tools: ToolListItem[]
): string {
  const parts: string[] = [];

  // Base prompt
  if (context.botProfile?.systemPrompt) {
    parts.push(context.botProfile.systemPrompt);
  } else {
    parts.push(
      "You are a helpful assistant with access to tools. " +
        "Use the available tools to help answer user questions. " +
        "Be concise and helpful in your responses."
    );
  }

  // Add tool behavior guidance
  const toolBehavior = context.botProfile?.toolBehavior || "AUTO";
  if (toolBehavior === "AUTO") {
    parts.push(
      "\nAutomatically use tools when they would help answer the user's question."
    );
  } else if (toolBehavior === "ASK") {
    parts.push(
      "\nBefore using any tool, briefly explain what you're about to do and confirm it's what the user wants."
    );
  } else if (toolBehavior === "MANUAL") {
    parts.push(
      "\nOnly use tools when the user explicitly asks you to use a specific tool."
    );
  }

  // Add response style guidance
  const responseStyle = context.botProfile?.responseStyle || "BALANCED";
  if (responseStyle === "CONCISE") {
    parts.push("\nKeep responses brief and to the point.");
  } else if (responseStyle === "DETAILED") {
    parts.push("\nProvide thorough explanations with context.");
  } else if (responseStyle === "TECHNICAL") {
    parts.push("\nUse technical language and include relevant details.");
  } else if (responseStyle === "FRIENDLY") {
    parts.push("\nBe warm and conversational in your responses.");
  }

  // Add safety reminders
  const dangerousTools = tools.filter(
    (t) => !t.safety.readOnly || t.safety.destructive || t.safety.pii
  );
  if (dangerousTools.length > 0) {
    parts.push(
      "\nSome tools can modify data or access sensitive information. " +
        "Use caution with: " +
        dangerousTools.map((t) => t.name).join(", ")
    );
  }

  // Add available tools summary
  parts.push("\n\nAvailable tools:");
  for (const tool of tools) {
    const flags: string[] = [];
    if (!tool.safety.readOnly) flags.push("writes");
    if (tool.safety.destructive) flags.push("destructive");
    if (tool.safety.pii) flags.push("PII");
    const flagStr = flags.length > 0 ? ` [${flags.join(", ")}]` : "";
    parts.push(`- ${tool.name}: ${tool.title}${flagStr}`);
  }

  return parts.join("\n");
}

// =============================================================================
// TOOL EXECUTION
// =============================================================================

/**
 * Execute a tool call from Claude and return the result
 */
async function executeToolCall(
  context: RouteContext,
  toolName: string,
  inputs: Record<string, unknown>,
  userId: string
): Promise<ToolInvocationResult> {
  const request: ToolInvocationRequest = {
    deploymentId: context.deployment.id,
    toolName,
    inputs: inputs.inputs as ToolInvocationRequest["inputs"] || {},
    tenantId: context.deployment.tenantId,
    userId,
  };

  return invokeTool(request);
}

// =============================================================================
// MAIN CHAT FUNCTION
// =============================================================================

/**
 * Process a chat message and return a response
 */
export async function processChat(
  request: ChatRequest
): Promise<ChatResponse> {
  // Resolve route context
  const context = await resolveRouteContext(request);

  if (!context) {
    return {
      success: false,
      message: "",
      error:
        "No active MCP deployment configured for this channel. " +
        "Please contact an administrator to set up the integration.",
    };
  }

  if (context.tools.length === 0) {
    return {
      success: false,
      message: "",
      error:
        "No tools are available for this deployment. " +
        "Please publish some tools first.",
    };
  }

  // Get Anthropic API key
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return {
      success: false,
      message: "",
      error: "Chat service is not properly configured",
    };
  }

  const anthropic = new Anthropic({ apiKey: anthropicApiKey });

  // Build messages array
  const messages: Anthropic.MessageParam[] = [];

  // Add history if provided
  if (request.history) {
    for (const msg of request.history) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  // Add current message
  messages.push({
    role: "user",
    content: request.message,
  });

  // Build system prompt and tools
  const systemPrompt = buildSystemPrompt(context, context.tools);
  const claudeTools = formatToolsForClaude(context.tools);

  // Track tool calls
  const toolCalls: ChatResponse["toolCalls"] = [];
  let toolCallCount = 0;

  try {
    // Initial Claude request
    let response = await anthropic.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: systemPrompt,
      tools: claudeTools,
      messages,
    });

    // Handle tool use loop
    while (
      response.stop_reason === "tool_use" &&
      toolCallCount < MAX_TOOL_CALLS
    ) {
      // Find tool use blocks
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      // Execute each tool
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        toolCallCount++;

        const result = await executeToolCall(
          context,
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          request.userId
        );

        toolCalls.push({
          toolName: toolUse.name,
          success: result.success,
          duration: result.duration,
        });

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(
            result.success ? result.data : { error: result.error }
          ),
          is_error: !result.success,
        });
      }

      // Continue conversation with tool results
      messages.push({
        role: "assistant",
        content: response.content,
      });

      messages.push({
        role: "user",
        content: toolResults,
      });

      // Get Claude's response to tool results
      response = await anthropic.messages.create({
        model: ANTHROPIC_MODEL,
        max_tokens: 4096,
        system: systemPrompt,
        tools: claudeTools,
        messages,
      });
    }

    // Extract final text response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    const finalMessage = textBlocks.map((b) => b.text).join("\n\n");

    // Record usage event
    await recordChatUsage(context, request, toolCalls);

    return {
      success: true,
      message: finalMessage,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  } catch (error) {
    console.error("Chat processing error:", error);

    return {
      success: false,
      message: "",
      error:
        error instanceof Error
          ? error.message
          : "An error occurred processing your request",
    };
  }
}

// =============================================================================
// USAGE TRACKING
// =============================================================================

async function recordChatUsage(
  context: RouteContext,
  request: ChatRequest,
  toolCalls: ChatResponse["toolCalls"]
): Promise<void> {
  try {
    await prisma.usageEvent.create({
      data: {
        tenantId: context.deployment.tenantId,
        mcpId: context.deployment.mcpId,
        deploymentId: context.deployment.id,
        platform: request.platform,
        workspaceId: request.workspaceId,
        channelId: request.channelId,
        userId: request.userId,
        requestCount: 1,
        success: true,
        metadata: {
          type: "chat",
          toolCallCount: toolCalls?.length || 0,
          threadId: request.threadId,
        },
      },
    });
  } catch (error) {
    console.error("Failed to record chat usage:", error);
  }
}

// =============================================================================
// STREAMING SUPPORT (for future use)
// =============================================================================

export interface StreamingChatCallback {
  onToken?: (token: string) => void;
  onToolStart?: (toolName: string) => void;
  onToolEnd?: (toolName: string, success: boolean) => void;
  onComplete?: (response: ChatResponse) => void;
  onError?: (error: Error) => void;
}

/**
 * Process a chat message with streaming support
 * Note: This is a placeholder for future streaming implementation
 */
export async function processChatStreaming(
  request: ChatRequest,
  callbacks: StreamingChatCallback
): Promise<void> {
  // For now, just call the non-streaming version
  try {
    const response = await processChat(request);
    callbacks.onComplete?.(response);
  } catch (error) {
    callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
  }
}
