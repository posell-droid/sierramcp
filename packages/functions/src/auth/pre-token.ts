import { PreTokenGenerationTriggerEvent } from "aws-lambda";
import { prisma } from "@repo/db";

/**
 * Cognito Pre Token Generation Trigger
 * 
 * This Lambda runs after successful authentication and before
 * tokens are issued. It injects tenant-specific claims into the
 * ID and access tokens.
 */
export async function handler(
  event: PreTokenGenerationTriggerEvent
): Promise<PreTokenGenerationTriggerEvent> {
  const { userName, request } = event;
  const cognitoSub = request.userAttributes.sub;
  
  console.log(`Pre-token generation for user: ${userName}`);
  
  try {
    // Look up user and their tenant
    const user = await prisma.user.findFirst({
      where: { 
        cognitoSub,
        status: "ACTIVE",
      },
      include: {
        tenant: {
          select: {
            id: true,
            slug: true,
            plan: true,
            status: true,
          },
        },
      },
    });
    
    if (!user) {
      console.error(`User not found for Cognito sub: ${cognitoSub}`);
      throw new Error("User not found");
    }
    
    if (user.tenant.status !== "ACTIVE") {
      console.error(`Tenant ${user.tenant.id} is not active`);
      throw new Error("Organization is not active");
    }
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    
    // Inject custom claims into the token
    event.response = {
      claimsOverrideDetails: {
        claimsToAddOrOverride: {
          "custom:tenant_id": user.tenant.id,
          "custom:tenant_slug": user.tenant.slug,
          "custom:user_role": user.role,
          "custom:plan": user.tenant.plan,
          "custom:user_id": user.id,
        },
      },
    };
    
    console.log(`Injected claims for tenant: ${user.tenant.slug}`);
    
  } catch (error) {
    console.error("Pre-token generation failed:", error);
    // Don't throw - let Cognito handle with default claims
    // The application will reject requests without required claims
  }
  
  return event;
}
