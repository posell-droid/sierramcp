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

    const prisma = await getPrisma();

    // Find the user
    const user = await prisma.user.findFirst({
      where: { workosId },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    if (!user || !user.tenantId) {
      return NextResponse.json({ error: "User not found or no tenant", workosId, email }, { status: 404 });
    }

    const tenantId = user.tenantId;

    // Get all invitations for this tenant
    const invitations = await prisma.invitation.findMany({
      where: {
        tenantId,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Get pending invitations (should match what the UI query expects)
    const pendingInvitations = await prisma.invitation.findMany({
      where: {
        tenantId,
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all audit logs for invitations
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId,
        action: { contains: "invite" },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        tenantId: user.tenantId,
        tenant: user.tenant,
      },
      allInvitations: invitations,
      pendingInvitations: pendingInvitations,
      inviteAuditLogs: auditLogs,
      currentTime: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
