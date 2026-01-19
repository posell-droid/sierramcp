import { WorkOS } from "@workos-inc/node";

// Initialize WorkOS client
export const workos = new WorkOS(process.env.WORKOS_API_KEY!);

// WorkOS Client ID for AuthKit
export const clientId = process.env.WORKOS_CLIENT_ID!;
