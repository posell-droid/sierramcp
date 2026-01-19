-- CreateTable
CREATE TABLE "usage_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "mcpId" UUID NOT NULL,
    "deploymentId" UUID,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "tokenCount" INTEGER,
    "platform" TEXT,
    "workspaceId" TEXT,
    "channelId" TEXT,
    "userId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_aggregates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "mcpId" UUID NOT NULL,
    "deploymentId" UUID,
    "date" DATE NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "totalLatencyMs" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "usage_aggregates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "usage_events_tenantId_timestamp_idx" ON "usage_events"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "usage_events_mcpId_timestamp_idx" ON "usage_events"("mcpId", "timestamp");

-- CreateIndex
CREATE INDEX "usage_events_tenantId_mcpId_timestamp_idx" ON "usage_events"("tenantId", "mcpId", "timestamp");

-- CreateIndex
CREATE INDEX "usage_events_deploymentId_timestamp_idx" ON "usage_events"("deploymentId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "usage_aggregates_tenantId_mcpId_deploymentId_date_key" ON "usage_aggregates"("tenantId", "mcpId", "deploymentId", "date");

-- CreateIndex
CREATE INDEX "usage_aggregates_tenantId_date_idx" ON "usage_aggregates"("tenantId", "date");

-- CreateIndex
CREATE INDEX "usage_aggregates_mcpId_date_idx" ON "usage_aggregates"("mcpId", "date");

-- CreateIndex
CREATE INDEX "usage_aggregates_deploymentId_date_idx" ON "usage_aggregates"("deploymentId", "date");

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_deploymentId_fkey" FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
