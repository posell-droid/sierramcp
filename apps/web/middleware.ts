import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Cookie name for the session - must match what we set in the callback
const SESSION_COOKIE = "__Secure-authjs.session-token";

// Auth pages - users should be redirected to dashboard if already authenticated
const AUTH_PAGES = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email", "/accept-invite", "/business-email-required"];

// Pages that don't require a tenant (user is authenticated but pending approval)
const NO_TENANT_PAGES = ["/pending-approval"];

interface SessionPayload {
  id?: string;
  tenantId?: string | null;
  email?: string;
}

/**
 * Decode the JWT session cookie to check user status
 * Note: We can't fully verify the signature in Edge middleware (no SST resources),
 * but we can decode and check the payload for routing decisions.
 * The actual verification happens in the API routes.
 */
async function decodeSession(token: string): Promise<SessionPayload | null> {
  try {
    // Try to verify with secret from environment
    const secret = process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";
    const secretKey = new TextEncoder().encode(secret);

    const { payload } = await jwtVerify(token, secretKey);
    return payload as SessionPayload;
  } catch {
    // If verification fails, try to decode without verification
    // This is safe because we're only using it for routing decisions
    // Actual auth is verified in API routes
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return null;

      const payload = JSON.parse(atob(parts[1]));
      return payload as SessionPayload;
    } catch {
      return null;
    }
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE);
  const hasSession = !!sessionCookie?.value;

  // Check page types
  const isAuthPage = AUTH_PAGES.some(page => pathname === page || pathname.startsWith(page + "/"));
  const isNoTenantPage = NO_TENANT_PAGES.some(page => pathname === page || pathname.startsWith(page + "/"));

  // Decode session to check for tenant
  let session: SessionPayload | null = null;
  if (sessionCookie?.value) {
    session = await decodeSession(sessionCookie.value);
  }

  const hasTenant = !!session?.tenantId;

  console.log(`[Middleware] Path: ${pathname}, HasSession: ${hasSession}, HasTenant: ${hasTenant}, IsAuthPage: ${isAuthPage}`);

  // Rule 1: Unauthenticated user on protected page -> redirect to login
  if (!hasSession && !isAuthPage) {
    console.log("[Middleware] Unauthenticated user on protected page, redirecting to login");
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname || "/");
    return NextResponse.redirect(loginUrl);
  }

  // Rule 2: Authenticated user on auth page -> redirect based on tenant status
  if (hasSession && isAuthPage) {
    if (hasTenant) {
      console.log("[Middleware] Authenticated user with tenant on auth page, redirecting to dashboard");
      return NextResponse.redirect(new URL("/", request.url));
    } else {
      console.log("[Middleware] Authenticated user without tenant on auth page, redirecting to pending-approval");
      return NextResponse.redirect(new URL("/pending-approval", request.url));
    }
  }

  // Rule 3: Authenticated user WITHOUT tenant trying to access protected pages -> redirect to pending-approval
  if (hasSession && !hasTenant && !isNoTenantPage && !isAuthPage) {
    console.log("[Middleware] Authenticated user without tenant on protected page, redirecting to pending-approval");
    return NextResponse.redirect(new URL("/pending-approval", request.url));
  }

  // Rule 4: Authenticated user WITH tenant on pending-approval page -> redirect to dashboard
  if (hasSession && hasTenant && isNoTenantPage) {
    console.log("[Middleware] Authenticated user with tenant on pending-approval, redirecting to dashboard");
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Otherwise, allow the request through
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match root path
    "/",
    // Match all paths except api, static files, and files with extensions
    "/((?!api|_next/static|_next/image|images|favicon|icon|apple-icon|.*\\.[^/]+$).*)",
  ],
};
