import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { WorkOS } from "@workos-inc/node";
import { jwtVerify } from "jose";

// Cookie name - must match middleware and callback
const SESSION_COOKIE = "__Secure-authjs.session-token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  console.log("[Signout] Starting signout process");

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  // Get secrets
  let workosApiKey: string | undefined;
  let jwtSecret: string | undefined;

  try {
    const { Resource } = await import("sst");
    const resource = Resource as unknown as Record<string, { value: string } | undefined>;
    workosApiKey = resource.WorkosApiKey?.value;
    jwtSecret = resource.NextAuthSecret?.value;
  } catch {
    console.log("[Signout] SST Resources not available, using env vars");
  }

  workosApiKey = workosApiKey || process.env.WORKOS_API_KEY;
  jwtSecret = jwtSecret || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

  // Try to revoke the WorkOS session if we have a session ID
  if (sessionCookie?.value && workosApiKey && jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionCookie.value, secret);
      const sessionId = payload.sessionId as string | undefined;

      if (sessionId) {
        console.log("[Signout] Revoking WorkOS session:", sessionId);
        const workos = new WorkOS(workosApiKey);
        await workos.userManagement.revokeSession({ sessionId });
        console.log("[Signout] WorkOS session revoked successfully");
      } else {
        console.log("[Signout] No session ID in token, skipping WorkOS revocation");
      }
    } catch (e) {
      // Log but don't fail - we still want to clear the local session
      console.error("[Signout] Error revoking WorkOS session:", e);
    }
  }

  // Clear the session cookie
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0, // Expire immediately
  });

  console.log("[Signout] Cookie cleared, redirecting to login");
  return NextResponse.redirect(new URL("/login", request.url));
}

export async function POST(request: NextRequest) {
  console.log("[Signout] Clearing session cookie (POST)");

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  // Get secrets
  let workosApiKey: string | undefined;
  let jwtSecret: string | undefined;

  try {
    const { Resource } = await import("sst");
    const resource = Resource as unknown as Record<string, { value: string } | undefined>;
    workosApiKey = resource.WorkosApiKey?.value;
    jwtSecret = resource.NextAuthSecret?.value;
  } catch {
    console.log("[Signout] SST Resources not available, using env vars");
  }

  workosApiKey = workosApiKey || process.env.WORKOS_API_KEY;
  jwtSecret = jwtSecret || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

  // Try to revoke the WorkOS session
  if (sessionCookie?.value && workosApiKey && jwtSecret) {
    try {
      const secret = new TextEncoder().encode(jwtSecret);
      const { payload } = await jwtVerify(sessionCookie.value, secret);
      const sessionId = payload.sessionId as string | undefined;

      if (sessionId) {
        const workos = new WorkOS(workosApiKey);
        await workos.userManagement.revokeSession({ sessionId });
      }
    } catch (e) {
      console.error("[Signout] Error revoking WorkOS session:", e);
    }
  }

  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return NextResponse.json({ success: true });
}
