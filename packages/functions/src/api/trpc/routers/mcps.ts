import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

export const mcpsRouter = router({
  /**
   * List all MCPs for the current tenant
   */
  list: protectedProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "ACTIVE", "DISABLED", "ERROR"]).optional(),
        type: z.enum(["API", "DOCUMENTATION", "HYBRID"]).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, type, cursor, limit = 20 } = input ?? {};

      const mcps = await ctx.tenant.db.mcp.findMany({
        where: {
          ...(status && { status }),
          ...(type && { type }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { usageEvents: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (mcps.length > limit) {
        const nextItem = mcps.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: mcps,
        nextCursor,
      };
    }),

  /**
   * Get a single MCP by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const mcp = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          secrets: {
            select: { id: true, keyName: true, lastFourChars: true, createdAt: true },
          },
        },
      });

      if (!mcp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      return mcp;
    }),

  /**
   * Create a new MCP
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(255),
        description: z.string().max(2000).optional(),
        type: z.enum(["API", "DOCUMENTATION", "HYBRID"]),
        configJson: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mcp = await ctx.tenant.db.mcp.create({
        data: {
          name: input.name,
          description: input.description,
          type: input.type,
          configJson: input.configJson ?? {},
          createdById: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp.created",
          entityType: "Mcp",
          entityId: mcp.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: mcp.name, type: mcp.type },
        },
      });

      return mcp;
    }),

  /**
   * Update an MCP
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().max(2000).optional(),
        configJson: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.mcp.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      const mcp = await ctx.tenant.db.mcp.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.configJson !== undefined && { configJson: data.configJson }),
        },
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp.updated",
          entityType: "Mcp",
          entityId: mcp.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { changes: data },
        },
      });

      return mcp;
    }),

  /**
   * Enable an MCP
   */
  enable: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      const mcp = await ctx.tenant.db.mcp.update({
        where: { id: input.id },
        data: { status: "ACTIVE" },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp.enabled",
          entityType: "Mcp",
          entityId: mcp.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      return mcp;
    }),

  /**
   * Disable an MCP
   */
  disable: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      const mcp = await ctx.tenant.db.mcp.update({
        where: { id: input.id },
        data: { status: "DISABLED" },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp.disabled",
          entityType: "Mcp",
          entityId: mcp.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      return mcp;
    }),

  /**
   * Delete an MCP (admin only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      await ctx.tenant.db.mcp.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp.deleted",
          entityType: "Mcp",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: existing.name },
        },
      });

      return { success: true };
    }),

  // ============================================
  // VERSION MANAGEMENT
  // ============================================

  /**
   * List versions for an MCP
   */
  listVersions: protectedProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        status: z.enum(["DRAFT", "PUBLISHED", "DEPRECATED"]).optional(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const { mcpId, status, cursor, limit } = input;

      // Verify MCP exists
      const mcp = await ctx.tenant.db.mcp.findUnique({
        where: { id: mcpId },
        select: { id: true },
      });

      if (!mcp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      const versions = await ctx.tenant.db.mcpVersion.findMany({
        where: {
          mcpId,
          ...(status && { status }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { deployments: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (versions.length > limit) {
        const nextItem = versions.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: versions,
        nextCursor,
      };
    }),

  /**
   * Get a specific version
   */
  getVersion: protectedProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        versionId: z.string().uuid(),
      })
    )
    .query(async ({ ctx, input }) => {
      const version = await ctx.tenant.db.mcpVersion.findUnique({
        where: { id: input.versionId },
        include: {
          mcp: {
            select: { id: true, name: true },
          },
          deployments: {
            where: { deletedAt: null },
            select: { id: true, name: true, status: true, environment: true },
          },
          tools: {
            include: {
              version: false, // Don't circular include
            },
          },
        },
      });

      if (!version || version.mcpId !== input.mcpId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      return version;
    }),

  /**
   * Create a new version (draft)
   */
  createVersion: protectedProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        version: z
          .string()
          .regex(/^\d+\.\d+\.\d+$/, "Version must be semver (e.g., 1.0.0)"),
        changelog: z.string().max(5000).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mcp = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.mcpId },
      });

      if (!mcp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      // Check for duplicate version
      const existing = await ctx.tenant.db.mcpVersion.findFirst({
        where: {
          mcpId: input.mcpId,
          version: input.version,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Version ${input.version} already exists`,
        });
      }

      const version = await ctx.tenant.db.mcpVersion.create({
        data: {
          mcpId: input.mcpId,
          version: input.version,
          changelog: input.changelog,
          status: "DRAFT",
          configSnapshot: mcp.configJson ?? {},
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp_version.created",
          entityType: "McpVersion",
          entityId: version.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { mcpId: input.mcpId, version: input.version },
        },
      });

      return version;
    }),

  /**
   * Publish a version (makes it immutable and deployable)
   */
  publishVersion: adminProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        versionId: z.string().uuid(),
        imageUri: z.string().url().optional(),
        imageDigest: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.tenant.db.mcpVersion.findUnique({
        where: { id: input.versionId },
        include: { mcp: true },
      });

      if (!version || version.mcpId !== input.mcpId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      if (version.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot publish version in ${version.status} status`,
        });
      }

      const updated = await ctx.tenant.db.mcpVersion.update({
        where: { id: input.versionId },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          imageUri: input.imageUri,
          imageDigest: input.imageDigest,
          // Freeze the config snapshot
          configSnapshot: version.mcp.configJson ?? {},
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp_version.published",
          entityType: "McpVersion",
          entityId: version.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { version: version.version },
        },
      });

      return updated;
    }),

  /**
   * Deprecate a version (prevents new deployments)
   */
  deprecateVersion: adminProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        versionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.tenant.db.mcpVersion.findUnique({
        where: { id: input.versionId },
      });

      if (!version || version.mcpId !== input.mcpId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      if (version.status !== "PUBLISHED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only deprecate published versions",
        });
      }

      const updated = await ctx.tenant.db.mcpVersion.update({
        where: { id: input.versionId },
        data: {
          status: "DEPRECATED",
          deprecatedAt: new Date(),
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp_version.deprecated",
          entityType: "McpVersion",
          entityId: version.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { version: version.version },
        },
      });

      return updated;
    }),

  /**
   * Delete a draft version
   */
  deleteVersion: adminProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        versionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const version = await ctx.tenant.db.mcpVersion.findUnique({
        where: { id: input.versionId },
        include: {
          _count: { select: { deployments: true } },
        },
      });

      if (!version || version.mcpId !== input.mcpId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Version not found",
        });
      }

      if (version.status !== "DRAFT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only delete draft versions. Deprecate published versions instead.",
        });
      }

      if (version._count.deployments > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete version with active deployments",
        });
      }

      await ctx.tenant.db.mcpVersion.delete({
        where: { id: input.versionId },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp_version.deleted",
          entityType: "McpVersion",
          entityId: input.versionId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { version: version.version },
        },
      });

      return { success: true };
    }),

  // ============================================
  // CONFIG FIELDS MANAGEMENT
  // ============================================

  /**
   * List config fields for an MCP
   */
  listConfigFields: protectedProcedure
    .input(z.object({ mcpId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const fields = await ctx.tenant.db.mcpConfigField.findMany({
        where: { mcpId: input.mcpId },
        orderBy: { ordering: "asc" },
      });

      return fields;
    }),

  /**
   * Upsert a config field
   */
  upsertConfigField: protectedProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        id: z.string().uuid().optional(), // If provided, update; otherwise create
        key: z.string().min(1).max(100).regex(/^[A-Z_][A-Z0-9_]*$/, "Key must be UPPER_SNAKE_CASE"),
        type: z.enum(["STRING", "NUMBER", "BOOLEAN", "SECRET", "JSON", "URL"]).default("STRING"),
        label: z.string().min(1).max(255),
        description: z.string().max(1000).optional(),
        required: z.boolean().default(false),
        defaultValue: z.string().max(1000).optional(),
        validation: z.record(z.unknown()).optional(),
        ordering: z.number().min(0).max(100).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { mcpId, id, ...data } = input;

      // Verify MCP exists
      const mcp = await ctx.tenant.db.mcp.findUnique({
        where: { id: mcpId },
        select: { id: true },
      });

      if (!mcp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      if (id) {
        // Update existing
        const existing = await ctx.tenant.db.mcpConfigField.findUnique({
          where: { id },
        });

        if (!existing || existing.mcpId !== mcpId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Config field not found",
          });
        }

        return ctx.tenant.db.mcpConfigField.update({
          where: { id },
          data: {
            key: data.key,
            type: data.type,
            label: data.label,
            description: data.description,
            required: data.required,
            defaultValue: data.defaultValue,
            validation: data.validation ?? {},
            ordering: data.ordering,
          },
        });
      } else {
        // Create new
        return ctx.tenant.db.mcpConfigField.create({
          data: {
            mcpId,
            key: data.key,
            type: data.type,
            label: data.label,
            description: data.description,
            required: data.required,
            defaultValue: data.defaultValue,
            validation: data.validation ?? {},
            ordering: data.ordering,
          },
        });
      }
    }),

  /**
   * Delete a config field
   */
  deleteConfigField: protectedProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        fieldId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const field = await ctx.tenant.db.mcpConfigField.findUnique({
        where: { id: input.fieldId },
      });

      if (!field || field.mcpId !== input.mcpId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Config field not found",
        });
      }

      await ctx.tenant.db.mcpConfigField.delete({
        where: { id: input.fieldId },
      });

      return { success: true };
    }),

  // ============================================
  // SECRET SLOTS MANAGEMENT
  // ============================================

  /**
   * List secret slots for an MCP
   */
  listSecretSlots: protectedProcedure
    .input(z.object({ mcpId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const slots = await ctx.tenant.db.mcpSecretSlot.findMany({
        where: { mcpId: input.mcpId },
        orderBy: { slot: "asc" },
      });

      // Mask the ARN for security
      return slots.map((s) => ({
        ...s,
        secretArn: s.secretArn ? `arn:aws:secretsmanager:***:${s.secretArn.split(":").pop()}` : null,
        hasSecret: !!s.secretArn,
      }));
    }),

  /**
   * Upsert a secret slot
   */
  upsertSecretSlot: adminProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        slot: z.string().min(1).max(100).regex(/^[A-Z_][A-Z0-9_]*$/),
        secretArn: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const mcp = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.mcpId },
        select: { id: true },
      });

      if (!mcp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      const slot = await ctx.tenant.db.mcpSecretSlot.upsert({
        where: {
          mcpId_slot: {
            mcpId: input.mcpId,
            slot: input.slot,
          },
        },
        create: {
          mcpId: input.mcpId,
          slot: input.slot,
          secretArn: input.secretArn,
        },
        update: {
          secretArn: input.secretArn,
          lastRotated: input.secretArn ? new Date() : undefined,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp_secret_slot.updated",
          entityType: "McpSecretSlot",
          entityId: slot.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { mcpId: input.mcpId, slot: input.slot },
        },
      });

      return {
        ...slot,
        secretArn: slot.secretArn ? "***" : null,
        hasSecret: !!slot.secretArn,
      };
    }),

  /**
   * Delete a secret slot
   */
  deleteSecretSlot: adminProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        slot: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.mcpSecretSlot.findFirst({
        where: {
          mcpId: input.mcpId,
          slot: input.slot,
        },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Secret slot not found",
        });
      }

      await ctx.tenant.db.mcpSecretSlot.delete({
        where: { id: existing.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "mcp_secret_slot.deleted",
          entityType: "McpSecretSlot",
          entityId: existing.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { slot: input.slot },
        },
      });

      return { success: true };
    }),
});
