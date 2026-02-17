/**
 * Facebook/Instagram Business Token Refresh Service
 *
 * Copy to: packages/functions/src/services/facebook-business-token-refresh.ts
 *
 * Handles automatic refresh of Facebook long-lived access tokens.
 * Facebook uses a token exchange model rather than traditional refresh tokens.
 * Long-lived tokens last ~60 days and can be exchanged for new long-lived tokens
 * before they expire.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { Resource } from "sst";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// Facebook token exchange endpoint
const FACEBOOK_TOKEN_URL = "https://graph.facebook.com/v19.0/oauth/access_token";

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface FacebookBusinessCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedAt: string;
}

interface FacebookTokenRefreshResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

/**
 * Exchange the current long-lived token for a new long-lived token
 * Facebook uses fb_exchange_token grant type instead of refresh_token
 */
async function refreshAccessToken(
  currentToken: string,
  clientId: string,
  clientSecret: string
): Promise<FacebookTokenRefreshResponse> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: currentToken,
  });

  const response = await fetch(`${FACEBOOK_TOKEN_URL}?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Facebook token refresh failed: ${response.status} ${errorText}`
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
 * Get a valid access token for Facebook/Instagram API, refreshing if necessary
 *
 * @param secretArn - ARN of the secret containing Facebook credentials
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

  const credentials: FacebookBusinessCredentials = JSON.parse(
    getSecretResponse.SecretString
  );

  // Check if token needs refresh
  if (!tokenNeedsRefresh(credentials.expiresAt)) {
    return credentials.accessToken;
  }

  console.log(
    "Facebook access token expired or expiring soon, refreshing..."
  );

  // Get Facebook OAuth credentials from SST Resource
  const facebookAppId = (
    Resource as unknown as { FacebookAppId?: { value: string } }
  ).FacebookAppId?.value;
  const facebookAppSecret = (
    Resource as unknown as { FacebookAppSecret?: { value: string } }
  ).FacebookAppSecret?.value;

  if (!facebookAppId || !facebookAppSecret) {
    throw new Error("Facebook OAuth credentials not configured");
  }

  // Refresh the token via exchange
  const refreshResponse = await refreshAccessToken(
    credentials.accessToken,
    facebookAppId,
    facebookAppSecret
  );

  // Calculate new expiry time
  const newExpiresAt = new Date(
    Date.now() + refreshResponse.expires_in * 1000
  ).toISOString();

  // Update credentials with new token
  const updatedCredentials: FacebookBusinessCredentials = {
    ...credentials,
    accessToken: refreshResponse.access_token,
    refreshToken: refreshResponse.access_token, // Facebook uses the access token itself for exchange
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
    "Facebook access token refreshed successfully, new expiry:",
    newExpiresAt
  );

  return updatedCredentials.accessToken;
}

/**
 * Build authorization headers for Facebook/Instagram Graph API requests
 *
 * @param secretArn - ARN of the secret containing Facebook credentials
 * @returns Headers object with Authorization bearer token
 */
export async function buildFacebookBusinessAuthHeaders(
  secretArn: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(secretArn);

  return {
    Authorization: `Bearer ${accessToken}`,
  };
}
