/**
 * DoorDash Token Refresh Service
 *
 * Copy to: packages/functions/src/services/doordash-token-refresh.ts
 *
 * Handles automatic refresh of DoorDash OAuth access tokens.
 * DoorDash uses JWT-based auth with client credentials. Tokens are refreshed
 * before making DoorDash API requests to ensure valid authentication.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { Resource } from "sst";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// DoorDash OAuth token endpoint
const DOORDASH_TOKEN_URL = "https://identity.doordash.com/connect/token";

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface DoorDashCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedAt: string;
}

interface DoorDashTokenRefreshResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<DoorDashTokenRefreshResponse> {
  const response = await fetch(DOORDASH_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `DoorDash token refresh failed: ${response.status} ${errorText}`
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
 * Get a valid access token for DoorDash API, refreshing if necessary
 *
 * @param secretArn - ARN of the secret containing DoorDash credentials
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

  const credentials: DoorDashCredentials = JSON.parse(
    getSecretResponse.SecretString
  );

  // Check if token needs refresh
  if (!tokenNeedsRefresh(credentials.expiresAt)) {
    return credentials.accessToken;
  }

  console.log(
    "DoorDash access token expired or expiring soon, refreshing..."
  );

  // Get DoorDash OAuth client credentials from SST Resource
  const doordashClientId = (
    Resource as unknown as { DoorDashClientId?: { value: string } }
  ).DoorDashClientId?.value;
  const doordashClientSecret = (
    Resource as unknown as { DoorDashClientSecret?: { value: string } }
  ).DoorDashClientSecret?.value;

  if (!doordashClientId || !doordashClientSecret) {
    throw new Error("DoorDash OAuth credentials not configured");
  }

  // Refresh the token
  const refreshResponse = await refreshAccessToken(
    credentials.refreshToken,
    doordashClientId,
    doordashClientSecret
  );

  // Calculate new expiry time
  const newExpiresAt = new Date(
    Date.now() + refreshResponse.expires_in * 1000
  ).toISOString();

  // Update credentials with new tokens
  // DoorDash may return a new refresh token on each refresh
  const updatedCredentials: DoorDashCredentials = {
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
    "DoorDash access token refreshed successfully, new expiry:",
    newExpiresAt
  );

  return updatedCredentials.accessToken;
}

/**
 * Build authorization headers for DoorDash API requests
 *
 * @param secretArn - ARN of the secret containing DoorDash credentials
 * @returns Headers object with Authorization bearer token
 */
export async function buildDoorDashAuthHeaders(
  secretArn: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(secretArn);

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
