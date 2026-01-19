import { z } from "zod";
import { router, protectedProcedure, adminProcedure, ownerProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { WorkOS } from "@workos-inc/node";
import { getPrisma } from "@repo/db";

/**
 * Get WorkOS client with API key from environment
 */
async function getWorkOS(): Promise<WorkOS | null> {
  let apiKey: string | undefined;

  // Try SST Resources first
  try {
    const { Resource } = await import("sst");
    const resource = Resource as unknown as Record<string, { value: string } | undefined>;
    apiKey = resource.WorkosApiKey?.value;
  } catch {
    // SST not available
  }

  // Fall back to environment variable
  apiKey = apiKey || process.env.WORKOS_API_KEY;

  if (!apiKey) {
    console.error("[WorkOS] No API key available");
    return null;
  }

  return new WorkOS(apiKey);
}

// Zod schemas for validation
const addressSchema = z.object({
  line1: z.string().max(200).nullable().optional(),
  line2: z.string().max(200).nullable().optional(),
  city: z.string().max(100).nullable().optional(),
  state: z.string().max(100).nullable().optional(),
  postalCode: z.string().max(20).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
});

const companySizeEnum = z.enum(["SOLO", "SMALL", "MEDIUM", "LARGE", "ENTERPRISE", "CORPORATION"]);
const tenantStatusEnum = z.enum(["ACTIVE", "SUSPENDED", "ARCHIVED"]);
const tenantEnvironmentEnum = z.enum(["PRODUCTION", "SANDBOX", "TRIAL"]);
const dpaStatusEnum = z.enum(["NOT_REQUIRED", "PENDING", "SIGNED", "EXPIRED"]);

export const tenantRouter = router({
  /**
   * Get current tenant/company information
   */
  get: protectedProcedure.query(async ({ ctx }) => {
    const tenant = await ctx.tenant.db.tenant.findUnique({
      where: { id: ctx.tenant.tenantId },
      select: {
        id: true,
        name: true,
        legalName: true,
        slug: true,
        description: true,
        industry: true,
        companySize: true,
        primaryDomain: true,
        createdAt: true,

        // Address - Legal
        legalAddressLine1: true,
        legalAddressLine2: true,
        legalCity: true,
        legalState: true,
        legalPostalCode: true,
        legalCountry: true,

        // Address - Operating
        operatingAddressLine1: true,
        operatingAddressLine2: true,
        operatingCity: true,
        operatingState: true,
        operatingPostalCode: true,
        operatingCountry: true,

        // Timezone & Locale
        timezone: true,
        defaultLanguage: true,

        // Contact
        primaryContactName: true,
        primaryContactEmail: true,
        supportEmail: true,
        phone: true,

        // Branding
        logoUrl: true,
        faviconUrl: true,
        primaryColor: true,
        secondaryColor: true,
        customDomain: true,
        emailSenderName: true,
        emailSenderDomain: true,

        // System
        status: true,
        environment: true,
        dataResidency: true,
        featureFlags: true,

        // Billing
        billingStatus: true,
        subscriptionPlan: true,
        subscriptionStatus: true,
        billingContactName: true,
        billingContactEmail: true,
        billingAddressLine1: true,
        billingAddressLine2: true,
        billingCity: true,
        billingState: true,
        billingPostalCode: true,
        billingCountry: true,
        taxId: true,
        taxExempt: true,

        // Compliance
        legalEntityType: true,
        privacyPolicyAcceptedAt: true,
        termsAcceptedAt: true,
        dpaStatus: true,
        complianceTags: true,
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant not found",
      });
    }

    return tenant;
  }),

  /**
   * Update company/tenant information (admin+ only)
   */
  update: adminProcedure
    .input(
      z.object({
        // Core Information
        name: z.string().min(1).max(200).optional(),
        legalName: z.string().max(200).nullable().optional(),
        description: z.string().max(1000).nullable().optional(),
        industry: z.string().max(100).nullable().optional(),
        companySize: companySizeEnum.nullable().optional(),

        // Legal Address
        legalAddress: addressSchema.optional(),

        // Operating Address
        operatingAddress: addressSchema.optional(),

        // Timezone & Locale
        timezone: z.string().max(50).optional(),
        defaultLanguage: z.string().max(10).optional(),

        // Contact
        primaryContactName: z.string().max(200).nullable().optional(),
        primaryContactEmail: z.string().email().nullable().optional(),
        supportEmail: z.string().email().nullable().optional(),
        phone: z.string().max(30).nullable().optional(),

        // Branding
        logoUrl: z.string().url().nullable().optional(),
        faviconUrl: z.string().url().nullable().optional(),
        primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).nullable().optional(),
        emailSenderName: z.string().max(100).nullable().optional(),

        // Billing Contact
        billingContactName: z.string().max(200).nullable().optional(),
        billingContactEmail: z.string().email().nullable().optional(),
        billingAddress: addressSchema.optional(),
        taxId: z.string().max(50).nullable().optional(),
        taxExempt: z.boolean().optional(),

        // Compliance
        legalEntityType: z.string().max(50).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: Record<string, unknown> = {};

      // Core Information
      if (input.name !== undefined) updateData.name = input.name;
      if (input.legalName !== undefined) updateData.legalName = input.legalName;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.industry !== undefined) updateData.industry = input.industry;
      if (input.companySize !== undefined) updateData.companySize = input.companySize;

      // Legal Address
      if (input.legalAddress) {
        if (input.legalAddress.line1 !== undefined) updateData.legalAddressLine1 = input.legalAddress.line1;
        if (input.legalAddress.line2 !== undefined) updateData.legalAddressLine2 = input.legalAddress.line2;
        if (input.legalAddress.city !== undefined) updateData.legalCity = input.legalAddress.city;
        if (input.legalAddress.state !== undefined) updateData.legalState = input.legalAddress.state;
        if (input.legalAddress.postalCode !== undefined) updateData.legalPostalCode = input.legalAddress.postalCode;
        if (input.legalAddress.country !== undefined) updateData.legalCountry = input.legalAddress.country;
      }

      // Operating Address
      if (input.operatingAddress) {
        if (input.operatingAddress.line1 !== undefined) updateData.operatingAddressLine1 = input.operatingAddress.line1;
        if (input.operatingAddress.line2 !== undefined) updateData.operatingAddressLine2 = input.operatingAddress.line2;
        if (input.operatingAddress.city !== undefined) updateData.operatingCity = input.operatingAddress.city;
        if (input.operatingAddress.state !== undefined) updateData.operatingState = input.operatingAddress.state;
        if (input.operatingAddress.postalCode !== undefined) updateData.operatingPostalCode = input.operatingAddress.postalCode;
        if (input.operatingAddress.country !== undefined) updateData.operatingCountry = input.operatingAddress.country;
      }

      // Timezone & Locale
      if (input.timezone !== undefined) updateData.timezone = input.timezone;
      if (input.defaultLanguage !== undefined) updateData.defaultLanguage = input.defaultLanguage;

      // Contact
      if (input.primaryContactName !== undefined) updateData.primaryContactName = input.primaryContactName;
      if (input.primaryContactEmail !== undefined) updateData.primaryContactEmail = input.primaryContactEmail;
      if (input.supportEmail !== undefined) updateData.supportEmail = input.supportEmail;
      if (input.phone !== undefined) updateData.phone = input.phone;

      // Branding
      if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
      if (input.faviconUrl !== undefined) updateData.faviconUrl = input.faviconUrl;
      if (input.primaryColor !== undefined) updateData.primaryColor = input.primaryColor;
      if (input.secondaryColor !== undefined) updateData.secondaryColor = input.secondaryColor;
      if (input.emailSenderName !== undefined) updateData.emailSenderName = input.emailSenderName;

      // Billing Contact
      if (input.billingContactName !== undefined) updateData.billingContactName = input.billingContactName;
      if (input.billingContactEmail !== undefined) updateData.billingContactEmail = input.billingContactEmail;
      if (input.billingAddress) {
        if (input.billingAddress.line1 !== undefined) updateData.billingAddressLine1 = input.billingAddress.line1;
        if (input.billingAddress.line2 !== undefined) updateData.billingAddressLine2 = input.billingAddress.line2;
        if (input.billingAddress.city !== undefined) updateData.billingCity = input.billingAddress.city;
        if (input.billingAddress.state !== undefined) updateData.billingState = input.billingAddress.state;
        if (input.billingAddress.postalCode !== undefined) updateData.billingPostalCode = input.billingAddress.postalCode;
        if (input.billingAddress.country !== undefined) updateData.billingCountry = input.billingAddress.country;
      }
      if (input.taxId !== undefined) updateData.taxId = input.taxId;
      if (input.taxExempt !== undefined) updateData.taxExempt = input.taxExempt;

      // Compliance
      if (input.legalEntityType !== undefined) updateData.legalEntityType = input.legalEntityType;

      const tenant = await ctx.tenant.db.tenant.update({
        where: { id: ctx.tenant.tenantId },
        data: updateData,
        select: {
          id: true,
          name: true,
          slug: true,
          updatedAt: true,
        },
      });

      // Look up the database user ID from WorkOS ID for audit log
      const dbUser = await ctx.tenant.db.user.findFirst({
        where: { workosId: ctx.tenant.userId },
        select: { id: true },
      });

      // Audit log (only if we found the user)
      if (dbUser) {
        await ctx.tenant.db.auditLog.create({
          data: {
            action: "tenant.updated",
            entityType: "Tenant",
            entityId: tenant.id,
            userId: dbUser.id,
            tenantId: ctx.tenant.tenantId,
            metadata: { fields: Object.keys(updateData) },
          },
        });
      }

      return tenant;
    }),

  /**
   * Get tenant statistics (member counts, usage, etc.)
   */
  getStats: protectedProcedure.query(async ({ ctx }) => {
    const [userCount, mcpCount, activeUserCount] = await Promise.all([
      ctx.tenant.db.user.count({
        where: { tenantId: ctx.tenant.tenantId },
      }),
      ctx.tenant.db.mcp.count({
        where: { tenantId: ctx.tenant.tenantId },
      }),
      ctx.tenant.db.user.count({
        where: {
          tenantId: ctx.tenant.tenantId,
          status: "ACTIVE",
        },
      }),
    ]);

    return {
      totalUsers: userCount,
      activeUsers: activeUserCount,
      totalMcps: mcpCount,
    };
  }),

  /**
   * Delete tenant and all associated data (OWNER ONLY)
   * WARNING: This is a destructive operation that cannot be undone.
   *
   * This will:
   * 1. Delete all users from WorkOS
   * 2. Delete the tenant (cascading deletes will remove all related data)
   */
  delete: ownerProcedure
    .input(
      z.object({
        confirmation: z.literal("DELETE"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = await getPrisma();
      const tenantId = ctx.tenant.tenantId;

      console.log(`[Tenant Delete] Starting deletion of tenant ${tenantId}`);

      // Get the tenant details for logging
      const tenant = await ctx.tenant.db.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true, slug: true },
      });

      if (!tenant) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Tenant not found",
        });
      }

      // Get all users in this tenant
      const users = await ctx.tenant.db.user.findMany({
        where: { tenantId },
        select: { id: true, email: true, workosId: true },
      });

      console.log(`[Tenant Delete] Found ${users.length} users to delete`);

      // Delete all users from WorkOS
      const workos = await getWorkOS();
      if (workos) {
        for (const user of users) {
          if (user.workosId) {
            try {
              await workos.userManagement.deleteUser(user.workosId);
              console.log(`[Tenant Delete] Deleted WorkOS user ${user.workosId} (${user.email})`);
            } catch (error) {
              // Log but continue - user might already be deleted in WorkOS
              console.error(`[Tenant Delete] Failed to delete WorkOS user ${user.workosId}:`, error);
            }
          }
        }
      } else {
        console.warn("[Tenant Delete] WorkOS client not available - users may remain in WorkOS");
      }

      // Delete all join requests for this tenant
      await prisma.joinRequest.deleteMany({
        where: { tenantId },
      });
      console.log(`[Tenant Delete] Deleted join requests`);

      // Delete all invitations for this tenant
      await prisma.invitation.deleteMany({
        where: { tenantId },
      });
      console.log(`[Tenant Delete] Deleted invitations`);

      // Delete all audit logs for this tenant
      await prisma.auditLog.deleteMany({
        where: { tenantId },
      });
      console.log(`[Tenant Delete] Deleted audit logs`);

      // Delete all MCPs for this tenant
      await prisma.mcp.deleteMany({
        where: { tenantId },
      });
      console.log(`[Tenant Delete] Deleted MCPs`);

      // Delete all applications and related data
      // First delete tool executions, test results, tools, document chunks, documents, environments
      const applications = await prisma.application.findMany({
        where: { tenantId },
        select: { id: true },
      });

      for (const app of applications) {
        // Delete tool-related data
        await prisma.toolExecution.deleteMany({
          where: { tool: { applicationId: app.id } },
        });
        await prisma.toolTestResult.deleteMany({
          where: { tool: { applicationId: app.id } },
        });
        await prisma.tool.deleteMany({
          where: { applicationId: app.id },
        });

        // Delete document-related data
        await prisma.documentChunk.deleteMany({
          where: { document: { applicationId: app.id } },
        });
        await prisma.applicationDocument.deleteMany({
          where: { applicationId: app.id },
        });

        // Delete environments
        await prisma.applicationEnvironment.deleteMany({
          where: { applicationId: app.id },
        });
      }

      // Delete applications
      await prisma.application.deleteMany({
        where: { tenantId },
      });
      console.log(`[Tenant Delete] Deleted applications and related data`);

      // Delete all users in this tenant
      await prisma.user.deleteMany({
        where: { tenantId },
      });
      console.log(`[Tenant Delete] Deleted users`);

      // Finally, delete the tenant itself
      await prisma.tenant.delete({
        where: { id: tenantId },
      });
      console.log(`[Tenant Delete] Deleted tenant ${tenant.name} (${tenant.slug})`);

      return {
        success: true,
        message: `Tenant "${tenant.name}" and all associated data have been permanently deleted.`,
        deletedUsers: users.length,
      };
    }),
});
