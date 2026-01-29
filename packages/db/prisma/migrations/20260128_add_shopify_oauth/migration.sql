-- AlterTable: Add OAuth fields to application_environments
ALTER TABLE "application_environments" ADD COLUMN IF NOT EXISTS "oauthConnectedAt" TIMESTAMP(3);
ALTER TABLE "application_environments" ADD COLUMN IF NOT EXISTS "oauthShop" TEXT;

-- CreateTable: OAuth state tracking for CSRF protection
CREATE TABLE IF NOT EXISTS "oauth_states" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "state" TEXT NOT NULL,
    "environmentId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "shop" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_states_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "oauth_states_state_key" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_states_state_idx" ON "oauth_states"("state");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_states_environmentId_idx" ON "oauth_states"("environmentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "oauth_states_tenantId_idx" ON "oauth_states"("tenantId");

-- AddForeignKey
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "application_environments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_states" ADD CONSTRAINT "oauth_states_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
