/**
 * Stripe Webhook Handler
 *
 * Lambda handler for receiving Stripe webhook events.
 * Handles subscription lifecycle, payment events, and checkout completion.
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import {
  handleWebhookEvent,
  verifyWebhookSignature,
} from "../services/billing";

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  // Stripe signature verification
  const signature = event.headers["stripe-signature"];
  const body = event.body || "";

  if (!signature) {
    console.error("Missing Stripe signature");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing signature" }),
    };
  }

  try {
    // Verify and parse the webhook event
    const stripeEvent = verifyWebhookSignature(body, signature);

    console.log("Received Stripe event:", {
      type: stripeEvent.type,
      id: stripeEvent.id,
    });

    // Process the event
    const result = await handleWebhookEvent(stripeEvent);

    console.log("Webhook processed:", result);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        received: true,
        handled: result.handled,
        message: result.message,
      }),
    };
  } catch (error) {
    console.error("Stripe webhook error:", error);

    // Return 400 for signature verification errors
    // Stripe will retry on 4xx/5xx
    if (error instanceof Error && error.message.includes("signature")) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid signature" }),
      };
    }

    // Return 500 for processing errors (Stripe will retry)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Webhook processing failed" }),
    };
  }
}
