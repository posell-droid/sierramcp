/**
 * ServiceTitan Token Refresh Service
 *
 * Handles automatic refresh of ServiceTitan OAuth access tokens.
 * Should be called before making ServiceTitan API requests to ensure valid tokens.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { Resource } from "sst";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// ServiceTitan OAuth token endpoint
const SERVICETITAN_TOKEN_URL =
  "https://auth.servicetitan.io/connect/token";

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface ServiceTitanCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedAt: string;
}

interface ServiceTitanTokenRefreshResponse {
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
): Promise<ServiceTitanTokenRefreshResponse> {
  const response = await fetch(SERVICETITAN_TOKEN_URL, {
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
      `ServiceTitan token refresh failed: ${response.status} ${errorText}`
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
 * Get a valid access token for ServiceTitan API, refreshing if necessary
 *
 * @param secretArn - ARN of the secret containing ServiceTitan credentials
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

  const credentials: ServiceTitanCredentials = JSON.parse(
    getSecretResponse.SecretString
  );

  // Check if token needs refresh
  if (!tokenNeedsRefresh(credentials.expiresAt)) {
    return credentials.accessToken;
  }

  console.log(
    "ServiceTitan access token expired or expiring soon, refreshing..."
  );

  // Get ServiceTitan OAuth client credentials from SST Resource
  const serviceTitanClientId = (
    Resource as unknown as { ServiceTitanClientId?: { value: string } }
  ).ServiceTitanClientId?.value;
  const serviceTitanClientSecret = (
    Resource as unknown as { ServiceTitanClientSecret?: { value: string } }
  ).ServiceTitanClientSecret?.value;

  if (!serviceTitanClientId || !serviceTitanClientSecret) {
    throw new Error("ServiceTitan OAuth credentials not configured");
  }

  // Refresh the token
  const refreshResponse = await refreshAccessToken(
    credentials.refreshToken,
    serviceTitanClientId,
    serviceTitanClientSecret
  );

  // Calculate new expiry time
  const newExpiresAt = new Date(
    Date.now() + refreshResponse.expires_in * 1000
  ).toISOString();

  // Update credentials with new tokens
  // ServiceTitan may return a new refresh token on each refresh
  const updatedCredentials: ServiceTitanCredentials = {
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
    "ServiceTitan access token refreshed successfully, new expiry:",
    newExpiresAt
  );

  return updatedCredentials.accessToken;
}

/**
 * Build authorization headers for ServiceTitan API requests
 *
 * @param secretArn - ARN of the secret containing ServiceTitan credentials
 * @returns Headers object with Authorization bearer token
 */
export async function buildServiceTitanAuthHeaders(
  secretArn: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(secretArn);

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
