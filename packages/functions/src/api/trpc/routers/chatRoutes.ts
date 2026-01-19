import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";

// Zod schemas matching Prisma enums
const ChatPlatformSchema = z.enum(["SLACK", "TEAMS"]);

export const chatRoutesRouter = router({
  /**
   * List chat routes for the current tenant
   */
  list: protectedProcedure
    .input(
      z
        .object({
          platform: ChatPlatformSchema.optional(),
          workspaceId: z.string().optional(),
          deploymentId: z.string().uuid().optional(),
          isActive: z.boolean().optional(),
          cursor: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { platform, workspaceId, deploymentId, isActive, cursor, limit = 20 } =
        input ?? {};

      const routes = await ctx.tenant.db.chatRoute.findMany({
        where: {
          ...(platform && { platform }),
          ...(workspaceId && { workspaceId }),
          ...(deploymentId && { deploymentId }),
          ...(isActive !== undefined && { isActive }),
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        include: {
          deployment: {
            select: {
              id: true,
              name: true,
              status: true,
              health: true,
              mcp: {
                select: { id: true, name: true },
              },
            },
          },
          botProfile: {
            select: {
              id: true,
              name: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      let nextCursor: string | undefined;
      if (routes.length > limit) {
        const nextItem = routes.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: routes,
        nextCursor,
        total_count: await ctx.tenant.db.chatRoute.count({
          where: {
            ...(platform && { platform }),
            ...(workspaceId && { workspaceId }),
            ...(deploymentId && { deploymentId }),
            ...(isActive !== undefined && { isActive }),
          },
        }),
      };
    }),

  /**
   * Get routes grouped by workspace
   */
  byWorkspace: protectedProcedure
    .input(
      z
        .object({
          platform: ChatPlatformSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const routes = await ctx.tenant.db.chatRoute.findMany({
        where: {
          ...(input?.platform && { platform: input.platform }),
        },
        orderBy: [{ workspaceName: "asc" }, { priority: "desc" }],
        include: {
          deployment: {
            select: {
              id: true,
              name: true,
              status: true,
              mcp: { select: { name: true } },
            },
          },
          botProfile: {
            select: { id: true, displayName: true },
          },
        },
      });

      // Group by workspace
      const byWorkspace = routes.reduce(
        (acc, route) => {
          const key = route.workspaceId;
          if (!acc[key]) {
            acc[key] = {
              workspaceId: route.workspaceId,
              workspaceName: route.workspaceName,
              platform: route.platform,
              routes: [],
              fallback: null as typeof route | null,
            };
          }
          if (route.isFallback) {
            acc[key].fallback = route;
          } else {
            acc[key].routes.push(route);
          }
          return acc;
        },
        {} as Record<string, {
          workspaceId: string;
          workspaceName: string | null;
          platform: string;
          routes: typeof routes;
          fallback: (typeof routes)[0] | null;
        }>
      );

      return Object.values(byWorkspace);
    }),

  /**
   * Get a single chat route by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const route = await ctx.tenant.db.chatRoute.findUnique({
        where: { id: input.id },
        include: {
          deployment: {
            select: {
              id: true,
              name: true,
              status: true,
              health: true,
              endpointUrl: true,
              mcp: {
                select: { id: true, name: true, description: true },
              },
            },
          },
          botProfile: true,
        },
      });

      if (!route) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat route not found",
        });
      }

      return route;
    }),

  /**
   * Resolve route for incoming message (used by Chat Gateway)
   * Finds the best matching route for a given workspace/channel
   */
  resolve: protectedProcedure
    .input(
      z.object({
        platform: ChatPlatformSchema,
        workspaceId: z.string(),
        channelId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      // First, try to find an exact channel match
      if (input.channelId) {
        const channelRoute = await ctx.tenant.db.chatRoute.findFirst({
          where: {
            platform: input.platform,
            workspaceId: input.workspaceId,
            channelId: input.channelId,
            isActive: true,
          },
          include: {
            deployment: {
              select: { id: true, endpointUrl: true, status: true },
            },
            botProfile: true,
          },
        });

        if (channelRoute) {
          return channelRoute;
        }
      }

      // Fall back to workspace fallback route
      const fallbackRoute = await ctx.tenant.db.chatRoute.findFirst({
        where: {
          platform: input.platform,
          workspaceId: input.workspaceId,
          isFallback: true,
          isActive: true,
        },
        include: {
          deployment: {
            select: { id: true, endpointUrl: true, status: true },
          },
          botProfile: true,
        },
      });

      return fallbackRoute;
    }),

  /**
   * Create a new chat route
   */
  create: protectedProcedure
    .input(
      z.object({
        platform: ChatPlatformSchema,
        workspaceId: z.string().min(1).max(100),
        workspaceName: z.string().max(255).optional(),
        channelId: z.string().max(100).optional(),
        channelName: z.string().max(255).optional(),
        deploymentId: z.string().uuid().optional(),
        botProfileId: z.string().uuid(),
        isFallback: z.boolean().default(false),
        priority: z.number().min(0).max(100).default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify bot profile exists
      const botProfile = await ctx.tenant.db.botProfile.findUnique({
        where: { id: input.botProfileId },
      });

      if (!botProfile) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Bot profile not found",
        });
      }

      // Verify deployment exists if provided
      if (input.deploymentId) {
        const deployment = await ctx.tenant.db.deployment.findUnique({
          where: { id: input.deploymentId },
        });

        if (!deployment || deployment.deletedAt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deployment not found",
          });
        }
      }

      // Check for fallback uniqueness
      if (input.isFallback) {
        const existingFallback = await ctx.tenant.db.chatRoute.findFirst({
          where: {
            platform: input.platform,
            workspaceId: input.workspaceId,
            isFallback: true,
          },
        });

        if (existingFallback) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "A fallback route already exists for this workspace. Update or delete it first.",
          });
        }
      }

      // Check for duplicate channel route
      if (input.channelId && !input.isFallback) {
        const existingChannel = await ctx.tenant.db.chatRoute.findFirst({
          where: {
            platform: input.platform,
            workspaceId: input.workspaceId,
            channelId: input.channelId,
          },
        });

        if (existingChannel) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A route for this channel already exists",
          });
        }
      }

      const route = await ctx.tenant.db.chatRoute.create({
        data: {
          tenantId: ctx.tenant.tenantId,
          platform: input.platform,
          workspaceId: input.workspaceId,
          workspaceName: input.workspaceName,
          channelId: input.isFallback ? null : input.channelId,
          channelName: input.isFallback ? null : input.channelName,
          deploymentId: input.deploymentId,
          botProfileId: input.botProfileId,
          isFallback: input.isFallback,
          priority: input.priority,
        },
        include: {
          deployment: {
            select: { id: true, name: true },
          },
          botProfile: {
            select: { id: true, displayName: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "chat_route.created",
          entityType: "ChatRoute",
          entityId: route.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            platform: input.platform,
            workspaceId: input.workspaceId,
            channelId: input.channelId,
            isFallback: input.isFallback,
          },
        },
      });

      return route;
    }),

  /**
   * Update a chat route
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        workspaceName: z.string().max(255).optional(),
        channelName: z.string().max(255).optional(),
        deploymentId: z.string().uuid().nullish(),
        botProfileId: z.string().uuid().optional(),
        priority: z.number().min(0).max(100).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.chatRoute.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat route not found",
        });
      }

      // Verify bot profile if changing
      if (data.botProfileId) {
        const botProfile = await ctx.tenant.db.botProfile.findUnique({
          where: { id: data.botProfileId },
        });

        if (!botProfile) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Bot profile not found",
          });
        }
      }

      // Verify deployment if changing
      if (data.deploymentId) {
        const deployment = await ctx.tenant.db.deployment.findUnique({
          where: { id: data.deploymentId },
        });

        if (!deployment || deployment.deletedAt) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Deployment not found",
          });
        }
      }

      const route = await ctx.tenant.db.chatRoute.update({
        where: { id },
        data: {
          ...(data.workspaceName !== undefined && { workspaceName: data.workspaceName }),
          ...(data.channelName !== undefined && { channelName: data.channelName }),
          ...(data.deploymentId !== undefined && { deploymentId: data.deploymentId }),
          ...(data.botProfileId !== undefined && { botProfileId: data.botProfileId }),
          ...(data.priority !== undefined && { priority: data.priority }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
        include: {
          deployment: {
            select: { id: true, name: true },
          },
          botProfile: {
            select: { id: true, displayName: true },
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "chat_route.updated",
          entityType: "ChatRoute",
          entityId: route.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { changes: data },
        },
      });

      return route;
    }),

  /**
   * Enable/disable a chat route
   */
  setActive: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.chatRoute.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat route not found",
        });
      }

      const route = await ctx.tenant.db.chatRoute.update({
        where: { id: input.id },
        data: { isActive: input.isActive },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: input.isActive ? "chat_route.enabled" : "chat_route.disabled",
          entityType: "ChatRoute",
          entityId: route.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      return route;
    }),

  /**
   * Delete a chat route
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.tenant.db.chatRoute.findUnique({
        where: { id: input.id },
      });

      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Chat route not found",
        });
      }

      await ctx.tenant.db.chatRoute.delete({
        where: { id: input.id },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "chat_route.deleted",
          entityType: "ChatRoute",
          entityId: input.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            platform: existing.platform,
            workspaceId: existing.workspaceId,
            channelId: existing.channelId,
          },
        },
      });

      return { success: true };
    }),

  /**
   * Get unique workspaces (for dropdown/autocomplete)
   */
  workspaces: protectedProcedure
    .input(
      z
        .object({
          platform: ChatPlatformSchema.optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const routes = await ctx.tenant.db.chatRoute.findMany({
        where: {
          ...(input?.platform && { platform: input.platform }),
        },
        select: {
          workspaceId: true,
          workspaceName: true,
          platform: true,
        },
        distinct: ["workspaceId"],
        orderBy: { workspaceName: "asc" },
      });

      return routes;
    }),
});
