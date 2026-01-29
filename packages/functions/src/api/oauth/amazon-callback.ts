/**
 * Amazon SP-API OAuth Callback Handler
 *
 * Lambda handler for receiving Amazon Seller Central's OAuth redirect after user authorization.
 * Validates state, exchanges authorization code for tokens via LWA, and stores credentials.
 *
 * Key differences from Shopify:
 * - Amazon returns both access_token (1hr expiry) AND refresh_token
 * - Uses Login with Amazon (LWA) for token exchange
 * - Stores region (NA/EU/FE) for correct API endpoint selection
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

// Amazon LWA token endpoint
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

// Interface for Amazon LWA token response
interface AmazonTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number; // seconds until access_token expires (typically 3600)
}

/**
 * Exchange authorization code for access and refresh tokens via LWA
 */
async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<AmazonTokenResponse> {
  const response = await fetch(LWA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
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
  const { spapi_oauth_code, state, selling_partner_id } = query;

  // Amazon uses spapi_oauth_code instead of code
  const code = spapi_oauth_code;

  console.log("Amazon OAuth callback received:", {
    hasCode: !!code,
    hasState: !!state,
    sellingPartnerId: selling_partner_id,
  });

  // Get Amazon credentials from SST Resource
  const amazonClientId = (
    Resource as unknown as { AmazonClientId?: { value: string } }
  ).AmazonClientId?.value;
  const amazonClientSecret = (
    Resource as unknown as { AmazonClientSecret?: { value: string } }
  ).AmazonClientSecret?.value;

  if (!amazonClientId || !amazonClientSecret) {
    console.error("Amazon credentials not configured");
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
    const redirectUri = `${apiUrl}/oauth/amazon/callback`;

    // Exchange code for access token
    console.log("Exchanging code for access token...");
    const tokenResponse = await exchangeCodeForToken(
      code,
      amazonClientId,
      amazonClientSecret,
      redirectUri
    );

    console.log("Tokens obtained, expires in:", tokenResponse.expires_in);

    // Calculate token expiry time
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Get region from OAuth state metadata (stored during initiateOAuth)
    const region = (oauthState.metadata as { region?: string })?.region || "na";

    // Map region to SP-API endpoint
    const regionEndpoints: Record<string, string> = {
      na: "sellingpartnerapi-na.amazon.com",
      eu: "sellingpartnerapi-eu.amazon.com",
      fe: "sellingpartnerapi-fe.amazon.com",
    };
    const spApiEndpoint = regionEndpoints[region] || regionEndpoints.na;

    // Store tokens in AWS Secrets Manager
    const secretsClient = new SecretsManagerClient({});
    const secretName = `gatemcp/${oauthState.tenantId}/${oauthState.environment.application.slug}/${oauthState.environment.environment.toLowerCase()}`;

    const secretValue = JSON.stringify({
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: expiresAt.toISOString(),
      sellingPartnerId: selling_partner_id,
      region,
      spApiEndpoint,
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
            Description: `Amazon SP-API credentials for ${oauthState.environment.application.name} - ${oauthState.environment.environment}`,
            Tags: [
              { Key: "tenant", Value: oauthState.tenantId },
              { Key: "application", Value: applicationId },
              { Key: "environment", Value: oauthState.environment.environment },
              { Key: "provider", Value: "amazon-fba" },
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
        oauthShop: selling_partner_id || undefined,
        lastTestedAt: new Date(),
        lastTestStatus: "OK",
        // Update baseUrl to use the correct regional endpoint
        baseUrl: `https://${spApiEndpoint}`,
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
          sellingPartnerId: selling_partner_id,
          applicationId,
          region,
          provider: "amazon-fba",
        },
      },
    });

    // Clean up used OAuth state
    await prisma.oAuthState.delete({ where: { id: oauthState.id } });

    console.log("OAuth flow completed successfully for seller:", selling_partner_id);

    // Redirect to app with success
    const successUrl = new URL(`/applications/${applicationId}`, APP_URL);
    successUrl.searchParams.set("oauth", "success");
    if (selling_partner_id) {
      successUrl.searchParams.set("seller", selling_partner_id);
    }

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
