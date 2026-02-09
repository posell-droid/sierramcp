/**
 * Google Ads Token Refresh Service
 *
 * Handles automatic refresh of Google Ads OAuth access tokens which expire every hour.
 * Should be called before making Google Ads API requests to ensure valid tokens.
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import { Resource } from "sst";

const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const secretsClient = new SecretsManagerClient({ region: AWS_REGION });

// Google OAuth2 token endpoint
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

// Refresh token 5 minutes before expiry
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;

export interface GoogleAdsCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  connectedAt: string;
}

interface GoogleTokenRefreshResponse {
  access_token: string;
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
): Promise<GoogleTokenRefreshResponse> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
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
      `Google Ads token refresh failed: ${response.status} ${errorText}`
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
 * Get a valid access token for Google Ads API, refreshing if necessary
 *
 * @param secretArn - ARN of the secret containing Google Ads credentials
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

  const credentials: GoogleAdsCredentials = JSON.parse(
    getSecretResponse.SecretString
  );

  // Check if token needs refresh
  if (!tokenNeedsRefresh(credentials.expiresAt)) {
    return credentials.accessToken;
  }

  console.log(
    "Google Ads access token expired or expiring soon, refreshing..."
  );

  // Get Google OAuth client credentials from SST Resource
  const googleClientId = (
    Resource as unknown as { GoogleAdsClientId?: { value: string } }
  ).GoogleAdsClientId?.value;
  const googleClientSecret = (
    Resource as unknown as { GoogleAdsClientSecret?: { value: string } }
  ).GoogleAdsClientSecret?.value;

  if (!googleClientId || !googleClientSecret) {
    throw new Error("Google Ads OAuth credentials not configured");
  }

  // Refresh the token
  const refreshResponse = await refreshAccessToken(
    credentials.refreshToken,
    googleClientId,
    googleClientSecret
  );

  // Calculate new expiry time
  const newExpiresAt = new Date(
    Date.now() + refreshResponse.expires_in * 1000
  ).toISOString();

  // Update credentials with new tokens
  const updatedCredentials: GoogleAdsCredentials = {
    ...credentials,
    accessToken: refreshResponse.access_token,
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
    "Google Ads access token refreshed successfully, new expiry:",
    newExpiresAt
  );

  return updatedCredentials.accessToken;
}

/**
 * Build authorization headers for Google Ads API requests
 *
 * @param secretArn - ARN of the secret containing Google Ads credentials
 * @returns Headers object with Authorization and developer-token
 */
export async function buildGoogleAdsAuthHeaders(
  secretArn: string
): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(secretArn);

  // Get developer token from SST Resource
  const developerToken = (
    Resource as unknown as { GoogleAdsDeveloperToken?: { value: string } }
  ).GoogleAdsDeveloperToken?.value;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (developerToken) {
    headers["developer-token"] = developerToken;
  }

  return headers;
}
