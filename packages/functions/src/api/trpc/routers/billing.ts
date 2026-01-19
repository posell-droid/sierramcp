/**
 * Billing Router
 *
 * tRPC endpoints for billing, usage, and subscription management.
 */

import { z } from "zod";
import { router, protectedProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import {
  getTenantUsageSummary,
  getCurrentPeriodUsage,
  getPricingTiers,
} from "../../../services/metering";
import {
  getSubscription,
  createSubscription,
  cancelSubscription,
  resumeSubscription,
  changePlan,
  createBillingPortalSession,
  createCheckoutSession,
} from "../../../services/billing";

export const billingRouter = router({
  // ==========================================================================
  // USAGE QUERIES
  // ==========================================================================

  /**
   * Get usage summary for the current billing period
   */
  getCurrentUsage: protectedProcedure.query(async ({ ctx }) => {
    try {
      const usage = await getCurrentPeriodUsage(ctx.tenant.tenantId);
      return usage;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch usage data",
        cause: error,
      });
    }
  }),

  /**
   * Get detailed usage summary for a date range
   */
  getUsageSummary: protectedProcedure
    .input(
      z.object({
        startDate: z.date(),
        endDate: z.date(),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        const summary = await getTenantUsageSummary(
          ctx.tenant.tenantId,
          input.startDate,
          input.endDate
        );
        return summary;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch usage summary",
          cause: error,
        });
      }
    }),

  /**
   * Get daily usage for charts
   */
  getDailyUsage: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      try {
        const summary = await getTenantUsageSummary(
          ctx.tenant.tenantId,
          startDate,
          endDate
        );
        return summary.dailyBreakdown;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to fetch daily usage",
          cause: error,
        });
      }
    }),

  // ==========================================================================
  // SUBSCRIPTION MANAGEMENT
  // ==========================================================================

  /**
   * Get current subscription details
   */
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    try {
      const subscription = await getSubscription(ctx.tenant.tenantId);
      return subscription;
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch subscription",
        cause: error,
      });
    }
  }),

  /**
   * Get available pricing tiers
   */
  getPricingTiers: protectedProcedure.query(async () => {
    return getPricingTiers();
  }),

  /**
   * Create a new subscription (owner only)
   */
  createSubscription: ownerProcedure
    .input(
      z.object({
        plan: z.enum(["free", "starter", "professional", "enterprise"]),
        paymentMethodId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const subscription = await createSubscription({
          tenantId: ctx.tenant.tenantId,
          plan: input.plan,
          paymentMethodId: input.paymentMethodId,
        });
        return subscription;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create subscription",
          cause: error,
        });
      }
    }),

  /**
   * Change subscription plan (owner only)
   */
  changePlan: ownerProcedure
    .input(
      z.object({
        plan: z.enum(["free", "starter", "professional", "enterprise"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const subscription = await changePlan(ctx.tenant.tenantId, input.plan);
        return subscription;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to change plan",
          cause: error,
        });
      }
    }),

  /**
   * Cancel subscription (owner only)
   */
  cancelSubscription: ownerProcedure
    .input(
      z.object({
        immediately: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await cancelSubscription(ctx.tenant.tenantId, input.immediately);
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to cancel subscription",
          cause: error,
        });
      }
    }),

  /**
   * Resume canceled subscription (owner only)
   */
  resumeSubscription: ownerProcedure.mutation(async ({ ctx }) => {
    try {
      await resumeSubscription(ctx.tenant.tenantId);
      return { success: true };
    } catch (error) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to resume subscription",
        cause: error,
      });
    }
  }),

  // ==========================================================================
  // STRIPE INTEGRATION
  // ==========================================================================

  /**
   * Create Stripe billing portal session
   */
  createBillingPortalSession: adminProcedure
    .input(
      z.object({
        returnUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const session = await createBillingPortalSession(
          ctx.tenant.tenantId,
          input.returnUrl
        );
        return session;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create billing portal session",
          cause: error,
        });
      }
    }),

  /**
   * Create Stripe checkout session for new subscription
   */
  createCheckoutSession: ownerProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "professional", "enterprise"]),
        successUrl: z.string().url(),
        cancelUrl: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const session = await createCheckoutSession(
          ctx.tenant.tenantId,
          input.plan,
          input.successUrl,
          input.cancelUrl
        );
        return session;
      } catch (error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create checkout session",
          cause: error,
        });
      }
    }),

  // ==========================================================================
  // USAGE EVENTS (for metering dashboard)
  // ==========================================================================

  /**
   * Get recent usage events (admin only)
   */
  getRecentEvents: adminProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(50),
        mcpId: z.string().uuid().optional(),
        deploymentId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const events = await ctx.tenant.db.usageEvent.findMany({
        where: {
          tenantId: ctx.tenant.tenantId,
          ...(input.mcpId && { mcpId: input.mcpId }),
          ...(input.deploymentId && { deploymentId: input.deploymentId }),
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
        select: {
          id: true,
          timestamp: true,
          requestCount: true,
          success: true,
          errorMessage: true,
          latencyMs: true,
          tokenCount: true,
          platform: true,
          metadata: true,
          mcp: { select: { id: true, name: true } },
          deployment: { select: { id: true, name: true, environment: true } },
        },
      });

      return events;
    }),

  /**
   * Get usage by MCP
   */
  getUsageByMcp: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const summary = await getTenantUsageSummary(
        ctx.tenant.tenantId,
        startDate,
        endDate
      );

      return summary.byMcp;
    }),

  /**
   * Get usage by deployment
   */
  getUsageByDeployment: protectedProcedure
    .input(
      z.object({
        days: z.number().min(1).max(90).default(30),
      })
    )
    .query(async ({ ctx, input }) => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const summary = await getTenantUsageSummary(
        ctx.tenant.tenantId,
        startDate,
        endDate
      );

      return summary.byDeployment;
    }),
});
