/**
 * Canva OAuth Callback Handler
 *
 * Copy to: packages/functions/src/api/oauth/canva-callback.ts
 *
 * Lambda handler for receiving Canva's OAuth redirect after user authorization.
 * Uses standard OAuth 2.0 authorization code flow with Canva's token endpoint.
 * Returns access_token, refresh_token, expires_in, token_type, and scope.
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

// Canva OAuth 2.0 token endpoint
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

// Interface for Canva OAuth token response
interface CanvaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

/**
 * Exchange authorization code for access and refresh tokens via Canva OAuth 2.0
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<CanvaTokenResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: "", // PKCE code verifier if used
    }).toString(),
  });

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
  const { code, state } = query;

  console.log("Canva OAuth callback received:", {
    hasCode: !!code,
    hasState: !!state,
  });

  // Get Canva credentials from SST Resource
  const canvaClientId = (
    Resource as unknown as { CanvaClientId?: { value: string } }
  ).CanvaClientId?.value;
  const canvaClientSecret = (
    Resource as unknown as { CanvaClientSecret?: { value: string } }
  ).CanvaClientSecret?.value;

  if (!canvaClientId || !canvaClientSecret) {
    console.error("Canva credentials not configured");
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
    const redirectUri = `${apiUrl}/oauth/canva/callback`;

    // Exchange code for access token
    console.log("Exchanging code for access token...");
    const tokenResponse = await exchangeCodeForToken(
      code,
      canvaClientId,
      canvaClientSecret,
      redirectUri
    );

    console.log("Tokens obtained, expires in:", tokenResponse.expires_in);

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Store tokens in AWS Secrets Manager
    const secretsClient = new SecretsManagerClient({});
    const secretName = `gatemcp/${oauthState.tenantId}/${oauthState.environment.application.slug}/${oauthState.environment.environment.toLowerCase()}`;

    const secretValue = JSON.stringify({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
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
            Description: `Canva credentials for ${oauthState.environment.application.name} - ${oauthState.environment.environment}`,
            Tags: [
              { Key: "tenant", Value: oauthState.tenantId },
              { Key: "application", Value: applicationId },
              { Key: "environment", Value: oauthState.environment.environment },
              { Key: "provider", Value: "canva" },
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
          provider: "canva",
        },
      },
    });

    // Clean up used OAuth state
    await prisma.oAuthState.delete({ where: { id: oauthState.id } });

    console.log("Canva OAuth flow completed successfully");

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
