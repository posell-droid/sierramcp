import { PrismaClient } from "@prisma/client";

// Singleton pattern for Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  dbUrlInitialized: boolean | undefined;
};

/**
 * Initialize DATABASE_URL from SST Resources (synchronous version)
 * Called automatically when prisma is first accessed
 */
function initDatabaseUrlSync(): void {
  if (globalForPrisma.dbUrlInitialized || process.env.DATABASE_URL) {
    return;
  }

  try {
    // Try synchronous require for SST resources
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Resource } = require("sst");
    const db = (Resource as any).Database;
    if (db) {
      process.env.DATABASE_URL = `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}?sslmode=require`;
      globalForPrisma.dbUrlInitialized = true;
    }
  } catch {
    // SST not available - DATABASE_URL must be set via env
  }
}

/**
 * Initialize DATABASE_URL from SST Resources
 * Must be called before using prisma client in Lambda
 */
export async function initDatabaseUrl(): Promise<void> {
  if (globalForPrisma.dbUrlInitialized || process.env.DATABASE_URL) {
    return;
  }

  try {
    const { Resource } = await import("sst");
    const db = (Resource as any).Database;
    if (db) {
      process.env.DATABASE_URL = `postgresql://${db.username}:${db.password}@${db.host}:${db.port}/${db.database}?sslmode=require`;
      globalForPrisma.dbUrlInitialized = true;
    }
  } catch {
    // SST not available - DATABASE_URL must be set via env
  }
}

function createPrismaClient(): PrismaClient {
  // Initialize DATABASE_URL before creating client
  initDatabaseUrlSync();

  return new PrismaClient({
    log: process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"],
  });
}

/**
 * Get initialized Prisma client
 * Use this in Lambda/SST environments
 */
export async function getPrisma(): Promise<PrismaClient> {
  await initDatabaseUrl();

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }

  return globalForPrisma.prisma;
}

/**
 * Lazily initialized Prisma client
 * DATABASE_URL will be initialized from SST Resources on first access
 */
function getLazyPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return globalForPrisma.prisma;
}

// Proxy that lazily initializes the Prisma client on first property access
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getLazyPrisma();
    const value = (client as any)[prop];
    if (typeof value === "function") {
      return value.bind(client);
    }
    return value;
  },
});

if (process.env.NODE_ENV !== "production") {
  // In development, we might already have a client
}

// Re-export everything from Prisma client
export * from "@prisma/client";

// Models that should be tenant-scoped
const TENANT_SCOPED_MODELS = [
  "User",
  "Invitation",
  "ApiKey",
  "AuditLog",
  "JoinRequest",
  "Mcp",
  "Secret",
  "UsageEvent",
  "UsageAggregate",
  // Applications & Tools
  "Application",
  "ApplicationEnvironment",
  "ApplicationDocument",
  "DocumentChunk",
  "Tool",
  "ToolTestResult",
  "ToolExecution",
];

/**
 * Tenant-scoped database client
 *
 * This creates a "view" of the database that automatically filters
 * all queries by tenant_id. Use this in request handlers after
 * extracting the tenant from the auth context.
 *
 * Usage:
 *   const db = createTenantClient(tenantId);
 *   const mcps = await db.mcp.findMany(); // Auto-filtered by tenant
 */
export function createTenantClient(tenantId: string) {
  return prisma.$extends({
    name: "tenantScope",
    query: {
      $allModels: {
        async findMany({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async findFirst({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async findUnique({ model, operation, args, query }) {
          // For findUnique, we verify after the query
          const result = await query(args);

          if (
            TENANT_SCOPED_MODELS.includes(model) &&
            result &&
            "tenantId" in result &&
            result.tenantId !== tenantId
          ) {
            return null; // Don't expose data from other tenants
          }

          return result;
        },

        async create({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            (args as any).data = { ...(args as any).data, tenantId };
          }
          return query(args);
        },

        async update({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async delete({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async deleteMany({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async updateMany({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },

        async count({ model, operation, args, query }) {
          if (TENANT_SCOPED_MODELS.includes(model)) {
            args.where = { ...args.where, tenantId };
          }
          return query(args);
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof createTenantClient>;
