/**
 * Canva Token Refresh Service
 *
 * Copy to: packages/functions/src/services/canva-token-refresh.ts
 *
 * Handles automatic refresh of Canva OAuth access tokens.
 * Canva uses standard OAuth 2.0 refresh token flow.
 * Should be called before making Canva API requests to ensure valid tokens.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { Resource } from "sst";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// Canva OAuth token endpoint
const CANVA_TOKEN_URL = "https://api.canva.com/rest/v1/oauth/token";

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface CanvaCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedAt: string;
}

interface CanvaTokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<CanvaTokenRefreshResponse> {
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(CANVA_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Canva token refresh failed: ${response.status} ${errorText}`
    );
  }

  return response.json();
}

/**
 * Check if the access token needs refresh (within 5 minutes of expiry)
 */
export function tokenNeedsRefresh(expiresAt: string): boolean {
  const expiryTime = new Date(expiresAt).getTime();
  const currentTime = Date.now();
  return currentTime >= expiryTime - TOKEN_REFRESH_BUFFER_MS;
}

/**
 * Get a valid access token for Canva API, refreshing if necessary
 *
 * @param secretArn - ARN of the secret containing Canva credentials
 * @returns Fresh access token string
 */
export async function getValidAccessToken(
  secretArn: string
): Promise<string> {
  // Retrieve current credentials
  const getSecretResponse = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    })
  );

  if (!getSecretResponse.SecretString) {
    throw new Error("No credentials found in secret");
  }

  const credentials: CanvaCredentials = JSON.parse(
    getSecretResponse.SecretString
  );

  // Check if token needs refresh
  if (!tokenNeedsRefresh(credentials.expiresAt)) {
    return credentials.accessToken;
  }

  console.log(
    "Canva access token expired or expiring soon, refreshing..."
  );

  // Get Canva OAuth client credentials from SST Resource
  const canvaClientId = (
    Resource as unknown as { CanvaClientId?: { value: string } }
  ).CanvaClientId?.value;
  const canvaClientSecret = (
    Resource as unknown as { CanvaClientSecret?: { value: string } }
  ).CanvaClientSecret?.value;

  if (!canvaClientId || !canvaClientSecret) {
    throw new Error("Canva OAuth credentials not configured");
  }

  // Refresh the token
  const refreshResponse = await refreshAccessToken(
    credentials.refreshToken,
    canvaClientId,
    canvaClientSecret
  );

  // Calculate new expiry time
  const newExpiresAt = new Date(
    Date.now() + refreshResponse.expires_in * 1000
  ).toISOString();

  // Update credentials with new tokens
  // Canva returns a new refresh token on each refresh
  const updatedCredentials: CanvaCredentials = {
    ...credentials,
    accessToken: refreshResponse.access_token,
    refreshToken: refreshResponse.refresh_token || credentials.refreshToken,
    expiresAt: newExpiresAt,
  };

  // Save updated credentials back to Secrets Manager
  await secretsClient.send(
    new UpdateSecretCommand({
      SecretId: secretArn,
      SecretString: JSON.stringify(updatedCredentials),
    })
  );

  console.log(
    "Canva access token refreshed successfully, new expiry:",
    newExpiresAt
  );

  return updatedCredentials.accessToken;
}

/**
 * Build authorization headers for Canva API requests
 *
 * @param secretArn - ARN of the secret containing Canva credentials
 * @returns Headers object with Authorization bearer token
 */
export async function buildCanvaAuthHeaders(
  secretArn: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(secretArn);

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
