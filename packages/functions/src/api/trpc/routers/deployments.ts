import { z } from "zod";
import { router, protectedProcedure, adminProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { Resource } from "sst";
import { queueDeploymentOperation } from "../../../jobs/deployment-processor";

// Get deployment queue URL from SST resources
function getDeploymentQueueUrl(): string | null {
  const resource = Resource as unknown as { DeploymentQueue?: { url: string } };
  return resource.DeploymentQueue?.url || null;
}

// Zod schemas matching Prisma enums
const DeploymentEnvSchema = z.enum(["DEVELOPMENT", "STAGING", "PRODUCTION"]);
const ComputeProfileSchema = z.enum(["SMALL", "MEDIUM", "LARGE", "XLARGE"]);
const DeploymentStatusSchema = z.enum([
  "PENDING",
  "PROVISIONING",
  "DEPLOYING",
  "RUNNING",
  "UPDATING",
  "SCALING",
  "DRAINING",
  "STOPPED",
  "FAILED",
  "DELETED",
]);

export const deploymentsRouter = router({
  /**
   * List deployments for the current tenant
   */
  list: protectedProcedure
    .input(
      z
        .object({
          mcpId: z.string().uuid().optional(),
          status: DeploymentStatusSchema.optional(),
          environment: DeploymentEnvSchema.optional(),
          cursor: z.string().uuid().optional(),
          limit: z.number().min(1).max(100).default(20),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const { mcpId, status, environment, cursor, limit = 20 } = input ?? {};

      const deployments = await ctx.tenant.db.deployment.findMany({
        where: {
          ...(mcpId && { mcpId }),
          ...(status && { status }),
          ...(environment && { environment }),
          deletedAt: null, // Exclude soft-deleted
        },
        take: limit + 1,
        ...(cursor && {
          cursor: { id: cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
        include: {
          mcp: {
            select: { id: true, name: true, type: true },
          },
          mcpVersion: {
            select: { id: true, version: true, status: true },
          },
          _count: {
            select: { routes: true, usageEvents: true },
          },
        },
      });

      let nextCursor: string | undefined;
      if (deployments.length > limit) {
        const nextItem = deployments.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: deployments,
        nextCursor,
        total_count: await ctx.tenant.db.deployment.count({
          where: {
            ...(mcpId && { mcpId }),
            ...(status && { status }),
            ...(environment && { environment }),
            deletedAt: null,
          },
        }),
      };
    }),

  /**
   * Get a single deployment by ID
   */
  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
        include: {
          mcp: {
            select: { id: true, name: true, type: true, description: true },
          },
          mcpVersion: {
            select: { id: true, version: true, status: true, changelog: true },
          },
          routes: {
            include: {
              botProfile: {
                select: { id: true, name: true, displayName: true },
              },
            },
          },
          events: {
            take: 20,
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!deployment || deployment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      return deployment;
    }),

  /**
   * Create a new deployment
   */
  create: protectedProcedure
    .input(
      z.object({
        mcpId: z.string().uuid(),
        mcpVersionId: z.string().uuid().optional(),
        name: z.string().min(1).max(100),
        environment: DeploymentEnvSchema.default("DEVELOPMENT"),
        computeProfile: ComputeProfileSchema.default("SMALL"),
        minTasks: z.number().min(0).max(10).default(1),
        maxTasks: z.number().min(1).max(10).default(3),
        configValues: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify MCP exists
      const mcp = await ctx.tenant.db.mcp.findUnique({
        where: { id: input.mcpId },
      });

      if (!mcp) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "MCP not found",
        });
      }

      // Verify version exists if provided
      if (input.mcpVersionId) {
        const version = await ctx.tenant.db.mcpVersion.findUnique({
          where: { id: input.mcpVersionId },
        });
        if (!version || version.mcpId !== input.mcpId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid MCP version",
          });
        }
      }

      // Check for duplicate name
      const existing = await ctx.tenant.db.deployment.findFirst({
        where: {
          mcpId: input.mcpId,
          name: input.name,
          deletedAt: null,
        },
      });

      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Deployment with this name already exists for this MCP",
        });
      }

      const deployment = await ctx.tenant.db.deployment.create({
        data: {
          mcpId: input.mcpId,
          mcpVersionId: input.mcpVersionId,
          tenantId: ctx.tenant.tenantId,
          name: input.name,
          environment: input.environment,
          computeProfile: input.computeProfile,
          minTasks: input.minTasks,
          maxTasks: input.maxTasks,
          desiredTasks: input.minTasks,
          configValues: input.configValues ?? {},
          status: "PENDING",
        },
        include: {
          mcp: {
            select: { id: true, name: true },
          },
        },
      });

      // Create deployment event
      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "CREATED",
          message: `Deployment "${input.name}" created`,
          triggeredById: ctx.tenant.userId,
          metadata: {
            environment: input.environment,
            computeProfile: input.computeProfile,
          },
        },
      });

      // Audit log
      await ctx.tenant.db.auditLog.create({
        data: {
          action: "deployment.created",
          entityType: "Deployment",
          entityId: deployment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            name: deployment.name,
            mcpId: input.mcpId,
            environment: input.environment,
          },
        },
      });

      return deployment;
    }),

  /**
   * Update deployment configuration
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        mcpVersionId: z.string().uuid().optional(),
        computeProfile: ComputeProfileSchema.optional(),
        minTasks: z.number().min(0).max(10).optional(),
        maxTasks: z.number().min(1).max(10).optional(),
        configValues: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.tenant.db.deployment.findUnique({
        where: { id },
      });

      if (!existing || existing.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      // Verify version if changing
      if (data.mcpVersionId) {
        const version = await ctx.tenant.db.mcpVersion.findUnique({
          where: { id: data.mcpVersionId },
        });
        if (!version || version.mcpId !== existing.mcpId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid MCP version",
          });
        }
      }

      const deployment = await ctx.tenant.db.deployment.update({
        where: { id },
        data: {
          ...(data.mcpVersionId !== undefined && {
            mcpVersionId: data.mcpVersionId,
          }),
          ...(data.computeProfile !== undefined && {
            computeProfile: data.computeProfile,
          }),
          ...(data.minTasks !== undefined && { minTasks: data.minTasks }),
          ...(data.maxTasks !== undefined && { maxTasks: data.maxTasks }),
          ...(data.configValues !== undefined && {
            configValues: data.configValues,
          }),
        },
        include: {
          mcp: {
            select: { id: true, name: true },
          },
        },
      });

      // Create deployment event
      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "UPDATED",
          message: "Deployment configuration updated",
          triggeredById: ctx.tenant.userId,
          metadata: { changes: data },
        },
      });

      return deployment;
    }),

  /**
   * Start/deploy the deployment (triggers ECS provisioning)
   */
  start: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
      });

      if (!deployment || deployment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      if (!["PENDING", "STOPPED", "FAILED"].includes(deployment.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot start deployment in ${deployment.status} status`,
        });
      }

      // Update to PROVISIONING
      const updated = await ctx.tenant.db.deployment.update({
        where: { id: input.id },
        data: { status: "PROVISIONING" },
      });

      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "STARTED",
          message: "Deployment provisioning started",
          triggeredById: ctx.tenant.userId,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "deployment.started",
          entityType: "Deployment",
          entityId: deployment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      // Queue the provisioning operation
      const queueUrl = getDeploymentQueueUrl();
      if (queueUrl) {
        await queueDeploymentOperation(queueUrl, {
          type: "PROVISION",
          deploymentId: input.id,
          triggeredBy: ctx.tenant.userId,
        });
      }

      return updated;
    }),

  /**
   * Stop the deployment (graceful shutdown)
   */
  stop: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
      });

      if (!deployment || deployment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      if (!["RUNNING", "UPDATING", "SCALING"].includes(deployment.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot stop deployment in ${deployment.status} status`,
        });
      }

      const updated = await ctx.tenant.db.deployment.update({
        where: { id: input.id },
        data: { status: "DRAINING" },
      });

      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "STOPPED",
          message: "Deployment stop initiated",
          triggeredById: ctx.tenant.userId,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "deployment.stopped",
          entityType: "Deployment",
          entityId: deployment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
        },
      });

      // Queue the stop operation
      const queueUrl = getDeploymentQueueUrl();
      if (queueUrl) {
        await queueDeploymentOperation(queueUrl, {
          type: "STOP",
          deploymentId: input.id,
          triggeredBy: ctx.tenant.userId,
        });
      }

      return updated;
    }),

  /**
   * Scale the deployment
   */
  scale: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        desiredTasks: z.number().min(0).max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
      });

      if (!deployment || deployment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      if (deployment.status !== "RUNNING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only scale running deployments",
        });
      }

      if (
        input.desiredTasks < deployment.minTasks ||
        input.desiredTasks > deployment.maxTasks
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Desired tasks must be between ${deployment.minTasks} and ${deployment.maxTasks}`,
        });
      }

      const updated = await ctx.tenant.db.deployment.update({
        where: { id: input.id },
        data: {
          desiredTasks: input.desiredTasks,
          status: "SCALING",
        },
      });

      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "SCALED",
          message: `Scaling to ${input.desiredTasks} tasks`,
          triggeredById: ctx.tenant.userId,
          metadata: {
            from: deployment.desiredTasks,
            to: input.desiredTasks,
          },
        },
      });

      // Queue the scale operation
      const queueUrl = getDeploymentQueueUrl();
      if (queueUrl) {
        await queueDeploymentOperation(queueUrl, {
          type: "SCALE",
          deploymentId: input.id,
          payload: { desiredTasks: input.desiredTasks },
          triggeredBy: ctx.tenant.userId,
        });
      }

      return updated;
    }),

  /**
   * Rollback to a previous version
   */
  rollback: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        mcpVersionId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
      });

      if (!deployment || deployment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      const version = await ctx.tenant.db.mcpVersion.findUnique({
        where: { id: input.mcpVersionId },
      });

      if (!version || version.mcpId !== deployment.mcpId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid MCP version for this deployment",
        });
      }

      const updated = await ctx.tenant.db.deployment.update({
        where: { id: input.id },
        data: {
          mcpVersionId: input.mcpVersionId,
          status: "UPDATING",
        },
      });

      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "ROLLBACK",
          message: `Rolling back to version ${version.version}`,
          triggeredById: ctx.tenant.userId,
          metadata: {
            fromVersionId: deployment.mcpVersionId,
            toVersionId: input.mcpVersionId,
            toVersion: version.version,
          },
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "deployment.rollback",
          entityType: "Deployment",
          entityId: deployment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            toVersion: version.version,
          },
        },
      });

      // Queue the rollback operation
      const queueUrl = getDeploymentQueueUrl();
      if (queueUrl) {
        await queueDeploymentOperation(queueUrl, {
          type: "ROLLBACK",
          deploymentId: input.id,
          payload: { mcpVersionId: input.mcpVersionId },
          triggeredBy: ctx.tenant.userId,
        });
      }

      return updated;
    }),

  /**
   * Delete a deployment (soft delete)
   */
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
      });

      if (!deployment || deployment.deletedAt) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      // Soft delete
      await ctx.tenant.db.deployment.update({
        where: { id: input.id },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
        },
      });

      await ctx.tenant.db.deploymentEvent.create({
        data: {
          deploymentId: deployment.id,
          type: "DELETED",
          message: "Deployment deleted",
          triggeredById: ctx.tenant.userId,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "deployment.deleted",
          entityType: "Deployment",
          entityId: deployment.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { name: deployment.name },
        },
      });

      // Queue the delete operation to clean up infrastructure
      const queueUrl = getDeploymentQueueUrl();
      if (queueUrl && deployment.ecsServiceArn) {
        await queueDeploymentOperation(queueUrl, {
          type: "DELETE",
          deploymentId: input.id,
          triggeredBy: ctx.tenant.userId,
        });
      }

      return { success: true };
    }),

  /**
   * Get deployment events (audit trail)
   */
  events: protectedProcedure
    .input(
      z.object({
        deploymentId: z.string().uuid(),
        cursor: z.string().uuid().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      // Verify deployment exists and belongs to tenant
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.deploymentId },
        select: { id: true },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      const events = await ctx.tenant.db.deploymentEvent.findMany({
        where: { deploymentId: input.deploymentId },
        take: input.limit + 1,
        ...(input.cursor && {
          cursor: { id: input.cursor },
          skip: 1,
        }),
        orderBy: { createdAt: "desc" },
      });

      let nextCursor: string | undefined;
      if (events.length > input.limit) {
        const nextItem = events.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items: events,
        nextCursor,
      };
    }),

  /**
   * Get deployment health status
   */
  health: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const deployment = await ctx.tenant.db.deployment.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          status: true,
          health: true,
          lastHealthCheck: true,
          endpointUrl: true,
          desiredTasks: true,
        },
      });

      if (!deployment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deployment not found",
        });
      }

      return deployment;
    }),
});
