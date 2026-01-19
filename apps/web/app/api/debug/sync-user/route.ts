import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { getPrisma } from "@repo/db";

const SESSION_COOKIE = "__Secure-authjs.session-token";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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
    const name = payload.name as string | null;
    const picture = payload.picture as string | null;

    if (!workosId || !email) {
      return NextResponse.json({ error: "Missing workosId or email in session" }, { status: 400 });
    }

    const prisma = await getPrisma();

    // Check if user exists
    let user = await prisma.user.findFirst({
      where: { workosId },
      include: { tenant: true },
    });

    if (user) {
      // Update user
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          email,
          name: name || undefined,
          avatarUrl: picture || undefined,
          lastLoginAt: new Date(),
        },
        include: { tenant: true },
      });

      // If user has no tenant, create one
      if (!user.tenantId) {
        const emailDomain = email.split("@")[1]?.toLowerCase();
        const isPersonalEmail = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"].includes(emailDomain);

        const tenantName = isPersonalEmail
          ? `${name || email.split("@")[0]}'s Workspace`
          : emailDomain.split(".")[0].charAt(0).toUpperCase() + emailDomain.split(".")[0].slice(1);

        const tenantSlug = `${emailDomain.replace(/\./g, "-")}-${Date.now().toString(36)}`;

        const tenant = await prisma.tenant.create({
          data: {
            name: tenantName,
            slug: tenantSlug,
            primaryDomain: isPersonalEmail ? null : emailDomain,
          },
        });

        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            tenantId: tenant.id,
            role: "OWNER",
          },
          include: { tenant: true },
        });
      }
    } else {
      // Create new user with tenant
      const emailDomain = email.split("@")[1]?.toLowerCase();
      const isPersonalEmail = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com", "aol.com"].includes(emailDomain);

      const tenantName = isPersonalEmail
        ? `${name || email.split("@")[0]}'s Workspace`
        : emailDomain.split(".")[0].charAt(0).toUpperCase() + emailDomain.split(".")[0].slice(1);

      const tenantSlug = `${emailDomain.replace(/\./g, "-")}-${Date.now().toString(36)}`;

      const tenant = await prisma.tenant.create({
        data: {
          name: tenantName,
          slug: tenantSlug,
          primaryDomain: isPersonalEmail ? null : emailDomain,
        },
      });

      user = await prisma.user.create({
        data: {
          workosId,
          email,
          name,
          avatarUrl: picture,
          emailVerified: new Date(),
          lastLoginAt: new Date(),
          tenantId: tenant.id,
          role: "OWNER",
        },
        include: { tenant: true },
      });
    }

    // Create a new JWT with updated tenant info
    const newToken = await new SignJWT({
      sub: workosId,
      email: user.email,
      name: user.name || email,
      picture: user.avatarUrl,
      workosId: workosId,
      sessionId: payload.sessionId,
      tenantId: user.tenant?.id || null,
      tenantSlug: user.tenant?.slug || null,
      role: user.role || "MEMBER",
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(secret);

    // Set the updated session cookie
    cookieStore.set(SESSION_COOKIE, newToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        workosId: user.workosId,
        tenantId: user.tenantId,
        role: user.role,
      },
      tenant: user.tenant ? {
        id: user.tenant.id,
        name: user.tenant.name,
        slug: user.tenant.slug,
      } : null,
      message: "Session cookie updated with tenant info. Please refresh the page.",
    });
  } catch (error) {
    console.error("[Sync User] Error:", error);
    return NextResponse.json({
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
