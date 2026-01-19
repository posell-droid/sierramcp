-- Migration: add_toolspec_columns
-- Description: Add missing ToolSpec columns to tools table

-- ============================================
-- Add missing columns (use ADD COLUMN IF NOT EXISTS pattern via DO block)
-- ============================================

-- title column (required, default to name initially)
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "title" TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
UPDATE "tools" SET "title" = "name" WHERE "title" IS NULL;
ALTER TABLE "tools" ALTER COLUMN "title" SET NOT NULL;

-- pathTemplate column (required)
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "pathTemplate" TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
UPDATE "tools" SET "pathTemplate" = '/api/v1/unknown' WHERE "pathTemplate" IS NULL;
ALTER TABLE "tools" ALTER COLUMN "pathTemplate" SET NOT NULL;

-- spec column (JSON, defaults to empty object)
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "spec" JSONB NOT NULL DEFAULT '{}';
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Safety flags
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "readOnly" BOOLEAN NOT NULL DEFAULT true;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "destructive" BOOLEAN NOT NULL DEFAULT false;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "pii" BOOLEAN NOT NULL DEFAULT false;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Documentation sources
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "sources" JSONB NOT NULL DEFAULT '[]';
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Test cases and examples
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "testCases" JSONB NOT NULL DEFAULT '[]';
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "examples" JSONB NOT NULL DEFAULT '{}';
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Auth configuration
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "authType" TEXT;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "authScopes" JSONB NOT NULL DEFAULT '[]';
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Lifecycle timestamps
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "publishedAt" TIMESTAMP(3);
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "deprecatedAt" TIMESTAMP(3);
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- createdById (required, set to first admin user in tenant if missing)
DO $$ BEGIN
  ALTER TABLE "tools" ADD COLUMN "createdById" UUID;
  EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Set createdById to tenant's first user if null
UPDATE "tools" t
SET "createdById" = (
  SELECT u.id FROM users u
  WHERE u."tenantId" = t."tenantId"
  LIMIT 1
)
WHERE t."createdById" IS NULL;

-- If still null (no users), this will fail - but that shouldn't happen in practice
ALTER TABLE "tools" ALTER COLUMN "createdById" SET NOT NULL;

-- Add foreign key for createdById if it doesn't exist
DO $$ BEGIN
  ALTER TABLE "tools" ADD CONSTRAINT "tools_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Add index for safety filtering if missing
-- ============================================
CREATE INDEX IF NOT EXISTS "tools_applicationId_readOnly_idx" ON "tools"("applicationId", "readOnly");

-- ============================================
-- Verification
-- ============================================
-- Run after migration: SELECT column_name FROM information_schema.columns WHERE table_name = 'tools';
