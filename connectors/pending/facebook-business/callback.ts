/**
 * Facebook/Instagram Business OAuth Callback Handler
 *
 * Copy to: packages/functions/src/api/oauth/facebook-business-callback.ts
 *
 * Lambda handler for receiving Facebook's OAuth redirect after user authorization.
 * Uses standard OAuth 2.0 authorization code flow with Facebook's token endpoint.
 * After obtaining a short-lived token, exchanges it for a long-lived token (~60 days).
 */

import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { Resource } from "sst";
import { prisma } from "@repo/db";
import {
  SecretsManagerClient,
  CreateSecretCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";

// Get app URL for redirects
const APP_URL = process.env.APP_URL || "https://app.sierramcp.com";

// Facebook OAuth endpoints
const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";
const FACEBOOK_LONG_LIVED_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";

// Interface for Facebook OAuth token response
interface FacebookTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchange authorization code for a short-lived access token
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

/**
 * Exchange short-lived token for a long-lived token (~60 days)
 */
async function exchangeForLongLivedToken(
  shortLivedToken: string,
  clientId: string,
  clientSecret: string
): Promise<FacebookTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });

  const response = await fetch(`${FACEBOOK_LONG_LIVED_TOKEN_URL}?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Long-lived token exchange failed: ${response.status} ${errorText}`);
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
  const { code, state } = query;

  console.log("Facebook Business OAuth callback received:", {
    hasCode: !!code,
    hasState: !!state,
  });

  // Get Facebook credentials from SST Resource
  const facebookAppId = (
    Resource as unknown as { FacebookAppId?: { value: string } }
  ).FacebookAppId?.value;
  const facebookAppSecret = (
    Resource as unknown as { FacebookAppSecret?: { value: string } }
  ).FacebookAppSecret?.value;

  if (!facebookAppId || !facebookAppSecret) {
    console.error("Facebook credentials not configured");
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "OAuth not configured" }),
    };
  }

  // Validate required parameters
  if (!code || !state) {
    console.error("Missing required OAuth parameters");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "Missing required parameters" }),
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

    // Mark state as used
    await prisma.oAuthState.update({
      where: { id: oauthState.id },
      data: { usedAt: new Date() },
    });

    // Get API base URL for redirect
    const apiUrl = process.env.API_URL || "https://api.sierramcp.com";
    const redirectUri = `${apiUrl}/oauth/facebook-business/callback`;

    // Step 1: Exchange code for short-lived access token
    console.log("Exchanging code for short-lived access token...");
    const shortLivedToken = await exchangeCodeForToken(
      code,
      facebookAppId,
      facebookAppSecret,
      redirectUri
    );

    // Step 2: Exchange for long-lived token (~60 days)
    console.log("Exchanging for long-lived access token...");
    const longLivedToken = await exchangeForLongLivedToken(
      shortLivedToken.access_token,
      facebookAppId,
      facebookAppSecret
    );

    console.log("Long-lived token obtained, expires in:", longLivedToken.expires_in);

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000);

    // Store tokens in AWS Secrets Manager
    const secretsClient = new SecretsManagerClient({});
    const secretName = `gatemcp/${oauthState.tenantId}/${oauthState.environment.application.slug}/${oauthState.environment.environment.toLowerCase()}`;

    const secretValue = JSON.stringify({
      accessToken: longLivedToken.access_token,
      refreshToken: longLivedToken.access_token, // Facebook uses token exchange instead of refresh tokens
      expiresAt: expiresAt.toISOString(),
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
            Description: `Facebook Business credentials for ${oauthState.environment.application.name} - ${oauthState.environment.environment}`,
            Tags: [
              { Key: "tenant", Value: oauthState.tenantId },
              { Key: "application", Value: applicationId },
              { Key: "environment", Value: oauthState.environment.environment },
              { Key: "provider", Value: "facebook-business" },
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
        lastTestedAt: new Date(),
        lastTestStatus: "OK",
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
          applicationId,
          provider: "facebook-business",
        },
      },
    });

    // Clean up used OAuth state
    await prisma.oAuthState.delete({ where: { id: oauthState.id } });

    console.log("Facebook Business OAuth flow completed successfully");

    // Redirect to app with success
    const successUrl = new URL(`/applications/${applicationId}`, APP_URL);
    successUrl.searchParams.set("oauth", "success");

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
