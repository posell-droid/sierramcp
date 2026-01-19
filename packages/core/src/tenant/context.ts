import { AsyncLocalStorage } from "async_hooks";
import { createTenantClient, TenantClient, prisma } from "@repo/db";

/**
 * Tenant context that flows through the entire request
 */
export interface TenantContext {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  userRole: string;
}

/**
 * Extended context with database client
 */
export interface RequestContext extends TenantContext {
  db: TenantClient;
}

// AsyncLocalStorage for request-scoped tenant context
const tenantStorage = new AsyncLocalStorage<RequestContext>();

/**
 * Get the current tenant context
 * Throws if called outside of a tenant-scoped request
 */
export function getTenantContext(): RequestContext {
  const context = tenantStorage.getStore();
  
  if (!context) {
    throw new Error(
      "getTenantContext called outside of tenant scope. " +
      "Ensure you're calling this within a request handler wrapped with withTenantContext."
    );
  }
  
  return context;
}

/**
 * Get the current tenant context, or null if not in a tenant scope
 */
export function getTenantContextOrNull(): RequestContext | null {
  return tenantStorage.getStore() ?? null;
}

/**
 * Run a function within a tenant context
 * 
 * Usage:
 *   await withTenantContext(tenantContext, async () => {
 *     const ctx = getTenantContext();
 *     const projects = await ctx.db.project.findMany();
 *   });
 */
export async function withTenantContext<T>(
  context: TenantContext,
  fn: () => Promise<T>
): Promise<T> {
  const db = createTenantClient(context.tenantId);
  
  const requestContext: RequestContext = {
    ...context,
    db,
  };
  
  return tenantStorage.run(requestContext, fn);
}

/**
 * Helper to get just the tenant-scoped database client
 */
export function getTenantDb(): TenantClient {
  return getTenantContext().db;
}

/**
 * For operations that need to span tenants (admin, migrations, etc.)
 * Use with extreme caution!
 */
export function getGlobalDb() {
  return prisma;
}

export { createTenantClient, type TenantClient };
