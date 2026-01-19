import { NextRequest, NextResponse } from "next/server";
import { WorkOS } from "@workos-inc/node";
import { cookies } from "next/headers";
import { SignJWT, decodeJwt } from "jose";
import { getPrisma, initDatabaseUrl } from "@repo/db";

// Cookie name - must match middleware
const SESSION_COOKIE = "__Secure-authjs.session-token";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  console.log("[WorkOS Callback] Route called");
  console.log("[WorkOS Callback] URL:", request.url);

  // Initialize database URL from SST Resources before any Prisma calls
  await initDatabaseUrl();

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    console.log("[WorkOS Callback] Params:", {
      hasCode: !!code,
      error,
      errorDescription,
    });

    // Check for errors from WorkOS
    if (error) {
      console.error("[WorkOS Callback] WorkOS error:", error, errorDescription);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, request.url));
    }

    if (!code) {
      console.error("[WorkOS Callback] No code provided");
      return NextResponse.redirect(new URL("/login?error=NoCode", request.url));
    }

    // Get secrets from SST Resources or env vars
    let workosApiKey: string | undefined;
    let workosClientId: string | undefined;
    let jwtSecret: string | undefined;

    try {
      const { Resource } = await import("sst");
      const resource = Resource as unknown as Record<string, { value: string } | undefined>;
      workosApiKey = resource.WorkosApiKey?.value;
      workosClientId = resource.WorkosClientId?.value;
      jwtSecret = resource.NextAuthSecret?.value;
      console.log("[WorkOS Callback] SST Resources loaded");
    } catch (e) {
      console.log("[WorkOS Callback] SST Resources not available, using env vars");
    }

    workosApiKey = workosApiKey || process.env.WORKOS_API_KEY;
    workosClientId = workosClientId || process.env.WORKOS_CLIENT_ID;
    jwtSecret = jwtSecret || process.env.NEXTAUTH_SECRET || "fallback-secret-change-me";

    if (!workosApiKey || !workosClientId) {
      console.error("[WorkOS Callback] Missing WorkOS configuration");
      return NextResponse.redirect(new URL("/login?error=MissingConfig", request.url));
    }

    // Exchange code for user info and tokens
    console.log("[WorkOS Callback] Exchanging code for user info...");
    const workos = new WorkOS(workosApiKey);
    const { user, accessToken } = await workos.userManagement.authenticateWithCode({
      clientId: workosClientId,
      code,
    });

    console.log("[WorkOS Callback] User authenticated:", user.email);

    // Extract session ID from the access token JWT
    let sessionId: string | undefined;
    try {
      const decodedToken = decodeJwt(accessToken);
      sessionId = decodedToken.sid as string | undefined;
      console.log("[WorkOS Callback] Session ID extracted:", sessionId ? "yes" : "no");
    } catch (e) {
      console.warn("[WorkOS Callback] Could not decode access token:", e);
    }

    // Upsert user in database
    const userName = user.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : null;
    let dbUser;
    try {
      const prisma = await getPrisma();

      // First, try to find existing user by workosId
      dbUser = await prisma.user.findFirst({
        where: { workosId: user.id },
        include: {
          tenant: {
            select: { id: true, slug: true },
          },
        },
      });

      // Fallback: find by email (supports WorkOS account migration)
      if (!dbUser) {
        dbUser = await prisma.user.findFirst({
          where: { email: { equals: user.email, mode: "insensitive" } },
          include: {
            tenant: {
              select: { id: true, slug: true },
            },
          },
        });
        if (dbUser) {
          console.log("[WorkOS Callback] Found user by email, updating workosId:", dbUser.id);
        }
      }

      if (dbUser) {
        // Update existing user (including workosId in case it changed)
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: {
            workosId: user.id, // Update workosId to current WorkOS account
            email: user.email,
            name: userName || undefined,
            avatarUrl: user.profilePictureUrl || undefined,
            lastLoginAt: new Date(),
          },
          include: {
            tenant: {
              select: { id: true, slug: true },
            },
          },
        });
        console.log("[WorkOS Callback] User updated:", dbUser.id);

        // Check if existing user has no tenant but has a pending invitation
        if (!dbUser.tenant) {
          const invitation = await prisma.invitation.findFirst({
            where: {
              email: user.email.toLowerCase(),
              acceptedAt: null,
              expiresAt: { gt: new Date() },
            },
            include: {
              tenant: { select: { id: true, slug: true } },
            },
          });

          if (invitation) {
            // Accept the invitation - add user to tenant
            dbUser = await prisma.user.update({
              where: { id: dbUser.id },
              data: {
                tenantId: invitation.tenantId,
                role: invitation.role,
              },
              include: {
                tenant: { select: { id: true, slug: true } },
              },
            });

            // Mark invitation as accepted
            await prisma.invitation.update({
              where: { id: invitation.id },
              data: { acceptedAt: new Date() },
            });

            // Delete any pending join requests for this user
            await prisma.joinRequest.deleteMany({
              where: { userId: dbUser.id },
            });

            // Create audit log
            await prisma.auditLog.create({
              data: {
                tenantId: invitation.tenantId,
                userId: dbUser.id,
                action: "invitation.accepted",
                entityType: "Invitation",
                entityId: invitation.id,
                metadata: { email: user.email, role: invitation.role },
              },
            });

            console.log("[WorkOS Callback] User joined tenant via invitation:", dbUser.id, invitation.tenantId);
          }
        }
      } else {
        // New user - check for invitation first, then domain-based provisioning

        // Check for pending invitation by email
        const invitation = await prisma.invitation.findFirst({
          where: {
            email: user.email.toLowerCase(),
            acceptedAt: null,
            expiresAt: { gt: new Date() },
          },
          include: {
            tenant: { select: { id: true, slug: true, name: true } },
          },
        });

        if (invitation) {
          // Create user directly in the invited tenant
          dbUser = await prisma.user.create({
            data: {
              workosId: user.id,
              email: user.email,
              name: userName,
              avatarUrl: user.profilePictureUrl,
              emailVerified: user.emailVerified ? new Date() : null,
              lastLoginAt: new Date(),
              tenantId: invitation.tenantId,
              role: invitation.role,
            },
            include: {
              tenant: { select: { id: true, slug: true } },
            },
          });

          // Mark invitation as accepted
          await prisma.invitation.update({
            where: { id: invitation.id },
            data: { acceptedAt: new Date() },
          });

          // Create audit log
          await prisma.auditLog.create({
            data: {
              tenantId: invitation.tenantId,
              userId: dbUser.id,
              action: "invitation.accepted",
              entityType: "Invitation",
              entityId: invitation.id,
              metadata: { email: user.email, role: invitation.role },
            },
          });

          console.log("[WorkOS Callback] New user created via invitation:", dbUser.id, "tenant:", invitation.tenantId);
        } else {
          // No invitation - use domain-based provisioning
          const emailDomain = user.email.split("@")[1]?.toLowerCase();

          // Comprehensive list of personal/consumer email domains
          const personalEmailDomains = [
            // Major providers
            "gmail.com", "googlemail.com",
            "yahoo.com", "yahoo.co.uk", "yahoo.fr", "yahoo.de", "yahoo.es", "yahoo.it", "yahoo.ca", "yahoo.com.au", "yahoo.co.jp", "yahoo.co.in",
            "hotmail.com", "hotmail.co.uk", "hotmail.fr", "hotmail.de", "hotmail.es", "hotmail.it",
            "outlook.com", "outlook.co.uk", "outlook.fr", "outlook.de",
            "live.com", "live.co.uk", "live.fr", "live.de",
            "msn.com",
            "icloud.com", "me.com", "mac.com",
            "aol.com", "aol.co.uk",
            // Other popular providers
            "protonmail.com", "proton.me", "pm.me",
            "zoho.com", "zohomail.com",
            "yandex.com", "yandex.ru",
            "mail.com", "email.com",
            "gmx.com", "gmx.net", "gmx.de",
            "fastmail.com", "fastmail.fm",
            "tutanota.com", "tutamail.com", "tuta.io",
            "hey.com",
            "inbox.com",
            "mail.ru",
            "qq.com",
            "163.com", "126.com",
            "rediffmail.com",
            // ISP-based personal emails
            "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "bellsouth.net",
            "cox.net", "charter.net", "earthlink.net", "juno.com", "netzero.com",
            "btinternet.com", "virginmedia.com", "sky.com", "talktalk.net",
            "orange.fr", "wanadoo.fr", "free.fr", "laposte.net", "sfr.fr",
            "t-online.de", "web.de",
          ];

          const isPersonalEmail = personalEmailDomains.includes(emailDomain);

          // Block personal email addresses from creating new tenants
          if (isPersonalEmail) {
            console.log("[WorkOS Callback] Personal email blocked from creating tenant:", user.email);

            // Store the blocked signup attempt for tracking
            try {
              await prisma.blockedSignup.create({
                data: {
                  email: user.email,
                  domain: emailDomain,
                  workosId: user.id,
                  reason: "personal_email",
                  name: userName,
                  ipAddress: request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || null,
                  userAgent: request.headers.get("user-agent") || null,
                },
              });
              console.log("[WorkOS Callback] Blocked signup recorded:", user.email);
            } catch (logError) {
              console.error("[WorkOS Callback] Failed to log blocked signup:", logError);
              // Continue even if logging fails
            }

            // Delete the user from WorkOS to clear their session
            try {
              await workos.userManagement.deleteUser(user.id);
              console.log("[WorkOS Callback] Deleted WorkOS user:", user.id);
            } catch (deleteError) {
              console.error("[WorkOS Callback] Failed to delete WorkOS user:", deleteError);
              // Continue even if deletion fails - user will still be blocked
            }

            return NextResponse.redirect(new URL("/business-email-required", request.url));
          }

          // Check if tenant with this domain already exists
          let tenant = null;
          if (emailDomain) {
            tenant = await prisma.tenant.findFirst({
              where: { primaryDomain: emailDomain },
            });
          }

          if (tenant) {
            // Tenant exists - create user WITHOUT tenantId and create a join request
            dbUser = await prisma.user.create({
              data: {
                workosId: user.id,
                email: user.email,
                name: userName,
                avatarUrl: user.profilePictureUrl,
                emailVerified: user.emailVerified ? new Date() : null,
                lastLoginAt: new Date(),
                // NO tenantId - user must be approved first
                role: "MEMBER",
              },
              include: {
                tenant: {
                  select: { id: true, slug: true },
                },
              },
            });

            // Create join request
            await prisma.joinRequest.create({
              data: {
                userId: dbUser.id,
                email: user.email,
                tenantId: tenant.id,
                status: "PENDING",
              },
            });

            // Create audit log for the tenant
            await prisma.auditLog.create({
              data: {
                tenantId: tenant.id,
                userId: dbUser.id,
                action: "join_request.created",
                entityType: "JoinRequest",
                entityId: dbUser.id,
                metadata: { email: user.email, tenantName: tenant.name },
              },
            });

            console.log("[WorkOS Callback] User created with pending join request:", dbUser.id, "for tenant:", tenant.id);
          } else {
            // No tenant exists for this domain - create new tenant and user as owner
            // Note: Personal emails are blocked above, so we always have a business domain here
            const tenantName = emailDomain.split(".")[0].charAt(0).toUpperCase() + emailDomain.split(".")[0].slice(1);
            const tenantSlug = `${emailDomain.replace(/\./g, "-")}-${Date.now().toString(36)}`;

            tenant = await prisma.tenant.create({
              data: {
                name: tenantName,
                slug: tenantSlug,
                primaryDomain: emailDomain,
              },
            });

            dbUser = await prisma.user.create({
              data: {
                workosId: user.id,
                email: user.email,
                name: userName,
                avatarUrl: user.profilePictureUrl,
                emailVerified: user.emailVerified ? new Date() : null,
                lastLoginAt: new Date(),
                tenantId: tenant.id,
                role: "OWNER",
              },
              include: {
                tenant: {
                  select: { id: true, slug: true },
                },
              },
            });
            console.log("[WorkOS Callback] User and tenant created:", dbUser.id, tenant.id);
          }
        }
      }
    } catch (dbError) {
      console.error("[WorkOS Callback] Database error:", dbError);
      // CRITICAL: We MUST have a database user with a valid UUID
      // Without it, Prisma operations will fail with UUID errors
      return NextResponse.redirect(new URL("/login?error=DatabaseError&details=Failed+to+create+user+account", request.url));
    }

    // CRITICAL: Verify we have a valid database user with UUID
    // Never create a session without a valid database user ID
    if (!dbUser?.id) {
      console.error("[WorkOS Callback] No database user ID available - cannot create session");
      return NextResponse.redirect(new URL("/login?error=NoUser&details=Failed+to+create+user+account", request.url));
    }

    // Create a simple JWT session token using jose
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      id: dbUser.id, // Database user ID (UUID) - REQUIRED for Prisma operations
      sub: user.id,
      email: user.email,
      name: userName || user.email,
      picture: user.profilePictureUrl,
      workosId: user.id,
      sessionId: sessionId, // Store WorkOS session ID for logout
      // Include tenant info if user is part of a tenant
      tenantId: dbUser.tenant?.id || null,
      tenantSlug: dbUser.tenant?.slug || null,
      role: dbUser.role || "MEMBER",
      iat: Math.floor(Date.now() / 1000),
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(secret);

    console.log("[WorkOS Callback] JWT created, setting cookie...");

    // Set the session cookie
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Redirect based on tenant status
    if (!dbUser.tenant) {
      // User has no tenant - check if they have a pending join request
      console.log("[WorkOS Callback] User has no tenant, redirecting to pending-approval");
      return NextResponse.redirect(new URL("/pending-approval", request.url));
    }

    console.log("[WorkOS Callback] Cookie set, redirecting to dashboard");
    return NextResponse.redirect(new URL("/", request.url));
  } catch (err: unknown) {
    console.error("[WorkOS Callback] Error:", err);

    // Extract error details safely
    let errorCode = "AuthFailed";
    let errorMessage = "Unknown error";

    if (err instanceof Error) {
      errorMessage = err.message;
      console.error("[WorkOS Callback] Error stack:", err.stack);

      // Check for specific WorkOS errors
      if (errorMessage.includes("invalid_grant") || errorMessage.includes("code")) {
        errorCode = "InvalidCode";
        errorMessage = "Authorization code expired or already used. Please try again.";
      }
    }

    // Log the full error for debugging
    try {
      console.error("[WorkOS Callback] Full error:", JSON.stringify(err, Object.getOwnPropertyNames(err || {})));
    } catch {
      console.error("[WorkOS Callback] Could not stringify error");
    }

    // Keep the error message short for URL safety
    const shortMessage = errorMessage.substring(0, 100);
    return NextResponse.redirect(new URL(`/login?error=${errorCode}&details=${encodeURIComponent(shortMessage)}`, request.url));
  }
}
