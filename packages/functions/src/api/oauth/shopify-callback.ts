/**
 * Shopify OAuth Callback Handler
 *
 * Lambda handler for receiving Shopify's OAuth redirect after user authorization.
 * Validates state, exchanges authorization code for access token, and stores credentials.
 *
 * @version 3 - Force rebuild with Prisma engine
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { Resource } from "sst";
import { prisma } from "@repo/db";
import { createHmac } from "crypto";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

// Get app URL for redirects
const APP_URL = process.env.APP_URL || "https://app.sierramcp.com";

// Interface for Shopify token response
interface ShopifyTokenResponse {
  access_token: string;
  scope: string;
}

/**
 * Verify Shopify's HMAC signature on the callback
 */
function verifyHmac(
  query: Record<string, string | undefined>,
  clientSecret: string
): boolean {
  const hmac = query.hmac;
  if (!hmac) return false;

  // Build message by sorting query params (excluding hmac)
  const entries = Object.entries(query)
    .filter(([key]) => key !== "hmac")
    .sort(([a], [b]) => a.localeCompare(b));

  const message = entries
    .map(([key, value]) => `${key}=${value || ""}`)
    .join("&");

  const computed = createHmac("sha256", clientSecret)
    .update(message)
    .digest("hex");

  return computed === hmac;
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(
  shop: string,
  code: string,
  clientId: string,
  clientSecret: string
): Promise<ShopifyTokenResponse> {
  const response = await fetch(
    `https://${shop}.myshopify.com/admin/oauth/access_token`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Create redirect response
 */
function redirect(url: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 302,
    headers: {
      Location: url,
    },
    body: "",
  };
}

/**
 * Create error redirect
 */
function errorRedirect(
  applicationId: string,
  error: string
): APIGatewayProxyResultV2 {
  const url = new URL(`/applications/${applicationId}`, APP_URL);
  url.searchParams.set("oauth", "error");
  url.searchParams.set("error", error);
  return redirect(url.toString());
}

export async function handler(
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> {
  const query = event.queryStringParameters || {};
  const { code, state, shop, hmac } = query;

  console.log("Shopify OAuth callback received:", {
    hasCode: !!code,
    hasState: !!state,
    shop,
    hasHmac: !!hmac,
  });

  // Get Shopify credentials from SST Resource (linked via API gateway)
  const shopifyClientId = (
    Resource as unknown as { ShopifyClientId?: { value: string } }
  ).ShopifyClientId?.value;
  const shopifyClientSecret = (
    Resource as unknown as { ShopifyClientSecret?: { value: string } }
  ).ShopifyClientSecret?.value;

  if (!shopifyClientId || !shopifyClientSecret) {
    console.error("Shopify credentials not configured");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OAuth not configured" }),
    };
  }

  // Validate required parameters
  if (!code || !state || !shop) {
    console.error("Missing required OAuth parameters");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required parameters" }),
    };
  }

  // Verify HMAC signature from Shopify
  if (!verifyHmac(query as Record<string, string>, shopifyClientSecret)) {
    console.error("Invalid HMAC signature");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Invalid signature" }),
    };
  }

  try {
    // Look up OAuth state
    const oauthState = await prisma.oAuthState.findUnique({
      where: { state },
      include: {
        environment: {
          include: {
            application: true,
          },
        },
      },
    });

    if (!oauthState) {
      console.error("OAuth state not found:", state);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid or expired state" }),
      };
    }

    const applicationId = oauthState.environment.applicationId;

    // Verify state hasn't expired
    if (new Date() > oauthState.expiresAt) {
      console.error("OAuth state expired");
      await prisma.oAuthState.delete({ where: { id: oauthState.id } });
      return errorRedirect(applicationId, "expired");
    }

    // Verify state hasn't been used (single-use)
    if (oauthState.usedAt) {
      console.error("OAuth state already used");
      return errorRedirect(applicationId, "already_used");
    }

    // Verify shop matches
    const shopName = shop.replace(/\.myshopify\.com$/, "").toLowerCase();
    if (shopName !== oauthState.shop) {
      console.error("Shop mismatch:", { expected: oauthState.shop, got: shopName });
      return errorRedirect(applicationId, "shop_mismatch");
    }

    // Mark state as used
    await prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });

    // Exchange code for access token
    console.log("Exchanging code for access token...");
    const tokenResponse = await exchangeCodeForToken(
      shopName,
      code,
      shopifyClientId,
      shopifyClientSecret
    );

    console.log("Token obtained, scopes:", tokenResponse.scope);

    // Store access token in AWS Secrets Manager
    const secretsClient = new SecretsManagerClient({});
    const secretName = `gatemcp/${oauthState.tenantId}/${oauthState.environment.application.slug}/${oauthState.environment.environment.toLowerCase()}`;

    const secretValue = JSON.stringify({
      accessToken: tokenResponse.access_token,
      shop: `${shopName}.myshopify.com`,
      scopes: tokenResponse.scope,
      connectedAt: new Date().toISOString(),
    });

    let secretArn: string;

    try {
      if (oauthState.environment.secretArn) {
        // Update existing secret
        const result = await secretsClient.send(
          new UpdateSecretCommand({
            SecretId: oauthState.environment.secretArn,
            SecretString: secretValue,
          })
        );
        secretArn = result.ARN!;
      } else {
        // Create new secret
        const result = await secretsClient.send(
          new CreateSecretCommand({
            Name: secretName,
            SecretString: secretValue,
            Description: `Shopify OAuth credentials for ${oauthState.environment.application.name} - ${oauthState.environment.environment}`,
            Tags: [
              { Key: "tenant", Value: oauthState.tenantId },
              { Key: "application", Value: applicationId },
              { Key: "environment", Value: oauthState.environment.environment },
              { Key: "provider", Value: "shopify" },
            ],
          })
        );
        secretArn = result.ARN!;
      }
    } catch (error: any) {
      // If secret exists but we don't have ARN, try to update by name
      if (error.name === "ResourceExistsException") {
        const result = await secretsClient.send(
          new UpdateSecretCommand({
            SecretId: secretName,
            SecretString: secretValue,
          })
        );
        secretArn = result.ARN!;
      } else {
        throw error;
      }
    }

    // Update environment with OAuth connection info
    await prisma.applicationEnvironment.update({
      where: { id: oauthState.environmentId },
      data: {
        secretArn,
        oauthConnectedAt: new Date(),
        oauthShop: `${shopName}.myshopify.com`,
        lastTestedAt: new Date(),
        lastTestStatus: "OK",
        // Update baseUrl to use the connected shop
        baseUrl: `https://${shopName}.myshopify.com`,
      },
    });

    // Create audit log
    await prisma.auditLog.create({
      data: {
        action: "application.oauth.completed",
        entityType: "ApplicationEnvironment",
        entityId: oauthState.environmentId,
        tenantId: oauthState.tenantId,
        metadata: {
          shop: `${shopName}.myshopify.com`,
          applicationId,
          scopes: tokenResponse.scope,
        },
      },
    });

    // Clean up used OAuth state
    await prisma.oAuthState.delete({ where: { id: oauthState.id } });

    console.log("OAuth flow completed successfully for shop:", shopName);

    // Redirect to app with success
    const successUrl = new URL(`/applications/${applicationId}`, APP_URL);
    successUrl.searchParams.set("oauth", "success");
    successUrl.searchParams.set("shop", `${shopName}.myshopify.com`);

    return redirect(successUrl.toString());
  } catch (error) {
    console.error("OAuth callback error:", error);

    // Try to get application ID for error redirect
    try {
      const oauthState = await prisma.oAuthState.findUnique({
        where: { state },
        include: { environment: true },
      });
      if (oauthState) {
        return errorRedirect(
          oauthState.environment.applicationId,
          "token_exchange_failed"
        );
      }
    } catch {
      // Ignore errors looking up state for redirect
    }

    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OAuth flow failed" }),
    };
  }
}
