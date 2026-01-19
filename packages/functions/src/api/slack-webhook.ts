/**
 * Slack Webhook Handler
 *
 * Lambda handler for receiving Slack Events API webhooks.
 * Handles:
 * - URL verification challenges
 * - Message events (app_mention, message.im)
 * - Slash commands
 *
 * Authentication:
 * - Verifies Slack request signatures
 * - Uses ChatRoute to determine deployment
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@repo/db";
import { processChat, type ChatRequest, type ChatMessage } from "../services/chat-gateway";

// =============================================================================
// TYPES
// =============================================================================

interface SlackEvent {
  type: string;
  team_id?: string;
  event?: {
    type: string;
    user: string;
    text: string;
    channel: string;
    ts: string;
    thread_ts?: string;
    bot_id?: string;
  };
  challenge?: string;
}

interface SlackSlashCommand {
  command: string;
  text: string;
  user_id: string;
  channel_id: string;
  team_id: string;
  response_url: string;
}

// =============================================================================
// SIGNATURE VERIFICATION
// =============================================================================

function verifySlackSignature(
  signingSecret: string,
  signature: string,
  timestamp: string,
  body: string
): boolean {
  // Check timestamp to prevent replay attacks (5 minute window)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false;
  }

  // Compute expected signature
  const sigBasestring = `v0:${timestamp}:${body}`;
  const mySignature = `v0=${createHmac("sha256", signingSecret)
    .update(sigBasestring)
    .digest("hex")}`;

  // Compare signatures
  try {
    return timingSafeEqual(
      Buffer.from(mySignature, "utf8"),
      Buffer.from(signature, "utf8")
    );
  } catch {
    return false;
  }
}

// =============================================================================
// MESSAGE PROCESSING
// =============================================================================

/**
 * Clean up message text (remove bot mentions, etc.)
 */
function cleanMessageText(text: string): string {
  // Remove @mentions
  return text.replace(/<@[A-Z0-9]+>/g, "").trim();
}

/**
 * Post a message back to Slack
 */
async function postSlackMessage(
  token: string,
  channel: string,
  text: string,
  threadTs?: string
): Promise<void> {
  const payload: Record<string, unknown> = {
    channel,
    text,
  };

  if (threadTs) {
    payload.thread_ts = threadTs;
  }

  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error("Failed to post Slack message:", await response.text());
  }
}

/**
 * Get conversation history for context
 */
async function getConversationHistory(
  token: string,
  channel: string,
  threadTs: string,
  limit: number = 10
): Promise<ChatMessage[]> {
  const url = new URL("https://slack.com/api/conversations.replies");
  url.searchParams.set("channel", channel);
  url.searchParams.set("ts", threadTs);
  url.searchParams.set("limit", String(limit));

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    return [];
  }

  const data = (await response.json()) as {
    ok: boolean;
    messages?: Array<{ user: string; text: string; bot_id?: string }>;
  };

  if (!data.ok || !data.messages) {
    return [];
  }

  // Convert to ChatMessage format, excluding the current message
  return data.messages.slice(0, -1).map((msg) => ({
    role: msg.bot_id ? "assistant" : "user",
    content: msg.text,
  })) as ChatMessage[];
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

async function handleUrlVerification(event: SlackEvent): Promise<APIGatewayProxyResultV2> {
  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ challenge: event.challenge }),
  };
}

async function handleMessageEvent(
  event: SlackEvent,
  botToken: string
): Promise<APIGatewayProxyResultV2> {
  const slackEvent = event.event;
  if (!slackEvent || !event.team_id) {
    return { statusCode: 200, body: "" };
  }

  // Ignore bot messages to prevent loops
  if (slackEvent.bot_id) {
    return { statusCode: 200, body: "" };
  }

  // Build chat request
  const chatRequest: ChatRequest = {
    platform: "slack",
    workspaceId: event.team_id,
    channelId: slackEvent.channel,
    userId: slackEvent.user,
    threadId: slackEvent.thread_ts || slackEvent.ts,
    message: cleanMessageText(slackEvent.text),
  };

  // Get conversation history if in a thread
  if (slackEvent.thread_ts) {
    chatRequest.history = await getConversationHistory(
      botToken,
      slackEvent.channel,
      slackEvent.thread_ts
    );
  }

  // Process the message
  const response = await processChat(chatRequest);

  // Post response to Slack
  const replyText = response.success
    ? response.message
    : `❌ ${response.error || "An error occurred"}`;

  await postSlackMessage(
    botToken,
    slackEvent.channel,
    replyText,
    slackEvent.thread_ts || slackEvent.ts
  );

  return { statusCode: 200, body: "" };
}

async function handleSlashCommand(
  command: SlackSlashCommand,
  botToken: string
): Promise<APIGatewayProxyResultV2> {
  // Build chat request
  const chatRequest: ChatRequest = {
    platform: "slack",
    workspaceId: command.team_id,
    channelId: command.channel_id,
    userId: command.user_id,
    message: command.text,
  };

  // Process the message
  const response = await processChat(chatRequest);

  // For slash commands, we can respond directly or use response_url
  // Using response_url allows longer processing time
  const replyText = response.success
    ? response.message
    : `❌ ${response.error || "An error occurred"}`;

  // Respond via response_url for async
  await fetch(command.response_url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      response_type: "in_channel",
      text: replyText,
    }),
  });

  // Return empty 200 to Slack immediately
  return { statusCode: 200, body: "" };
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  // Get secrets
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const botToken = process.env.SLACK_BOT_TOKEN;

  if (!signingSecret || !botToken) {
    console.error("Slack credentials not configured");
    return { statusCode: 500, body: "Server configuration error" };
  }

  // Verify request signature
  const signature = event.headers["x-slack-signature"];
  const timestamp = event.headers["x-slack-request-timestamp"];
  const body = event.body || "";

  if (!signature || !timestamp) {
    return { statusCode: 401, body: "Missing signature" };
  }

  if (!verifySlackSignature(signingSecret, signature, timestamp, body)) {
    return { statusCode: 401, body: "Invalid signature" };
  }

  // Parse body based on content type
  const contentType = event.headers["content-type"] || "";

  try {
    if (contentType.includes("application/json")) {
      // Events API
      const slackEvent = JSON.parse(body) as SlackEvent;

      if (slackEvent.type === "url_verification") {
        return handleUrlVerification(slackEvent);
      }

      if (slackEvent.type === "event_callback" && slackEvent.event) {
        // Acknowledge immediately, process async
        // Note: For production, use SQS for async processing
        setImmediate(() => {
          handleMessageEvent(slackEvent, botToken).catch(console.error);
        });
        return { statusCode: 200, body: "" };
      }

      return { statusCode: 200, body: "" };
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      // Slash commands
      const params = new URLSearchParams(body);
      const command: SlackSlashCommand = {
        command: params.get("command") || "",
        text: params.get("text") || "",
        user_id: params.get("user_id") || "",
        channel_id: params.get("channel_id") || "",
        team_id: params.get("team_id") || "",
        response_url: params.get("response_url") || "",
      };

      // Acknowledge immediately, process async
      setImmediate(() => {
        handleSlashCommand(command, botToken).catch(console.error);
      });

      return { statusCode: 200, body: "" };
    }

    return { statusCode: 400, body: "Unsupported content type" };
  } catch (error) {
    console.error("Slack webhook error:", error);
    return { statusCode: 500, body: "Internal error" };
  }
}

// =============================================================================
// OAUTH HANDLERS (for installation flow)
// =============================================================================

export async function oauthHandler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const code = event.queryStringParameters?.code;
  if (!code) {
    return { statusCode: 400, body: "Missing code" };
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret) {
    return { statusCode: 500, body: "OAuth not configured" };
  }

  try {
    // Exchange code for token
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri || "",
      }),
    });

    const data = (await response.json()) as {
      ok: boolean;
      team?: { id: string; name: string };
      access_token?: string;
      bot_user_id?: string;
      error?: string;
    };

    if (!data.ok) {
      console.error("OAuth error:", data.error);
      return { statusCode: 400, body: `OAuth failed: ${data.error}` };
    }

    // Store the workspace connection
    // In production, store access_token securely and associate with tenant
    console.log(`Slack workspace connected: ${data.team?.name} (${data.team?.id})`);

    // Redirect to success page
    return {
      statusCode: 302,
      headers: {
        Location: `${process.env.NEXT_PUBLIC_APP_URL}/settings/integrations?slack=success`,
      },
      body: "",
    };
  } catch (error) {
    console.error("OAuth exchange error:", error);
    return { statusCode: 500, body: "OAuth exchange failed" };
  }
}
