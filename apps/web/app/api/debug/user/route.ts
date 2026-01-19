import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { getPrisma } from "@repo/db";

const SESSION_COOKIE = "__Secure-authjs.session-token";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return NextResponse.json({ error: "No session cookie" }, { status: 401 });
  }

  // Get JWT secret
  let jwtSecret: string | undefined;
  try {
    const { Resource } = await import("sst");
    const resource = Resource as unknown as Record<string, { value: string } | undefined>;
    jwtSecret = resource.NextAuthSecret?.value;
  } catch {
    // SST not available
  }
  jwtSecret = jwtSecret || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

  try {
    const secret = new TextEncoder().encode(jwtSecret);
    const { payload } = await jwtVerify(sessionCookie.value, secret);

    const workosId = payload.workosId as string || payload.sub as string;
    const email = payload.email as string;

    // Check database
    const prisma = await getPrisma();

    // Find user by workosId
    const userByWorkosId = await prisma.user.findFirst({
      where: { workosId },
    });

    // Find user by email
    const userByEmail = await prisma.user.findFirst({
      where: { email },
    });

    // Count all users
    const totalUsers = await prisma.user.count();

    return NextResponse.json({
      session: {
        workosId,
        email,
        name: payload.name,
        sub: payload.sub,
      },
      database: {
        userByWorkosId: userByWorkosId ? { id: userByWorkosId.id, email: userByWorkosId.email, workosId: userByWorkosId.workosId } : null,
        userByEmail: userByEmail ? { id: userByEmail.id, email: userByEmail.email, workosId: userByEmail.workosId } : null,
        totalUsers,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
