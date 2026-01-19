-- Add chunk_hash column for embedding cache deduplication
-- This allows skipping re-embedding of identical content across documents

-- Step 1: Add the chunk_hash column (nullable to support existing rows)
ALTER TABLE "document_chunks" ADD COLUMN IF NOT EXISTS "chunk_hash" TEXT;

-- Step 2: Create unique index for cache lookups
-- Partial index: only index non-null hashes to allow multiple NULL values
CREATE UNIQUE INDEX IF NOT EXISTS "document_chunks_tenantId_chunk_hash_key"
ON "document_chunks" ("tenantId", "chunk_hash")
WHERE "chunk_hash" IS NOT NULL;

-- Step 3: Create index for efficient cache lookups by hash
CREATE INDEX IF NOT EXISTS "document_chunks_chunk_hash_idx"
ON "document_chunks" ("chunk_hash")
WHERE "chunk_hash" IS NOT NULL;

-- Note: Existing chunks will have NULL chunk_hash.
-- They will be populated on next reprocessing or can be backfilled with:
--
-- UPDATE document_chunks
-- SET chunk_hash = encode(sha256(
--   lower(regexp_replace(trim(content), '\s+', ' ', 'g'))::bytea
-- ), 'hex')
-- WHERE chunk_hash IS NULL;
