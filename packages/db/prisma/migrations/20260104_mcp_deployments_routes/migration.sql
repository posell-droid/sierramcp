-- MCP Deployments, Bot Profiles, and Chat Routes
-- This migration adds support for:
--   - MCP versions (immutable snapshots)
--   - MCP tools (tool references within an MCP)
--   - MCP config fields (dynamic configuration)
--   - MCP secret slots (secret mappings)
--   - Deployments (ECS Fargate runtime)
--   - Deployment events (audit log)
--   - Bot profiles (chat customization)
--   - Chat routes (Slack/Teams channel bindings)

-- ============================================
-- ENUMS
-- ============================================

-- MCP Version Status
CREATE TYPE "McpVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DEPRECATED');

-- Config Field Type
CREATE TYPE "ConfigFieldType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'SECRET', 'JSON', 'URL');

-- Deployment Environment
CREATE TYPE "DeploymentEnv" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION');

-- Compute Profile
CREATE TYPE "ComputeProfile" AS ENUM ('SMALL', 'MEDIUM', 'LARGE', 'XLARGE');

-- Deployment Status
CREATE TYPE "DeploymentStatus" AS ENUM (
  'PENDING',
  'PROVISIONING',
  'DEPLOYING',
  'RUNNING',
  'UPDATING',
  'SCALING',
  'DRAINING',
  'STOPPED',
  'FAILED',
  'DELETED'
);

-- Deployment Health
CREATE TYPE "DeploymentHealth" AS ENUM ('UNKNOWN', 'HEALTHY', 'UNHEALTHY', 'DEGRADED');

-- Deployment Event Type
CREATE TYPE "DeploymentEventType" AS ENUM (
  'CREATED',
  'STARTED',
  'DEPLOYED',
  'SCALED',
  'UPDATED',
  'HEALTH_CHECK',
  'ERROR',
  'STOPPED',
  'DELETED',
  'ROLLBACK'
);

-- Response Style (Bot Profiles)
CREATE TYPE "ResponseStyle" AS ENUM ('PROFESSIONAL', 'FRIENDLY', 'CONCISE', 'TECHNICAL');

-- Tool Behavior (Bot Profiles)
CREATE TYPE "ToolBehavior" AS ENUM ('AUTO', 'MANUAL', 'CONFIRM');

-- Chat Platform
CREATE TYPE "ChatPlatform" AS ENUM ('SLACK', 'TEAMS');

-- ============================================
-- MCP VERSIONS
-- ============================================

CREATE TABLE "mcp_versions" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "mcpId" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "imageUri" TEXT,
  "imageDigest" TEXT,
  "changelog" TEXT,
  "status" "McpVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "configSnapshot" JSONB NOT NULL DEFAULT '{}',
  "publishedAt" TIMESTAMP(3),
  "deprecatedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "mcp_versions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "mcp_versions_mcpId_version_key" ON "mcp_versions"("mcpId", "version");
CREATE INDEX "mcp_versions_mcpId_idx" ON "mcp_versions"("mcpId");
CREATE INDEX "mcp_versions_mcpId_status_idx" ON "mcp_versions"("mcpId", "status");

-- Foreign Key
ALTER TABLE "mcp_versions" ADD CONSTRAINT "mcp_versions_mcpId_fkey"
  FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- MCP TOOLS
-- ============================================

CREATE TABLE "mcp_tools" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "mcpId" UUID NOT NULL,
  "versionId" UUID,
  "toolId" UUID NOT NULL,
  "pinnedToolVersion" INTEGER,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "ordering" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mcp_tools_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "mcp_tools_mcpId_toolId_versionId_key" ON "mcp_tools"("mcpId", "toolId", "versionId");
CREATE INDEX "mcp_tools_mcpId_idx" ON "mcp_tools"("mcpId");
CREATE INDEX "mcp_tools_versionId_idx" ON "mcp_tools"("versionId");

-- Foreign Keys
ALTER TABLE "mcp_tools" ADD CONSTRAINT "mcp_tools_mcpId_fkey"
  FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "mcp_tools" ADD CONSTRAINT "mcp_tools_versionId_fkey"
  FOREIGN KEY ("versionId") REFERENCES "mcp_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- MCP CONFIG FIELDS
-- ============================================

CREATE TABLE "mcp_config_fields" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "mcpId" UUID NOT NULL,
  "key" TEXT NOT NULL,
  "type" "ConfigFieldType" NOT NULL DEFAULT 'STRING',
  "label" TEXT NOT NULL,
  "description" TEXT,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "defaultValue" TEXT,
  "validation" JSONB NOT NULL DEFAULT '{}',
  "ordering" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mcp_config_fields_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "mcp_config_fields_mcpId_key_key" ON "mcp_config_fields"("mcpId", "key");
CREATE INDEX "mcp_config_fields_mcpId_idx" ON "mcp_config_fields"("mcpId");

-- Foreign Key
ALTER TABLE "mcp_config_fields" ADD CONSTRAINT "mcp_config_fields_mcpId_fkey"
  FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- MCP SECRET SLOTS
-- ============================================

CREATE TABLE "mcp_secret_slots" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "mcpId" UUID NOT NULL,
  "slot" TEXT NOT NULL,
  "secretArn" TEXT,
  "lastRotated" TIMESTAMP(3),
  "rotationSchedule" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "mcp_secret_slots_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "mcp_secret_slots_mcpId_slot_key" ON "mcp_secret_slots"("mcpId", "slot");
CREATE INDEX "mcp_secret_slots_mcpId_idx" ON "mcp_secret_slots"("mcpId");

-- Foreign Key
ALTER TABLE "mcp_secret_slots" ADD CONSTRAINT "mcp_secret_slots_mcpId_fkey"
  FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- DEPLOYMENTS
-- ============================================

CREATE TABLE "deployments" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "mcpId" UUID NOT NULL,
  "mcpVersionId" UUID,
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "environment" "DeploymentEnv" NOT NULL DEFAULT 'DEVELOPMENT',
  "computeProfile" "ComputeProfile" NOT NULL DEFAULT 'SMALL',
  "minTasks" INTEGER NOT NULL DEFAULT 1,
  "maxTasks" INTEGER NOT NULL DEFAULT 3,
  "desiredTasks" INTEGER NOT NULL DEFAULT 1,
  "status" "DeploymentStatus" NOT NULL DEFAULT 'PENDING',
  "endpointUrl" TEXT,
  "albArn" TEXT,
  "targetGroupArn" TEXT,
  "ecsServiceArn" TEXT,
  "ecsClusterArn" TEXT,
  "taskDefinitionArn" TEXT,
  "health" "DeploymentHealth" NOT NULL DEFAULT 'UNKNOWN',
  "lastHealthCheck" TIMESTAMP(3),
  "healthCheckPath" TEXT NOT NULL DEFAULT '/health',
  "configValues" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deployedAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),

  CONSTRAINT "deployments_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "deployments_tenantId_mcpId_name_key" ON "deployments"("tenantId", "mcpId", "name");
CREATE INDEX "deployments_tenantId_idx" ON "deployments"("tenantId");
CREATE INDEX "deployments_tenantId_status_idx" ON "deployments"("tenantId", "status");
CREATE INDEX "deployments_mcpId_idx" ON "deployments"("mcpId");

-- Foreign Keys
ALTER TABLE "deployments" ADD CONSTRAINT "deployments_mcpId_fkey"
  FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deployments" ADD CONSTRAINT "deployments_mcpVersionId_fkey"
  FOREIGN KEY ("mcpVersionId") REFERENCES "mcp_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deployments" ADD CONSTRAINT "deployments_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- DEPLOYMENT EVENTS
-- ============================================

CREATE TABLE "deployment_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "deploymentId" UUID NOT NULL,
  "type" "DeploymentEventType" NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "triggeredById" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deployment_events_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "deployment_events_deploymentId_idx" ON "deployment_events"("deploymentId");
CREATE INDEX "deployment_events_deploymentId_createdAt_idx" ON "deployment_events"("deploymentId", "createdAt");

-- Foreign Key
ALTER TABLE "deployment_events" ADD CONSTRAINT "deployment_events_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- BOT PROFILES
-- ============================================

CREATE TABLE "bot_profiles" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenantId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "systemPrompt" TEXT,
  "responseStyle" "ResponseStyle" NOT NULL DEFAULT 'PROFESSIONAL',
  "toolBehavior" "ToolBehavior" NOT NULL DEFAULT 'AUTO',
  "enableStreaming" BOOLEAN NOT NULL DEFAULT true,
  "enableCitations" BOOLEAN NOT NULL DEFAULT true,
  "maxTokens" INTEGER NOT NULL DEFAULT 4096,
  "modelId" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "bot_profiles_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "bot_profiles_tenantId_name_key" ON "bot_profiles"("tenantId", "name");
CREATE INDEX "bot_profiles_tenantId_idx" ON "bot_profiles"("tenantId");
CREATE INDEX "bot_profiles_tenantId_isActive_idx" ON "bot_profiles"("tenantId", "isActive");

-- Foreign Key
ALTER TABLE "bot_profiles" ADD CONSTRAINT "bot_profiles_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- CHAT ROUTES
-- ============================================

CREATE TABLE "chat_routes" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "tenantId" UUID NOT NULL,
  "platform" "ChatPlatform" NOT NULL,
  "workspaceId" TEXT NOT NULL,
  "workspaceName" TEXT,
  "channelId" TEXT,
  "channelName" TEXT,
  "deploymentId" UUID,
  "botProfileId" UUID NOT NULL,
  "isFallback" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "chat_routes_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "chat_routes_tenantId_platform_workspaceId_channelId_key"
  ON "chat_routes"("tenantId", "platform", "workspaceId", "channelId");
CREATE INDEX "chat_routes_tenantId_idx" ON "chat_routes"("tenantId");
CREATE INDEX "chat_routes_tenantId_platform_workspaceId_idx"
  ON "chat_routes"("tenantId", "platform", "workspaceId");
CREATE INDEX "chat_routes_deploymentId_idx" ON "chat_routes"("deploymentId");

-- Foreign Keys
ALTER TABLE "chat_routes" ADD CONSTRAINT "chat_routes_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "chat_routes" ADD CONSTRAINT "chat_routes_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "chat_routes" ADD CONSTRAINT "chat_routes_botProfileId_fkey"
  FOREIGN KEY ("botProfileId") REFERENCES "bot_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================
-- USAGE TRACKING UPDATES
-- ============================================

-- Add deploymentId to usage_events
ALTER TABLE "usage_events" ADD COLUMN "deploymentId" UUID;
ALTER TABLE "usage_events" ADD COLUMN "platform" TEXT;
ALTER TABLE "usage_events" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "usage_events" ADD COLUMN "channelId" TEXT;
ALTER TABLE "usage_events" ADD COLUMN "userId" TEXT;

-- Add index for deployment-based queries
CREATE INDEX "usage_events_deploymentId_timestamp_idx" ON "usage_events"("deploymentId", "timestamp");

-- Add foreign key
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add deploymentId to usage_aggregates
ALTER TABLE "usage_aggregates" ADD COLUMN "deploymentId" UUID;

-- Drop old unique constraint and add new one with deploymentId
ALTER TABLE "usage_aggregates" DROP CONSTRAINT IF EXISTS "usage_aggregates_tenantId_mcpId_date_key";
CREATE UNIQUE INDEX "usage_aggregates_tenantId_mcpId_deploymentId_date_key"
  ON "usage_aggregates"("tenantId", "mcpId", "deploymentId", "date");

-- Add index for deployment-based queries
CREATE INDEX "usage_aggregates_deploymentId_date_idx" ON "usage_aggregates"("deploymentId", "date");

-- Add foreign key
ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_deploymentId_fkey"
  FOREIGN KEY ("deploymentId") REFERENCES "deployments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
