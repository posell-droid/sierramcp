/**
 * Amazon SP-API Token Refresh Service
 *
 * Handles automatic refresh of Amazon access tokens which expire every hour.
 * Should be called before making SP-API requests to ensure valid tokens.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { Resource } from "sst";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// Amazon LWA token endpoint
const LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token";

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface AmazonCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  sellingPartnerId?: string;
  region: string;
  spApiEndpoint: string;
  connectedAt: string;
}

interface LWARefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Refresh the access token using the refresh token
 */
async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<LWARefreshResponse> {
  const response = await fetch(LWA_TOKEN_URL, {
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
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
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
 * Get a valid access token for Amazon SP-API, refreshing if necessary
 *
 * @param secretArn - ARN of the secret containing Amazon credentials
 * @returns Fresh access token and credentials
 */
export async function getValidAccessToken(
  secretArn: string
): Promise<AmazonCredentials> {
  // Retrieve current credentials
  const getSecretResponse = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    })
  );

  if (!getSecretResponse.SecretString) {
    throw new Error("No credentials found in secret");
  }

  const credentials: AmazonCredentials = JSON.parse(
    getSecretResponse.SecretString
  );

  // Check if token needs refresh
  if (!tokenNeedsRefresh(credentials.expiresAt)) {
    return credentials;
  }

  console.log("Amazon access token expired or expiring soon, refreshing...");

  // Get Amazon client credentials from SST Resource
  const amazonClientId = (
    Resource as unknown as { AmazonClientId?: { value: string } }
  ).AmazonClientId?.value;
  const amazonClientSecret = (
    Resource as unknown as { AmazonClientSecret?: { value: string } }
  ).AmazonClientSecret?.value;

  if (!amazonClientId || !amazonClientSecret) {
    throw new Error("Amazon OAuth credentials not configured");
  }

  // Refresh the token
  const refreshResponse = await refreshAccessToken(
    credentials.refreshToken,
    amazonClientId,
    amazonClientSecret
  );

  // Calculate new expiry time
  const newExpiresAt = new Date(
    Date.now() + refreshResponse.expires_in * 1000
  ).toISOString();

  // Update credentials with new tokens
  const updatedCredentials: AmazonCredentials = {
    ...credentials,
    accessToken: refreshResponse.access_token,
    // Amazon may return a new refresh token, use it if provided
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

  console.log("Amazon access token refreshed successfully, new expiry:", newExpiresAt);

  return updatedCredentials;
}

/**
 * Build the x-amz-access-token header for SP-API requests
 *
 * @param secretArn - ARN of the secret containing Amazon credentials
 * @returns Headers object with x-amz-access-token
 */
export async function buildAmazonAuthHeaders(
  secretArn: string
): Promise<Record<string, string>> {
  const credentials = await getValidAccessToken(secretArn);

  return {
    "x-amz-access-token": credentials.accessToken,
  };
}
