-- AlterTable: Make shop optional and add metadata for Amazon FBA OAuth
ALTER TABLE "oauth_states" ALTER COLUMN "shop" DROP NOT NULL;

-- Add metadata column for provider-specific data (e.g., Amazon region)
ALTER TABLE "oauth_states" ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';
