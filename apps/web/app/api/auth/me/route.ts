import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "__Secure-authjs.session-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get(SESSION_COOKIE);

    if (!sessionCookie?.value) {
      return NextResponse.json({ user: null }, { status: 401 });
    }

    // Get the secret
    let jwtSecret: string | undefined;

    try {
      const { Resource } = await import("sst");
      const resource = Resource as unknown as Record<string, { value: string } | undefined>;
      jwtSecret = resource.NextAuthSecret?.value;
    } catch {
      // SST not available
    }

    jwtSecret = jwtSecret || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

    // Verify and decode the JWT
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    return NextResponse.json({
      user: {
        id: payload.sub,
        email: payload.email as string,
        name: payload.name as string | null,
        image: payload.picture as string | null,
        tenantId: payload.tenantId as string | null,
        tenantSlug: payload.tenantSlug as string | null,
        role: payload.role as string | null,
      },
    });
  } catch (error) {
    console.error("[/api/auth/me] Error:", error);
    return NextResponse.json({ user: null }, { status: 401 });
  }
}
