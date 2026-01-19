import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import { SignJWT, jwtVerify } from "jose";

/**
 * NextAuth Configuration
 *
 * All authentication is handled through WorkOS AuthKit.
 * This NextAuth config is kept for session management and backward compatibility
 * with components that use useSession().
 *
 * The actual authentication flow:
 * 1. User clicks "Continue" on login page
 * 2. Redirected to /api/auth/workos which initiates WorkOS AuthKit
 * 3. WorkOS handles email/password, SSO, and social logins
 * 4. Callback at /api/auth/workos/callback creates our JWT session cookie
 *    with all user/tenant data already populated
 * 5. NextAuth session callbacks simply read from that JWT cookie (no DB lookups)
 */

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      tenantId?: string | null;
      tenantSlug?: string | null;
      role?: string;
    };
  }

  interface User {
    tenantId?: string | null;
    tenantSlug?: string | null;
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId?: string | null;
    tenantSlug?: string | null;
    role?: string;
    workosId?: string;
    emailVerified?: string | null;
  }
}

// Get secret from environment (SST sets this as NEXTAUTH_SECRET)
const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
const secretKey = new TextEncoder().encode(secret || "fallback-secret");

// Debug: Log if secret is available (not the actual secret)
if (!secret) {
  console.error("[Auth] WARNING: No AUTH_SECRET or NEXTAUTH_SECRET found in environment");
}

/**
 * Custom JWT encode/decode to match the WorkOS callback format.
 * WorkOS callback creates JWS (signed) tokens, not JWE (encrypted).
 * We need NextAuth to use the same format.
 */
async function encodeJwt({ token }: { token?: JWT }): Promise<string> {
  if (!token) {
    throw new Error("Token is required for encoding");
  }
  return new SignJWT(token as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secretKey);
}

async function decodeJwt({ token }: { token?: string }): Promise<JWT | null> {
  if (!token) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as JWT;
  } catch (error) {
    console.error("[Auth] JWT decode error:", error);
    return null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Explicit secret configuration for Auth.js v5
  secret,
  // Trust the host in production (CloudFront domain)
  trustHost: true,
  // No providers - all auth goes through WorkOS
  providers: [],
  session: {
    strategy: "jwt",
  },
  // Use custom JWT encode/decode to match WorkOS callback format (JWS, not JWE)
  jwt: {
    encode: encodeJwt,
    decode: decodeJwt,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, trigger, session }) {
      // The WorkOS callback (/api/auth/workos/callback) already populates the JWT
      // with all necessary user and tenant data. We just need to pass it through.
      // No database lookups needed here - that would be redundant and error-prone.

      // Handle session updates (e.g., after tenant join approval)
      if (trigger === "update" && session) {
        if (session.tenantId) token.tenantId = session.tenantId as string;
        if (session.tenantSlug) token.tenantSlug = session.tenantSlug as string;
        if (session.role) token.role = session.role as string;
      }

      return token;
    },

    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.tenantId = token.tenantId as string | null | undefined;
        session.user.tenantSlug = token.tenantSlug as string | null | undefined;
        session.user.role = token.role as string | undefined;
        // Pass through name and image for avatar display
        if (token.name) session.user.name = token.name as string;
        if (token.picture) session.user.image = token.picture as string;
      }
      return session;
    },
  },
});
