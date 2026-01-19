import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Zod schemas matching Prisma enums
const ResponseStyleSchema = z.enum([
  "PROFESSIONAL",
  "FRIENDLY",
  "CONCISE",
  "TECHNICAL",
]);
const ToolBehaviorSchema = z.enum(["AUTO", "MANUAL", "CONFIRM"]);

export const botProfilesRouter = router({
  /**
   * List bot profiles for the current tenant
   */
  list: protectedProcedure
    .input(
      z
        .object({
          isActive: z.boolean().optional(),
          cursor: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { isActive, cursor, limit = 20 } = input ?? {};

      const profiles = await ctx.tenant.db.botProfile.findMany({
        where: {
          ...(isActive !== undefined && { isActive }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
        include: {
          _count: {
            select: { routes: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (profiles.length > limit) {
        const nextItem = profiles.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: profiles,
        nextCursor,
        total_count: await ctx.tenant.db.botProfile.count({
          where: {
            ...(isActive !== undefined && { isActive }),
          },
        }),
      };
    }),

  /**
   * Get a single bot profile by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const profile = await ctx.tenant.db.botProfile.findUnique({
        where: { id: input.id },
        include: {
          routes: {
            include: {
              deployment: {
                select: { id: true, name: true, status: true },
              },
            },
          },
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bot profile not found",
        });
      }

      return profile;
    }),

  /**
   * Get the default bot profile (or null if none)
   */
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    const profile = await ctx.tenant.db.botProfile.findFirst({
      where: { isDefault: true },
    });

    return profile;
  }),

  /**
   * Create a new bot profile
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/, "Name must be lowercase alphanumeric with hyphens"),
        displayName: z.string().min(1).max(255),
        avatarUrl: z.string().url().optional(),
        systemPrompt: z.string().max(10000).optional(),
        responseStyle: ResponseStyleSchema.default("PROFESSIONAL"),
        toolBehavior: ToolBehaviorSchema.default("AUTO"),
        enableStreaming: z.boolean().default(true),
        enableCitations: z.boolean().default(true),
        maxTokens: z.number().min(256).max(8192).default(4096),
        modelId: z.string().max(100).optional(),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check for duplicate name
      const existing = await ctx.tenant.db.botProfile.findFirst({
        where: { name: input.name },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Bot profile with this name already exists",
        });
      }

      // If setting as default, unset other defaults
      if (input.isDefault) {
        await ctx.tenant.db.botProfile.updateMany({
          where: { isDefault: true },
          data: { isDefault: false },
        });
      }

      const profile = await ctx.tenant.db.botProfile.create({
        data: {
          tenantId: ctx.tenant.tenantId,
          name: input.name,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl,
          systemPrompt: input.systemPrompt,
          responseStyle: input.responseStyle,
          toolBehavior: input.toolBehavior,
          enableStreaming: input.enableStreaming,
          enableCitations: input.enableCitations,
          maxTokens: input.maxTokens,
          modelId: input.modelId,
          isDefault: input.isDefault,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "bot_profile.created",
          entityType: "BotProfile",
          entityId: profile.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: profile.name, displayName: profile.displayName },
        },
      });

      return profile;
    }),

  /**
   * Update a bot profile
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        displayName: z.string().min(1).max(255).optional(),
        avatarUrl: z.string().url().nullish(),
        systemPrompt: z.string().max(10000).nullish(),
        responseStyle: ResponseStyleSchema.optional(),
        toolBehavior: ToolBehaviorSchema.optional(),
        enableStreaming: z.boolean().optional(),
        enableCitations: z.boolean().optional(),
        maxTokens: z.number().min(256).max(8192).optional(),
        modelId: z.string().max(100).nullish(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.botProfile.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bot profile not found",
        });
      }

      const profile = await ctx.tenant.db.botProfile.update({
        where: { id },
        data: {
          ...(data.displayName !== undefined && { displayName: data.displayName }),
          ...(data.avatarUrl !== undefined && { avatarUrl: data.avatarUrl }),
          ...(data.systemPrompt !== undefined && { systemPrompt: data.systemPrompt }),
          ...(data.responseStyle !== undefined && { responseStyle: data.responseStyle }),
          ...(data.toolBehavior !== undefined && { toolBehavior: data.toolBehavior }),
          ...(data.enableStreaming !== undefined && { enableStreaming: data.enableStreaming }),
          ...(data.enableCitations !== undefined && { enableCitations: data.enableCitations }),
          ...(data.maxTokens !== undefined && { maxTokens: data.maxTokens }),
          ...(data.modelId !== undefined && { modelId: data.modelId }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "bot_profile.updated",
          entityType: "BotProfile",
          entityId: profile.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { changes: data },
        },
      });

      return profile;
    }),

  /**
   * Set a bot profile as the default
   */
  setDefault: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.tenant.db.botProfile.findUnique({
        where: { id: input.id },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bot profile not found",
        });
      }

      // Unset other defaults
      await ctx.tenant.db.botProfile.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });

      // Set this one as default
      const updated = await ctx.tenant.db.botProfile.update({
        where: { id: input.id },
        data: { isDefault: true },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "bot_profile.set_default",
          entityType: "BotProfile",
          entityId: profile.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      return updated;
    }),

  /**
   * Delete a bot profile (admin only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.tenant.db.botProfile.findUnique({
        where: { id: input.id },
        include: {
          _count: { select: { routes: true } },
        },
      });

      if (!profile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bot profile not found",
        });
      }

      if (profile._count.routes > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot delete bot profile with ${profile._count.routes} active routes. Remove routes first.`,
        });
      }

      if (profile.isDefault) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the default bot profile. Set another profile as default first.",
        });
      }

      await ctx.tenant.db.botProfile.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "bot_profile.deleted",
          entityType: "BotProfile",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: profile.name },
        },
      });

      return { success: true };
    }),

  /**
   * Duplicate a bot profile
   */
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z
          .string()
          .min(1)
          .max(100)
          .regex(/^[a-z0-9-]+$/),
        displayName: z.string().min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const source = await ctx.tenant.db.botProfile.findUnique({
        where: { id: input.id },
      });

      if (!source) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Source bot profile not found",
        });
      }

      // Check for duplicate name
      const existing = await ctx.tenant.db.botProfile.findFirst({
        where: { name: input.name },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Bot profile with this name already exists",
        });
      }

      const profile = await ctx.tenant.db.botProfile.create({
        data: {
          tenantId: ctx.tenant.tenantId,
          name: input.name,
          displayName: input.displayName,
          avatarUrl: source.avatarUrl,
          systemPrompt: source.systemPrompt,
          responseStyle: source.responseStyle,
          toolBehavior: source.toolBehavior,
          enableStreaming: source.enableStreaming,
          enableCitations: source.enableCitations,
          maxTokens: source.maxTokens,
          modelId: source.modelId,
          isDefault: false, // Never duplicate as default
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "bot_profile.duplicated",
          entityType: "BotProfile",
          entityId: profile.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            sourceId: input.id,
            name: profile.name,
          },
        },
      });

      return profile;
    }),
});
