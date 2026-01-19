import { z } from "zod";
import { router, publicProcedure, authenticatedProcedure } from "../trpc";
import { prisma } from "@repo/db";

/**
 * Auth Router
 *
 * DEPRECATED: Most authentication is now handled through WorkOS AuthKit.
 * The endpoints below are kept for backward compatibility but should not be used.
 *
 * Authentication flow:
 * 1. User visits /login and clicks "Continue"
 * 2. Redirected to WorkOS AuthKit (/api/auth/workos)
 * 3. WorkOS handles email/password, SSO, and social logins
 * 4. Callback creates user and JWT session (/api/auth/workos/callback)
 * 5. New users without a tenant see the join request approval page
 */

export const authRouter = router({
  /**
   * Get current user's pending join request
   * This is still used by the pending-approval page
   */
  getPendingJoinRequest: authenticatedProcedure.query(async ({ ctx }) => {
    if (!ctx.session?.user) {
      return null;
    }

    const request = await prisma.joinRequest.findFirst({
      where: {
        userId: ctx.session.user.id,
        status: "PENDING",
      },
      include: {
        tenant: {
          select: { id: true, name: true, slug: true },
        },
      },
    });

    return request;
  }),

  /**
   * @deprecated Use WorkOS AuthKit instead
   * Kept for backward compatibility - returns error directing users to use SSO
   */
  signup: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(8).max(100),
        name: z.string().min(1).max(255),
      })
    )
    .mutation(async () => {
      // Direct users to use the WorkOS sign-in flow
      return {
        error: "DEPRECATED",
        message: "Please use the Sign In button to create an account via WorkOS",
        redirectTo: "/login",
      };
    }),

  /**
   * @deprecated WorkOS handles email verification
   */
  sendVerificationCode: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        type: z.enum(["EMAIL_VERIFICATION", "PASSWORD_RESET"]),
      })
    )
    .mutation(async () => {
      return {
        error: "DEPRECATED",
        message: "Email verification is handled by WorkOS",
        redirectTo: "/login",
      };
    }),

  /**
   * @deprecated WorkOS handles email verification
   */
  verifyEmail: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
      })
    )
    .mutation(async () => {
      return {
        error: "DEPRECATED",
        message: "Email verification is handled by WorkOS",
        redirectTo: "/login",
      };
    }),

  /**
   * @deprecated WorkOS handles password reset
   */
  resetPassword: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        code: z.string().length(6),
        newPassword: z.string().min(8).max(100),
      })
    )
    .mutation(async () => {
      return {
        error: "DEPRECATED",
        message: "Password reset is handled by WorkOS. Click 'Forgot password?' on the WorkOS sign-in page.",
        redirectTo: "/login",
      };
    }),
});
