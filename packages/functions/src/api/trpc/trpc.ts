import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import superjson from "superjson";
import type { RequestContext, TenantContext } from "@repo/core/tenant";
import {
  AuthError,
  requireRole,
  type SessionData,
  sessionToTenantContext,
} from "@repo/core/auth";
import { createTenantClient, prisma } from "@repo/db";

/**
 * Session with optional tenant context
 */
interface AuthenticatedSession {
  user: SessionData["user"];
  tenantContext: TenantContext | null;
  db: ReturnType<typeof createTenantClient> | null;
}

/**
 * tRPC Context - created for each request
 */
export interface Context {
  // Raw request info
  headers: Headers;

  // Auth info (null if not authenticated)
  session: AuthenticatedSession | null;

  // Legacy field for compatibility - points to tenant context with DB
  tenant: RequestContext | null;
}

/**
 * Create context options
 */
export interface CreateContextOptions {
  headers: Headers;
  session: SessionData | null;
}

/**
 * Create context from request
 */
export async function createContext(opts: CreateContextOptions): Promise<Context> {
  let session: AuthenticatedSession | null = null;
  let tenant: RequestContext | null = null;

  if (opts.session?.user) {
    const tenantContext = sessionToTenantContext(opts.session);
    let db = null;

    if (tenantContext) {
      db = createTenantClient(tenantContext.tenantId);
      tenant = {
        ...tenantContext,
        db,
      };
    }

    session = {
      user: opts.session.user,
      tenantContext,
      db,
    };
  }

  return {
    headers: opts.headers,
    session,
    tenant,
  };
}

/**
 * Initialize tRPC
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Middleware: Require authentication
 */
const isAuthenticated = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Middleware: Require tenant membership
 */
const hasTenant = t.middleware(({ ctx, next }) => {
  if (!ctx.tenant) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be a member of an organization to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenant: ctx.tenant,
    },
  });
});

/**
 * Middleware: Require specific role
 */
const withRole = (...roles: string[]) => {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.tenant) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    try {
      requireRole(...roles)(ctx.tenant.userRole);
    } catch (error) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of roles: ${roles.join(", ")}`,
      });
    }

    return next({
      ctx: {
        ...ctx,
        tenant: ctx.tenant,
      },
    });
  });
};

/**
 * Reusable router and procedure helpers
 */
export const router = t.router;

// Public procedure - no auth required
export const publicProcedure = t.procedure;

// Auth required but tenant optional (for users without org)
export const authenticatedProcedure = t.procedure.use(isAuthenticated);

// Protected procedure - requires auth AND tenant membership
export const protectedProcedure = t.procedure.use(isAuthenticated).use(hasTenant);

// Admin procedure - requires ADMIN or OWNER role
export const adminProcedure = t.procedure
  .use(isAuthenticated)
  .use(withRole("ADMIN", "OWNER"));

// Owner procedure - requires OWNER role only
export const ownerProcedure = t.procedure
  .use(isAuthenticated)
  .use(withRole("OWNER"));

/**
 * Merge routers
 */
export const mergeRouters = t.mergeRouters;
