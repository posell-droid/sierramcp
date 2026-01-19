import { z } from "zod";
import type { TenantContext } from "../tenant/context";

/**
 * Custom auth error with error codes
 */
export class AuthError extends Error {
  constructor(
    message: string,
    public code:
      | "TOKEN_EXPIRED"
      | "INVALID_TOKEN"
      | "INVALID_CLAIMS"
      | "MISSING_CLAIMS"
      | "UNAUTHORIZED"
      | "EMAIL_NOT_VERIFIED"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Session data from NextAuth
 */
export interface SessionData {
  user: {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    tenantId?: string | null;
    tenantSlug?: string | null;
    role?: string;
  };
}

/**
 * UUID v4 validation regex
 * Matches standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate that a string is a valid UUID
 */
export function isValidUUID(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_REGEX.test(value);
}

/**
 * Create tenant context from NextAuth session
 *
 * CRITICAL: This function validates that user.id and tenantId are valid UUIDs.
 * If they are not valid UUIDs (e.g., WorkOS IDs like "user_..."), this returns null
 * to prevent Prisma errors when writing to UUID columns like createdById/tenantId.
 */
export function sessionToTenantContext(session: SessionData): TenantContext | null {
  const { user } = session;

  // Validate user.id is a valid UUID (not a WorkOS ID like "user_...")
  if (!isValidUUID(user.id)) {
    console.error("[Auth] Invalid user.id - not a UUID:", user.id?.substring(0, 20));
    return null;
  }

  if (!user.tenantId || !user.tenantSlug) {
    // User exists but not yet part of a tenant
    return null;
  }

  // Validate tenantId is a valid UUID
  if (!isValidUUID(user.tenantId)) {
    console.error("[Auth] Invalid tenantId - not a UUID:", user.tenantId?.substring(0, 20));
    return null;
  }

  return {
    tenantId: user.tenantId,
    tenantSlug: user.tenantSlug,
    userId: user.id,
    userRole: user.role || "MEMBER",
  };
}

/**
 * Check if user has required role
 */
export function hasRole(userRole: string, requiredRoles: string[]): boolean {
  const roleHierarchy: Record<string, number> = {
    OWNER: 100,
    ADMIN: 75,
    MEMBER: 50,
    READONLY: 25,
  };

  const userLevel = roleHierarchy[userRole] || 0;
  const requiredLevel = Math.min(
    ...requiredRoles.map((r) => roleHierarchy[r] || 100)
  );

  return userLevel >= requiredLevel;
}

/**
 * Role-based access control decorator/helper
 */
export function requireRole(...roles: string[]) {
  return function checkRole(userRole: string): void {
    if (!hasRole(userRole, roles)) {
      throw new AuthError(
        `Requires one of roles: ${roles.join(", ")}`,
        "UNAUTHORIZED"
      );
    }
  };
}

/**
 * Extract Bearer token from Authorization header
 * (kept for API key authentication if needed)
 */
export function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Password hashing utilities
 */
export async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  const bcrypt = await import("bcryptjs");
  return bcrypt.compare(password, hash);
}

/**
 * Generate a 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
