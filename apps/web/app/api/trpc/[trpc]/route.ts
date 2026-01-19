import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter, createContext } from "@repo/functions";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { initDatabaseUrl } from "@repo/db";

const SESSION_COOKIE = "__Secure-authjs.session-token";

// Extract session from our custom JWT cookie
async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
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

    // UUID format regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // User ID should be the internal database UUID (set by auth.ts JWT callback)
    // The JWT callback looks up users by workosId and sets token.id to the database UUID
    const userId = payload.id as string | undefined;
    if (!userId || !uuidRegex.test(userId)) {
      console.error("[tRPC] Invalid or missing user ID in session - user must re-login");
      return null;
    }

    // Validate tenant ID (optional, but if present must be UUID)
    const tenantId = payload.tenantId as string | null | undefined;
    if (tenantId && !uuidRegex.test(tenantId)) {
      console.error("[tRPC] Invalid tenant ID format in session - user must re-login");
      return null;
    }

    return {
      user: {
        id: userId,
        email: payload.email as string,
        name: payload.name as string | null,
        image: payload.picture as string | null,
        tenantId: tenantId || null,
        tenantSlug: payload.tenantSlug as string | null,
        role: payload.role as string | undefined,
      },
    };
  } catch (error) {
    console.error("[tRPC] Failed to verify session:", error);
    return null;
  }
}

const handler = async (req: Request) => {
  // Initialize database URL from SST Resources before any Prisma calls
  await initDatabaseUrl();

  const session = await getSession();

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: async ({ req }) => {
      return createContext({
        headers: req.headers,
        session: session,
      });
    },
    onError:
      process.env.NODE_ENV === "development"
        ? ({ path, error }) => {
            console.error(
              `tRPC failed on ${path ?? "<no-path>"}: ${error.message}`
            );
          }
        : undefined,
  });
};

export { handler as GET, handler as POST };
