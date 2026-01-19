-- Migration: tools_versioning
-- Description: Add versioning support for tools with isLatest flag, parentToolId, and updated indexes

-- ============================================
-- STEP 1: Add new columns
-- ============================================

-- Add isLatest flag for quick "get latest version" queries
ALTER TABLE "tools" ADD COLUMN "isLatest" BOOLEAN NOT NULL DEFAULT true;

-- Add parentToolId for version lineage (links to previous version)
ALTER TABLE "tools" ADD COLUMN "parentToolId" UUID;

-- ============================================
-- STEP 2: Add foreign key constraint for parentToolId
-- ============================================

-- Self-referential FK: parentToolId -> tools.id
ALTER TABLE "tools" ADD CONSTRAINT "tools_parentToolId_fkey"
  FOREIGN KEY ("parentToolId") REFERENCES "tools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- STEP 3: Drop old indexes and constraints
-- ============================================

-- Drop old unique constraint (was: applicationId, name, version)
ALTER TABLE "tools" DROP CONSTRAINT IF EXISTS "tools_applicationId_name_version_key";

-- Drop old indexes that will be replaced
DROP INDEX IF EXISTS "tools_tenantId_idx";
DROP INDEX IF EXISTS "tools_applicationId_status_idx";

-- ============================================
-- STEP 4: Create new indexes
-- ============================================

-- New unique constraint including tenantId for proper tenant isolation
CREATE UNIQUE INDEX "tools_tenantId_applicationId_name_version_key"
  ON "tools"("tenantId", "applicationId", "name", "version");

-- Primary list query: tools for an application
CREATE INDEX "tools_tenantId_applicationId_idx"
  ON "tools"("tenantId", "applicationId");

-- Filter by status
CREATE INDEX "tools_tenantId_applicationId_status_idx"
  ON "tools"("tenantId", "applicationId", "status");

-- Get latest version quickly
CREATE INDEX "tools_tenantId_applicationId_name_isLatest_idx"
  ON "tools"("tenantId", "applicationId", "name", "isLatest");

-- ============================================
-- STEP 5: Set isLatest = true for all existing tools
-- (They are all "latest" since versioning wasn't in use before)
-- ============================================

UPDATE "tools" SET "isLatest" = true WHERE "isLatest" IS NULL;

-- ============================================
-- VERIFICATION QUERIES (run after migration)
-- ============================================

-- Check indexes exist:
-- SELECT indexname FROM pg_indexes WHERE tablename = 'tools';

-- Check constraint exists:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'tools'::regclass;
