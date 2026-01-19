/**
 * Tool Query Examples
 *
 * This file contains example Prisma queries for common tool operations.
 * These patterns should be used in the tRPC routers.
 */

import type { PrismaClient, ToolStatus } from "@prisma/client";

// ============================================
// QUERY 1: List tools for application
// ============================================
// Shows all tools for an application (latest versions only)

export async function listToolsForApplication(
  db: PrismaClient,
  tenantId: string,
  applicationId: string,
  options?: {
    status?: ToolStatus;
    limit?: number;
    offset?: number;
  }
) {
  const { status, limit = 50, offset = 0 } = options ?? {};

  return db.tool.findMany({
    where: {
      tenantId,
      applicationId,
      isLatest: true, // Only show latest versions
      ...(status && { status }),
    },
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
      status: true,
      httpMethod: true,
      pathTemplate: true,
      version: true,
      isLatest: true,
      readOnly: true,
      destructive: true,
      publishedAt: true,
      updatedAt: true,
      createdAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    skip: offset,
  });
}

// ============================================
// QUERY 2: Get latest tool version by name
// ============================================
// Finds the most recent version of a tool by its name

export async function getLatestToolVersion(
  db: PrismaClient,
  tenantId: string,
  applicationId: string,
  toolName: string
) {
  // Option A: Using isLatest flag (fastest, single query)
  const tool = await db.tool.findFirst({
    where: {
      tenantId,
      applicationId,
      name: toolName,
      isLatest: true,
    },
  });

  return tool;
}

// Alternative: Find by max version (slower, but works without isLatest)
export async function getLatestToolVersionByMaxVersion(
  db: PrismaClient,
  tenantId: string,
  applicationId: string,
  toolName: string
) {
  const tool = await db.tool.findFirst({
    where: {
      tenantId,
      applicationId,
      name: toolName,
    },
    orderBy: { version: "desc" },
    take: 1,
  });

  return tool;
}

// ============================================
// QUERY 3: Get all versions of a tool
// ============================================
// Shows version history for a tool

export async function getToolVersionHistory(
  db: PrismaClient,
  tenantId: string,
  applicationId: string,
  toolName: string
) {
  return db.tool.findMany({
    where: {
      tenantId,
      applicationId,
      name: toolName,
    },
    select: {
      id: true,
      version: true,
      status: true,
      isLatest: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      createdBy: {
        select: { name: true, email: true },
      },
    },
    orderBy: { version: "desc" },
  });
}

// ============================================
// QUERY 4: Create new draft version from published tool
// ============================================
// Workflow: Published tool -> Create new draft version for editing

export async function createNewVersionFromPublished(
  db: PrismaClient,
  tenantId: string,
  publishedToolId: string,
  createdById: string
) {
  // Step 1: Get the published tool
  const publishedTool = await db.tool.findUnique({
    where: { id: publishedToolId },
  });

  if (!publishedTool) {
    throw new Error("Tool not found");
  }

  if (publishedTool.tenantId !== tenantId) {
    throw new Error("Access denied");
  }

  if (publishedTool.status !== "PUBLISHED") {
    throw new Error("Can only create new version from a PUBLISHED tool");
  }

  // Step 2: Use transaction to:
  //   a) Mark old version as not latest
  //   b) Create new version
  const result = await db.$transaction(async (tx) => {
    // Mark the old version as not latest
    await tx.tool.update({
      where: { id: publishedToolId },
      data: { isLatest: false },
    });

    // Create new version
    const newTool = await tx.tool.create({
      data: {
        tenantId: publishedTool.tenantId,
        applicationId: publishedTool.applicationId,
        name: publishedTool.name,
        title: publishedTool.title,
        description: publishedTool.description,
        httpMethod: publishedTool.httpMethod,
        pathTemplate: publishedTool.pathTemplate,
        version: publishedTool.version + 1,
        isLatest: true,
        parentToolId: publishedToolId,
        status: "DRAFT", // New version starts as draft
        spec: publishedTool.spec,
        readOnly: publishedTool.readOnly,
        destructive: publishedTool.destructive,
        pii: publishedTool.pii,
        sources: publishedTool.sources,
        testCases: publishedTool.testCases,
        examples: publishedTool.examples,
        authType: publishedTool.authType,
        authScopes: publishedTool.authScopes,
        createdById,
      },
    });

    return newTool;
  });

  return result;
}

// ============================================
// QUERY 5: Publish a tool (with version workflow)
// ============================================
// When publishing, ensure isLatest is properly managed

export async function publishTool(
  db: PrismaClient,
  tenantId: string,
  toolId: string
) {
  const tool = await db.tool.findUnique({
    where: { id: toolId },
  });

  if (!tool) {
    throw new Error("Tool not found");
  }

  if (tool.tenantId !== tenantId) {
    throw new Error("Access denied");
  }

  if (tool.status !== "TESTED") {
    throw new Error("Tool must be TESTED before publishing");
  }

  // Publish the tool
  return db.tool.update({
    where: { id: toolId },
    data: {
      status: "PUBLISHED",
      publishedAt: new Date(),
      isLatest: true, // Ensure it's marked as latest
    },
  });
}

// ============================================
// QUERY 6: List published tools for MCP server
// ============================================
// Only returns PUBLISHED tools for runtime use

export async function listPublishedToolsForMcp(
  db: PrismaClient,
  tenantId: string,
  applicationId: string
) {
  return db.tool.findMany({
    where: {
      tenantId,
      applicationId,
      status: "PUBLISHED",
      isLatest: true, // Only latest published versions
    },
    select: {
      id: true,
      name: true,
      title: true,
      description: true,
      httpMethod: true,
      pathTemplate: true,
      spec: true,
      readOnly: true,
      destructive: true,
      authType: true,
      authScopes: true,
    },
  });
}

// ============================================
// QUERY 7: Get tool with version lineage
// ============================================
// Includes parent tool reference for version tracking

export async function getToolWithLineage(
  db: PrismaClient,
  tenantId: string,
  toolId: string
) {
  return db.tool.findUnique({
    where: { id: toolId },
    include: {
      parentTool: {
        select: {
          id: true,
          version: true,
          status: true,
          publishedAt: true,
        },
      },
      childVersions: {
        select: {
          id: true,
          version: true,
          status: true,
          createdAt: true,
        },
        orderBy: { version: "desc" },
      },
    },
  });
}

// ============================================
// EXAMPLE RAW SQL QUERIES
// ============================================
// For complex queries that benefit from raw SQL

/**
 * Get tools with test result counts (aggregate query)
 */
export async function listToolsWithTestCounts(
  db: PrismaClient,
  tenantId: string,
  applicationId: string
) {
  // Using Prisma's $queryRaw for complex aggregates
  const result = await db.$queryRaw<
    Array<{
      id: string;
      name: string;
      title: string;
      status: string;
      version: number;
      test_count: bigint;
      success_count: bigint;
    }>
  >`
    SELECT
      t.id,
      t.name,
      t.title,
      t.status,
      t.version,
      COUNT(tr.id) as test_count,
      COUNT(CASE WHEN tr.success = true THEN 1 END) as success_count
    FROM tools t
    LEFT JOIN tool_test_results tr ON t.id = tr."toolId"
    WHERE t."tenantId" = ${tenantId}::uuid
      AND t."applicationId" = ${applicationId}::uuid
      AND t."isLatest" = true
    GROUP BY t.id, t.name, t.title, t.status, t.version
    ORDER BY t."updatedAt" DESC
  `;

  return result.map((r) => ({
    ...r,
    testCount: Number(r.test_count),
    successCount: Number(r.success_count),
  }));
}
