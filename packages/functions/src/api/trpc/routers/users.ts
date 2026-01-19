import { z } from "zod";
import { router, protectedProcedure, adminProcedure, ownerProcedure, authenticatedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { getPrisma } from "@repo/db";
import { sendInvitationEmail } from "../../../services/email";
import { WorkOS } from "@workos-inc/node";

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

export const usersRouter = router({
  /**
   * Get current user profile (works even without tenant)
   */
  me: authenticatedProcedure.query(async ({ ctx }) => {
    // Use the user ID from the session (internal database UUID)
    // The JWT callback in auth.ts looks up users by workosId and sets token.id to the database UUID
    const userId = ctx.session.user.id;
    const prisma = await getPrisma();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            billingStatus: true,
          },
        },
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return user;
  }),

  /**
   * Update current user's profile
   */
  updateProfile: authenticatedProcedure
    .input(
      z.object({
        name: z.string().min(2).max(100).optional(),
        avatarUrl: z.string().url().nullable().optional(),
        timezone: z.string().max(50).optional(),
        language: z.string().max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use internal database UUID from session
      const userId = ctx.session.user.id;
      const prisma = await getPrisma();

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.avatarUrl !== undefined && { avatarUrl: input.avatarUrl }),
          ...(input.timezone !== undefined && { timezone: input.timezone }),
          ...(input.language !== undefined && { language: input.language }),
        },
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          timezone: true,
          language: true,
        },
      });

      return updatedUser;
    }),

  /**
   * List all users in the tenant
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(["ACTIVE", "INVITED", "SUSPENDED"]).optional(),
          role: z.enum(["OWNER", "ADMIN", "MEMBER", "READONLY"]).optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const users = await ctx.tenant.db.user.findMany({
        where: {
          ...(input?.status && { status: input.status }),
          ...(input?.role && { role: input.role }),
        },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      });

      return users;
    }),

  /**
   * Update user role (admin only)
   */
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        role: z.enum(["ADMIN", "MEMBER", "READONLY"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Can't change owner role through this endpoint
      const targetUser = await ctx.tenant.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (targetUser.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot change owner role",
        });
      }

      const user = await ctx.tenant.db.user.update({
        where: { id: input.userId },
        data: { role: input.role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
        },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "user.role_changed",
          entityType: "User",
          entityId: user.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { newRole: input.role, oldRole: targetUser.role },
        },
      });

      return user;
    }),

  /**
   * Invite a new user
   */
  invite: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        role: z.enum(["ADMIN", "MEMBER", "READONLY"]).default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const normalizedEmail = input.email.toLowerCase();

      // Check if user already exists (case-insensitive)
      const existingUser = await ctx.tenant.db.user.findFirst({
        where: { email: { equals: normalizedEmail, mode: "insensitive" } },
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User already exists in this organization",
        });
      }

      // Delete any existing invitation for this email (allows re-invites)
      await ctx.tenant.db.invitation.deleteMany({
        where: { email: normalizedEmail },
      });

      // Get inviter info and tenant for the email
      const [inviter, tenant] = await Promise.all([
        ctx.tenant.db.user.findUnique({
          where: { id: ctx.tenant.userId },
          select: { name: true, email: true },
        }),
        ctx.tenant.db.tenant.findUnique({
          where: { id: ctx.tenant.tenantId },
          select: { name: true },
        }),
      ]);

      // Create invitation (email already normalized at start of function)
      const invitation = await ctx.tenant.db.invitation.create({
        data: {
          email: normalizedEmail,
          role: input.role,
          invitedById: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });

      // Send invitation email
      try {
        await sendInvitationEmail({
          to: input.email,
          inviterName: inviter?.name || inviter?.email || "A team member",
          tenantName: tenant?.name || "your team",
          role: input.role,
          inviteToken: invitation.token,
        });
      } catch (emailError) {
        // Log the error but don't fail the invitation creation
        console.error("Failed to send invitation email:", emailError);
        // We still want to create the invitation even if email fails
      }

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "user.invited",
          entityType: "Invitation",
          entityId: invitation.id,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: { email: input.email, role: input.role },
        },
      });

      return invitation;
    }),

  /**
   * Remove a user from the organization
   * This fully deletes the user from the database and WorkOS
   */
  remove: ownerProcedure
    .input(z.object({
      userId: z.string().uuid(),
      transferOwnership: z.boolean().optional().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const targetUser = await ctx.tenant.db.user.findUnique({
        where: { id: input.userId },
      });

      if (!targetUser) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (targetUser.role === "OWNER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Cannot remove the owner",
        });
      }

      // Check for owned resources
      const [mcpCount, applicationCount, toolCount] = await Promise.all([
        ctx.tenant.db.mcp.count({ where: { createdById: input.userId } }),
        ctx.tenant.db.application.count({ where: { createdById: input.userId } }),
        ctx.tenant.db.tool.count({ where: { createdById: input.userId } }),
      ]);

      const hasOwnedResources = mcpCount > 0 || applicationCount > 0 || toolCount > 0;

      // If user has resources and transfer not requested, return error with counts
      if (hasOwnedResources && !input.transferOwnership) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: JSON.stringify({
            type: "OWNERSHIP_TRANSFER_REQUIRED",
            mcpCount,
            applicationCount,
            toolCount,
          }),
        });
      }

      // Transfer ownership to the current user (owner) if requested
      if (hasOwnedResources && input.transferOwnership) {
        await Promise.all([
          mcpCount > 0 && ctx.tenant.db.mcp.updateMany({
            where: { createdById: input.userId },
            data: { createdById: ctx.tenant.userId },
          }),
          applicationCount > 0 && ctx.tenant.db.application.updateMany({
            where: { createdById: input.userId },
            data: { createdById: ctx.tenant.userId },
          }),
          toolCount > 0 && ctx.tenant.db.tool.updateMany({
            where: { createdById: input.userId },
            data: { createdById: ctx.tenant.userId },
          }),
        ]);
      }

      const userEmail = targetUser.email;
      const workosId = targetUser.workosId;

      // Delete the user from WorkOS if they have a WorkOS ID
      if (workosId) {
        try {
          const workos = await getWorkOS();
          if (workos) {
            await workos.userManagement.deleteUser(workosId);
            console.log(`[WorkOS] Deleted user ${workosId} (${userEmail})`);
          }
        } catch (error) {
          // Log but don't fail - user might already be deleted in WorkOS
          console.error(`[WorkOS] Failed to delete user ${workosId}:`, error);
        }
      }

      // Delete the user from the database
      await ctx.tenant.db.user.delete({
        where: { id: input.userId },
      });

      await ctx.tenant.db.auditLog.create({
        data: {
          action: "user.removed",
          entityType: "User",
          entityId: input.userId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            email: userEmail,
            workosUserDeleted: !!workosId,
            ownershipTransferred: hasOwnedResources,
            transferredResources: hasOwnedResources ? { mcpCount, applicationCount, toolCount } : null,
          },
        },
      });

      return { success: true };
    }),

  /**
   * List pending invitations
   */
  listInvitations: adminProcedure.query(async ({ ctx }) => {
    const invitations = await ctx.tenant.db.invitation.findMany({
      where: {
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    return invitations;
  }),

  /**
   * Cancel an invitation
   */
  cancelInvitation: adminProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.tenant.db.invitation.delete({
        where: { id: input.invitationId },
      });

      return { success: true };
    }),

  /**
   * Resend an invitation email
   */
  resendInvitation: adminProcedure
    .input(z.object({ invitationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Find the invitation
      const invitation = await ctx.tenant.db.invitation.findUnique({
        where: { id: input.invitationId },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      // Get inviter info and tenant for the email
      const [inviter, tenant] = await Promise.all([
        ctx.tenant.db.user.findUnique({
          where: { id: ctx.tenant.userId },
          select: { name: true, email: true },
        }),
        ctx.tenant.db.tenant.findUnique({
          where: { id: ctx.tenant.tenantId },
          select: { name: true },
        }),
      ]);

      // Reset expiration to 7 days from now
      const updatedInvitation = await ctx.tenant.db.invitation.update({
        where: { id: input.invitationId },
        data: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Send the invitation email
      await sendInvitationEmail({
        to: invitation.email,
        inviterName: inviter?.name || inviter?.email || "A team member",
        tenantName: tenant?.name || "your team",
        role: invitation.role,
        inviteToken: invitation.token,
      });

      return { success: true, email: invitation.email };
    }),

  // ============================================
  // JOIN REQUESTS (Domain-based provisioning)
  // ============================================

  /**
   * Get current user's pending join request (for users without a tenant)
   */
  myJoinRequest: authenticatedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session.user.id;
    const prisma = await getPrisma();

    const joinRequest = await prisma.joinRequest.findFirst({
      where: {
        userId,
        status: "PENDING",
      },
      include: {
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return joinRequest;
  }),

  /**
   * List pending join requests for the tenant (admin only)
   */
  listJoinRequests: adminProcedure.query(async ({ ctx }) => {
    const joinRequests = await ctx.tenant.db.joinRequest.findMany({
      where: {
        status: "PENDING",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
          },
        },
      },
      orderBy: { requestedAt: "desc" },
    });

    return joinRequests;
  }),

  /**
   * Approve a join request (admin only)
   */
  approveJoinRequest: adminProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        role: z.enum(["ADMIN", "MEMBER", "READONLY"]).default("MEMBER"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const prisma = await getPrisma();

      // Find the join request
      const joinRequest = await ctx.tenant.db.joinRequest.findUnique({
        where: { id: input.requestId },
        include: {
          user: true,
        },
      });

      if (!joinRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Join request not found",
        });
      }

      if (joinRequest.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Join request has already been processed",
        });
      }

      // Update the user to join the tenant
      await prisma.user.update({
        where: { id: joinRequest.userId },
        data: {
          tenantId: ctx.tenant.tenantId,
          role: input.role,
        },
      });

      // Update the join request status
      await ctx.tenant.db.joinRequest.update({
        where: { id: input.requestId },
        data: {
          status: "APPROVED",
          decidedById: ctx.tenant.userId,
          decidedAt: new Date(),
        },
      });

      // Create audit log
      await ctx.tenant.db.auditLog.create({
        data: {
          action: "join_request.approved",
          entityType: "JoinRequest",
          entityId: input.requestId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            userEmail: joinRequest.user.email,
            role: input.role,
          },
        },
      });

      return { success: true, email: joinRequest.user.email };
    }),

  /**
   * Deny a join request (admin only)
   * This also removes the user from WorkOS and deletes them from our database
   */
  denyJoinRequest: adminProcedure
    .input(z.object({ requestId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const prisma = await getPrisma();

      // Find the join request
      const joinRequest = await ctx.tenant.db.joinRequest.findUnique({
        where: { id: input.requestId },
        include: {
          user: true,
        },
      });

      if (!joinRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Join request not found",
        });
      }

      if (joinRequest.status !== "PENDING") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Join request has already been processed",
        });
      }

      const userEmail = joinRequest.user.email;
      const workosId = joinRequest.user.workosId;

      // Delete the user from WorkOS if they have a WorkOS ID
      if (workosId) {
        try {
          const workos = await getWorkOS();
          if (workos) {
            await workos.userManagement.deleteUser(workosId);
            console.log(`[WorkOS] Deleted user ${workosId} (${userEmail})`);
          }
        } catch (error) {
          // Log but don't fail - user might already be deleted in WorkOS
          console.error(`[WorkOS] Failed to delete user ${workosId}:`, error);
        }
      }

      // Delete the join request first (foreign key constraint)
      await ctx.tenant.db.joinRequest.delete({
        where: { id: input.requestId },
      });

      // Delete the user from our database
      // Use global prisma since the user is not part of this tenant
      await prisma.user.delete({
        where: { id: joinRequest.user.id },
      });

      // Create audit log
      await ctx.tenant.db.auditLog.create({
        data: {
          action: "join_request.denied",
          entityType: "JoinRequest",
          entityId: input.requestId,
          userId: ctx.tenant.userId,
          tenantId: ctx.tenant.tenantId,
          metadata: {
            userEmail,
            userDeleted: true,
            workosUserDeleted: !!workosId,
          },
        },
      });

      return { success: true, email: userEmail };
    }),
});
