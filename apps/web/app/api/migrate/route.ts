import { NextResponse } from "next/server";
import { Pool } from "pg";
import { Resource } from "sst";

interface DatabaseResource {
  database: string;
  host: string;
  password: string;
  port: number;
  username: string;
}

const MIGRATION_SQL = `
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BillingStatus" AS ENUM ('NOT_CONFIGURED', 'ACTIVE', 'PAYMENT_FAILED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'READONLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "VerificationCodeType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "McpType" AS ENUM ('API', 'DOCUMENTATION', 'HYBRID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "McpStatus" AS ENUM ('DRAFT', 'ACTIVE', 'DISABLED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable tenants
CREATE TABLE IF NOT EXISTS "tenants" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "primaryDomain" TEXT,
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'NOT_CONFIGURED',
    "stripeCustomerId" TEXT,
    "stripePaymentMethodId" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable users
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatarUrl" TEXT,
    "passwordHash" TEXT,
    "emailVerified" TIMESTAMP(3),
    "googleId" TEXT,
    "workosId" TEXT,
    "cognitoSub" TEXT,
    "tenantId" UUID,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable verification_codes
CREATE TABLE IF NOT EXISTS "verification_codes" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "VerificationCodeType" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable join_requests
CREATE TABLE IF NOT EXISTS "join_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decidedById" UUID,
    "decidedAt" TIMESTAMP(3),
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable invitations
CREATE TABLE IF NOT EXISTS "invitations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "invitedById" UUID,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable api_keys
CREATE TABLE IF NOT EXISTS "api_keys" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "tenantId" UUID NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '["read"]',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable mcps
CREATE TABLE IF NOT EXISTS "mcps" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "McpType" NOT NULL,
    "status" "McpStatus" NOT NULL DEFAULT 'DRAFT',
    "configJson" JSONB NOT NULL DEFAULT '{}',
    "tenantId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "mcps_pkey" PRIMARY KEY ("id")
);

-- CreateTable secrets
CREATE TABLE IF NOT EXISTS "secrets" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "mcpId" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "keyName" TEXT NOT NULL,
    "encryptedValue" BYTEA NOT NULL,
    "lastFourChars" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "secrets_pkey" PRIMARY KEY ("id")
);

-- CreateTable usage_events
CREATE TABLE IF NOT EXISTS "usage_events" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "mcpId" UUID NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "latencyMs" INTEGER,
    "tokenCount" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable usage_aggregates
CREATE TABLE IF NOT EXISTS "usage_aggregates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "mcpId" UUID NOT NULL,
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

-- CreateTable audit_logs
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "tenantId" UUID NOT NULL,
    "userId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
`;

const ADD_USER_PREFERENCES_SQL = `
-- Add timezone and language columns to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'America/New_York';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT 'en';
`;

const ADD_COMPANY_FIELDS_SQL = `
-- Add new enums for company fields
DO $$ BEGIN
  CREATE TYPE "CompanySize" AS ENUM ('SOLO', 'SMALL', 'MEDIUM', 'LARGE', 'ENTERPRISE', 'CORPORATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TenantEnvironment" AS ENUM ('PRODUCTION', 'SANDBOX', 'TRIAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DpaStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'SIGNED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Core Information
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalName" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "industry" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "companySize" "CompanySize";

-- Address & Contact - Legal Address
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalAddressLine1" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalAddressLine2" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalCity" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalState" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalPostalCode" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalCountry" TEXT;

-- Address & Contact - Operating Address
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operatingAddressLine1" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operatingAddressLine2" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operatingCity" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operatingState" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operatingPostalCode" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "operatingCountry" TEXT;

-- Timezone & Locale
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT 'America/New_York';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "defaultLanguage" TEXT DEFAULT 'en';

-- Contact Information
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "primaryContactName" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "primaryContactEmail" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "supportEmail" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "phone" TEXT;

-- Branding & Customization
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "faviconUrl" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "primaryColor" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "secondaryColor" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "customDomain" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "emailSenderName" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "emailSenderDomain" TEXT;

-- System Metadata
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "status" "TenantStatus" DEFAULT 'ACTIVE';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "environment" "TenantEnvironment" DEFAULT 'PRODUCTION';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dataResidency" TEXT DEFAULT 'us-east-1';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB DEFAULT '{}';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "rateLimits" JSONB DEFAULT '{}';

-- Billing & Subscription
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;

-- Billing Contact
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingContactName" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingContactEmail" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingAddressLine1" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingAddressLine2" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingCity" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingState" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingPostalCode" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "billingCountry" TEXT;

-- Tax Information
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "taxId" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "taxExempt" BOOLEAN DEFAULT false;

-- Compliance & Legal
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "legalEntityType" TEXT;
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "privacyPolicyAcceptedAt" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "dpaStatus" "DpaStatus" DEFAULT 'NOT_REQUIRED';
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "complianceTags" JSONB DEFAULT '[]';

-- Add unique constraint for customDomain
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_customDomain_key" ON "tenants"("customDomain");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_stripeSubscriptionId_key" ON "tenants"("stripeSubscriptionId");
`;

const ADD_APPLICATIONS_TOOLS_SQL = `
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create new enums for Applications & Tools
DO $$ BEGIN
  CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'CONFIGURING', 'ACTIVE', 'DISABLED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "EnvironmentType" AS ENUM ('PRODUCTION', 'SANDBOX', 'DEVELOPMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "AuthType" AS ENUM ('API_KEY', 'OAUTH2', 'BASIC', 'BEARER', 'CUSTOM_HEADER', 'MTLS', 'NONE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentSourceType" AS ENUM ('URL', 'UPLOAD', 'TEXT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ToolStatus" AS ENUM ('DRAFT', 'TESTED', 'PUBLISHED', 'DEPRECATED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "HttpMethod" AS ENUM ('GET', 'POST', 'PUT', 'PATCH', 'DELETE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create application_templates table
CREATE TABLE IF NOT EXISTS "application_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "authTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "docsUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_templates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "application_templates_slug_key" ON "application_templates"("slug");

-- Create applications table
CREATE TABLE IF NOT EXISTS "applications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "slug" TEXT NOT NULL,
    "templateId" UUID,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "tenantId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "applications_tenantId_slug_key" ON "applications"("tenantId", "slug");
CREATE INDEX IF NOT EXISTS "applications_tenantId_idx" ON "applications"("tenantId");
CREATE INDEX IF NOT EXISTS "applications_tenantId_status_idx" ON "applications"("tenantId", "status");

-- Create application_environments table
CREATE TABLE IF NOT EXISTS "application_environments" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "applicationId" UUID NOT NULL,
    "environment" "EnvironmentType" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authType" "AuthType" NOT NULL,
    "authConfig" JSONB NOT NULL DEFAULT '{}',
    "secretArn" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastTestedAt" TIMESTAMP(3),
    "lastTestStatus" TEXT,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_environments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "application_environments_applicationId_environment_key" ON "application_environments"("applicationId", "environment");
CREATE INDEX IF NOT EXISTS "application_environments_tenantId_idx" ON "application_environments"("tenantId");

-- Create application_documents table
CREATE TABLE IF NOT EXISTS "application_documents" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "applicationId" UUID NOT NULL,
    "sourceType" "DocumentSourceType" NOT NULL,
    "sourceUrl" TEXT,
    "s3Key" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "status" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "errorMessage" TEXT,
    "title" TEXT,
    "tenantId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    CONSTRAINT "application_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "application_documents_tenantId_idx" ON "application_documents"("tenantId");
CREATE INDEX IF NOT EXISTS "application_documents_applicationId_status_idx" ON "application_documents"("applicationId", "status");

-- Create document_chunks table (with vector embedding)
CREATE TABLE IF NOT EXISTS "document_chunks" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "documentId" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "embedding" vector(1536),
    "tenantId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "document_chunks_tenantId_applicationId_idx" ON "document_chunks"("tenantId", "applicationId");
CREATE INDEX IF NOT EXISTS "document_chunks_documentId_idx" ON "document_chunks"("documentId");

-- Create tools table
CREATE TABLE IF NOT EXISTS "tools" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "applicationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "ToolStatus" NOT NULL DEFAULT 'DRAFT',
    "httpMethod" "HttpMethod" NOT NULL,
    "pathTemplate" TEXT NOT NULL,
    "inputSchema" JSONB NOT NULL DEFAULT '{}',
    "outputSchema" JSONB NOT NULL DEFAULT '{}',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "queryParams" JSONB NOT NULL DEFAULT '{}',
    "bodyTemplate" JSONB,
    "responseMapping" JSONB NOT NULL DEFAULT '{}',
    "policies" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "publishedAt" TIMESTAMP(3),
    "deprecatedAt" TIMESTAMP(3),
    "tenantId" UUID NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tools_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "tools_applicationId_name_version_key" ON "tools"("applicationId", "name", "version");
CREATE INDEX IF NOT EXISTS "tools_tenantId_idx" ON "tools"("tenantId");
CREATE INDEX IF NOT EXISTS "tools_applicationId_status_idx" ON "tools"("applicationId", "status");

-- Create tool_test_results table
CREATE TABLE IF NOT EXISTS "tool_test_results" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "toolId" UUID NOT NULL,
    "input" JSONB NOT NULL,
    "expectedOutput" JSONB,
    "actualOutput" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "environmentId" UUID,
    "testedById" UUID NOT NULL,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_test_results_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tool_test_results_toolId_idx" ON "tool_test_results"("toolId");
CREATE INDEX IF NOT EXISTS "tool_test_results_tenantId_idx" ON "tool_test_results"("tenantId");

-- Create tool_executions table
CREATE TABLE IF NOT EXISTS "tool_executions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "toolId" UUID NOT NULL,
    "environmentId" UUID NOT NULL,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "success" BOOLEAN NOT NULL,
    "errorMessage" TEXT,
    "durationMs" INTEGER NOT NULL,
    "httpStatusCode" INTEGER,
    "deploymentId" UUID,
    "sessionId" TEXT,
    "tenantId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "tool_executions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "tool_executions_toolId_createdAt_idx" ON "tool_executions"("toolId", "createdAt");
CREATE INDEX IF NOT EXISTS "tool_executions_tenantId_createdAt_idx" ON "tool_executions"("tenantId", "createdAt");

-- Add foreign keys for Applications & Tools
DO $$ BEGIN
  ALTER TABLE "applications" ADD CONSTRAINT "applications_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "application_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "applications" ADD CONSTRAINT "applications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "applications" ADD CONSTRAINT "applications_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "application_environments" ADD CONSTRAINT "application_environments_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "application_documents" ADD CONSTRAINT "application_documents_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "application_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD CONSTRAINT "tools_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD CONSTRAINT "tools_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tools" ADD CONSTRAINT "tools_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tool_test_results" ADD CONSTRAINT "tool_test_results_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "tools"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "application_environments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
`;

const SEED_APPLICATION_TEMPLATES_SQL = `
-- Seed 20 application templates (using ON CONFLICT to avoid duplicates)
INSERT INTO "application_templates" ("id", "slug", "name", "category", "description", "logoUrl", "authTypes", "docsUrl", "sortOrder", "updatedAt")
VALUES
  (uuid_generate_v4(), 'salesforce', 'Salesforce CRM', 'CRM', 'Customer relationship management platform for sales, service, and marketing', 'https://logo.clearbit.com/salesforce.com', ARRAY['OAUTH2'], 'https://developer.salesforce.com/docs', 1, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'servicenow', 'ServiceNow', 'ITSM', 'IT service management and digital workflow platform', 'https://logo.clearbit.com/servicenow.com', ARRAY['OAUTH2', 'BASIC'], 'https://developer.servicenow.com/dev.do', 2, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'microsoft365', 'Microsoft 365', 'Productivity', 'Microsoft Graph API for Office 365, Teams, and Azure AD', 'https://logo.clearbit.com/microsoft.com', ARRAY['OAUTH2'], 'https://learn.microsoft.com/en-us/graph/', 3, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'google-workspace', 'Google Workspace', 'Productivity', 'Google APIs for Gmail, Drive, Calendar, and more', 'https://logo.clearbit.com/google.com', ARRAY['OAUTH2'], 'https://developers.google.com/workspace', 4, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'slack', 'Slack', 'Communication', 'Team messaging and collaboration platform', 'https://logo.clearbit.com/slack.com', ARRAY['OAUTH2', 'BEARER'], 'https://api.slack.com/docs', 5, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'jira', 'Jira', 'Project Management', 'Agile project management and issue tracking', 'https://logo.clearbit.com/atlassian.com', ARRAY['BASIC', 'BEARER'], 'https://developer.atlassian.com/cloud/jira/platform/', 6, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'confluence', 'Confluence', 'Documentation', 'Team collaboration and documentation wiki', 'https://logo.clearbit.com/atlassian.com', ARRAY['BASIC', 'BEARER'], 'https://developer.atlassian.com/cloud/confluence/', 7, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'zendesk', 'Zendesk', 'Support', 'Customer service and engagement platform', 'https://logo.clearbit.com/zendesk.com', ARRAY['OAUTH2', 'API_KEY'], 'https://developer.zendesk.com/api-reference/', 8, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'hubspot', 'HubSpot', 'CRM/Marketing', 'CRM, marketing, sales, and service platform', 'https://logo.clearbit.com/hubspot.com', ARRAY['OAUTH2', 'API_KEY'], 'https://developers.hubspot.com/docs/api/overview', 9, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'workday', 'Workday', 'HR', 'Human capital management and financial management', 'https://logo.clearbit.com/workday.com', ARRAY['OAUTH2'], 'https://developer.workday.com/', 10, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'netsuite', 'NetSuite', 'ERP', 'Cloud ERP for financials, inventory, and ecommerce', 'https://logo.clearbit.com/netsuite.com', ARRAY['OAUTH2'], 'https://docs.oracle.com/en/cloud/saas/netsuite/', 11, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'sap', 'SAP S/4HANA', 'ERP', 'Enterprise resource planning and business suite', 'https://logo.clearbit.com/sap.com', ARRAY['OAUTH2', 'BASIC'], 'https://api.sap.com/', 12, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'oracle-fusion', 'Oracle Fusion', 'ERP', 'Cloud applications for ERP, HCM, and CX', 'https://logo.clearbit.com/oracle.com', ARRAY['OAUTH2'], 'https://docs.oracle.com/en/cloud/saas/', 13, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'okta', 'Okta', 'Identity', 'Identity and access management platform', 'https://logo.clearbit.com/okta.com', ARRAY['OAUTH2', 'API_KEY'], 'https://developer.okta.com/docs/', 14, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'github', 'GitHub', 'DevOps', 'Code hosting and version control with CI/CD', 'https://logo.clearbit.com/github.com', ARRAY['OAUTH2', 'BEARER'], 'https://raw.githubusercontent.com/github/rest-api-description/main/descriptions/api.github.com/api.github.com.json', 15, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'gitlab', 'GitLab', 'DevOps', 'DevSecOps platform with integrated CI/CD', 'https://logo.clearbit.com/gitlab.com', ARRAY['OAUTH2', 'BEARER'], 'https://docs.gitlab.com/ee/api/', 16, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'snowflake', 'Snowflake', 'Data', 'Cloud data platform for analytics and data sharing', 'https://logo.clearbit.com/snowflake.com', ARRAY['OAUTH2', 'BASIC'], 'https://docs.snowflake.com/en/developer-guide/sql-api/', 17, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'datadog', 'Datadog', 'Monitoring', 'Cloud monitoring and security platform', 'https://logo.clearbit.com/datadoghq.com', ARRAY['API_KEY'], 'https://docs.datadoghq.com/api/', 18, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'stripe', 'Stripe', 'Payments', 'Payment processing and financial infrastructure', 'https://logo.clearbit.com/stripe.com', ARRAY['API_KEY', 'BEARER'], 'https://raw.githubusercontent.com/stripe/openapi/master/openapi/spec3.yaml', 19, CURRENT_TIMESTAMP),
  (uuid_generate_v4(), 'shopify', 'Shopify', 'E-commerce', 'E-commerce platform for online stores', 'https://logo.clearbit.com/shopify.com', ARRAY['OAUTH2', 'API_KEY'], 'https://shopify.dev/docs/api', 20, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET
  "name" = EXCLUDED."name",
  "category" = EXCLUDED."category",
  "description" = EXCLUDED."description",
  "logoUrl" = EXCLUDED."logoUrl",
  "authTypes" = EXCLUDED."authTypes",
  "docsUrl" = EXCLUDED."docsUrl",
  "sortOrder" = EXCLUDED."sortOrder",
  "updatedAt" = CURRENT_TIMESTAMP;
`;

const INDEXES_SQL = `
-- CreateIndex (using IF NOT EXISTS pattern)
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_primaryDomain_key" ON "tenants"("primaryDomain");
CREATE UNIQUE INDEX IF NOT EXISTS "tenants_stripeCustomerId_key" ON "tenants"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_googleId_key" ON "users"("googleId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_workosId_key" ON "users"("workosId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_cognitoSub_key" ON "users"("cognitoSub");
CREATE INDEX IF NOT EXISTS "users_email_idx" ON "users"("email");
CREATE INDEX IF NOT EXISTS "users_googleId_idx" ON "users"("googleId");
CREATE INDEX IF NOT EXISTS "users_workosId_idx" ON "users"("workosId");
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_email_key" ON "users"("tenantId", "email");
CREATE INDEX IF NOT EXISTS "verification_codes_code_email_idx" ON "verification_codes"("code", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "verification_codes_email_type_key" ON "verification_codes"("email", "type");
CREATE INDEX IF NOT EXISTS "join_requests_tenantId_status_idx" ON "join_requests"("tenantId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "join_requests_userId_tenantId_key" ON "join_requests"("userId", "tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_token_key" ON "invitations"("token");
CREATE INDEX IF NOT EXISTS "invitations_token_idx" ON "invitations"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "invitations_tenantId_email_key" ON "invitations"("tenantId", "email");
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash");
CREATE INDEX IF NOT EXISTS "api_keys_tenantId_idx" ON "api_keys"("tenantId");
CREATE INDEX IF NOT EXISTS "api_keys_keyPrefix_idx" ON "api_keys"("keyPrefix");
CREATE INDEX IF NOT EXISTS "mcps_tenantId_idx" ON "mcps"("tenantId");
CREATE INDEX IF NOT EXISTS "mcps_tenantId_status_idx" ON "mcps"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "secrets_tenantId_idx" ON "secrets"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "secrets_mcpId_keyName_key" ON "secrets"("mcpId", "keyName");
CREATE INDEX IF NOT EXISTS "usage_events_tenantId_timestamp_idx" ON "usage_events"("tenantId", "timestamp");
CREATE INDEX IF NOT EXISTS "usage_events_mcpId_timestamp_idx" ON "usage_events"("mcpId", "timestamp");
CREATE INDEX IF NOT EXISTS "usage_events_tenantId_mcpId_timestamp_idx" ON "usage_events"("tenantId", "mcpId", "timestamp");
CREATE INDEX IF NOT EXISTS "usage_aggregates_tenantId_date_idx" ON "usage_aggregates"("tenantId", "date");
CREATE INDEX IF NOT EXISTS "usage_aggregates_mcpId_date_idx" ON "usage_aggregates"("mcpId", "date");
CREATE UNIQUE INDEX IF NOT EXISTS "usage_aggregates_tenantId_mcpId_date_key" ON "usage_aggregates"("tenantId", "mcpId", "date");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_entityType_entityId_idx" ON "audit_logs"("tenantId", "entityType", "entityId");
`;

const FOREIGN_KEYS_SQL = `
-- AddForeignKey (only if not exists)
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "join_requests" ADD CONSTRAINT "join_requests_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "invitations" ADD CONSTRAINT "invitations_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "mcps" ADD CONSTRAINT "mcps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "mcps" ADD CONSTRAINT "mcps_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "secrets" ADD CONSTRAINT "secrets_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "secrets" ADD CONSTRAINT "secrets_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_aggregates" ADD CONSTRAINT "usage_aggregates_mcpId_fkey" FOREIGN KEY ("mcpId") REFERENCES "mcps"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
`;

export async function POST() {
  // Get database config from SST Resource linking
  const db = (Resource as unknown as { Database?: DatabaseResource }).Database;

  let pool: Pool;

  if (db) {
    console.log("Using SST Resource for database connection");
    pool = new Pool({
      host: db.host,
      port: db.port,
      database: db.database,
      user: db.username,
      password: db.password,
      ssl: { rejectUnauthorized: false },
    });
  } else if (process.env.DATABASE_URL) {
    console.log("Using DATABASE_URL environment variable");
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  } else {
    return NextResponse.json(
      { success: false, error: "Database not configured" },
      { status: 500 }
    );
  }

  const results: string[] = [];

  try {
    // Step 1: Create extension and enums, then tables
    console.log("Step 1: Creating tables...");
    await pool.query(MIGRATION_SQL);
    results.push("Tables created successfully");

    // Step 2: Create indexes
    console.log("Step 2: Creating indexes...");
    await pool.query(INDEXES_SQL);
    results.push("Indexes created successfully");

    // Step 3: Add foreign keys
    console.log("Step 3: Adding foreign keys...");
    await pool.query(FOREIGN_KEYS_SQL);
    results.push("Foreign keys added successfully");

    // Step 4: Add user preferences columns
    console.log("Step 4: Adding user preferences columns...");
    await pool.query(ADD_USER_PREFERENCES_SQL);
    results.push("User preferences columns added successfully");

    // Step 5: Add company/tenant fields
    console.log("Step 5: Adding company/tenant fields...");
    await pool.query(ADD_COMPANY_FIELDS_SQL);
    results.push("Company/tenant fields added successfully");

    // Step 6: Add Applications & Tools tables
    console.log("Step 6: Adding Applications & Tools tables...");
    await pool.query(ADD_APPLICATIONS_TOOLS_SQL);
    results.push("Applications & Tools tables added successfully");

    // Step 7: Seed application templates
    console.log("Step 7: Seeding application templates...");
    await pool.query(SEED_APPLICATION_TEMPLATES_SQL);
    results.push("Application templates seeded successfully");

    // Step 8: Force update template logos using jsdelivr Simple Icons CDN
    console.log("Step 8: Updating template logos...");
    await pool.query(`
      UPDATE "application_templates" SET "logoUrl" = CASE "slug"
        WHEN 'salesforce' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/salesforce.svg'
        WHEN 'servicenow' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/servicenow.svg'
        WHEN 'microsoft365' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/microsoft.svg'
        WHEN 'google-workspace' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/google.svg'
        WHEN 'slack' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/slack.svg'
        WHEN 'jira' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/jira.svg'
        WHEN 'confluence' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/confluence.svg'
        WHEN 'zendesk' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/zendesk.svg'
        WHEN 'hubspot' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/hubspot.svg'
        WHEN 'workday' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/workday.svg'
        WHEN 'netsuite' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/oracle.svg'
        WHEN 'sap' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/sap.svg'
        WHEN 'oracle-fusion' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/oracle.svg'
        WHEN 'okta' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/okta.svg'
        WHEN 'github' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/github.svg'
        WHEN 'gitlab' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/gitlab.svg'
        WHEN 'snowflake' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/snowflake.svg'
        WHEN 'datadog' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/datadog.svg'
        WHEN 'stripe' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/stripe.svg'
        WHEN 'shopify' THEN 'https://cdn.jsdelivr.net/npm/simple-icons@v10/icons/shopify.svg'
        ELSE "logoUrl"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
      WHERE "slug" IN ('salesforce', 'servicenow', 'microsoft365', 'google-workspace', 'slack', 'jira', 'confluence', 'zendesk', 'hubspot', 'workday', 'netsuite', 'sap', 'oracle-fusion', 'okta', 'github', 'gitlab', 'snowflake', 'datadog', 'stripe', 'shopify');
    `);
    results.push("Template logos updated successfully");

    // Step 9: Add logoUrl column to applications table (for custom logos)
    await pool.query(`
      ALTER TABLE "applications" ADD COLUMN IF NOT EXISTS "logoUrl" TEXT;
    `);
    results.push("Applications logoUrl column added");

    // Step 10: Add contentHash column to application_documents table (for deduplication)
    await pool.query(`
      ALTER TABLE "application_documents" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;
    `);
    results.push("Documents contentHash column added");

    // Step 11: Add template configuration columns
    await pool.query(`
      ALTER TABLE "application_templates" ADD COLUMN IF NOT EXISTS "defaultBaseUrl" TEXT;
      ALTER TABLE "application_templates" ADD COLUMN IF NOT EXISTS "defaultAuthType" "AuthType";
      ALTER TABLE "application_templates" ADD COLUMN IF NOT EXISTS "authConfig" JSONB DEFAULT '{}';
      ALTER TABLE "application_templates" ADD COLUMN IF NOT EXISTS "defaultTools" JSONB DEFAULT '[]';
      ALTER TABLE "application_templates" ADD COLUMN IF NOT EXISTS "documentationUrls" TEXT[] DEFAULT '{}';
    `);
    results.push("Template configuration columns added");

    // Step 12: Configure Google Workspace template with real data
    await pool.query(`
      UPDATE "application_templates"
      SET
        "defaultBaseUrl" = 'https://www.googleapis.com',
        "defaultAuthType" = 'OAUTH2',
        "authConfig" = $1::jsonb,
        "defaultTools" = $2::jsonb,
        "documentationUrls" = $3::text[]
      WHERE "slug" = 'google-workspace';
    `, [
      // authConfig - OAuth2 configuration for Google
      JSON.stringify({
        tokenUrl: "https://oauth2.googleapis.com/token",
        authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        scopes: [
          "https://www.googleapis.com/auth/gmail.readonly",
          "https://www.googleapis.com/auth/gmail.send",
          "https://www.googleapis.com/auth/calendar.readonly",
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/drive.readonly",
          "https://www.googleapis.com/auth/drive.file",
          "https://www.googleapis.com/auth/admin.directory.user.readonly"
        ],
        notes: "Create OAuth2 credentials at https://console.cloud.google.com/apis/credentials"
      }),
      // defaultTools - Pre-built tool definitions
      JSON.stringify([
        {
          name: "list_gmail_messages",
          displayName: "List Gmail Messages",
          description: "List messages in the user's Gmail inbox with optional filtering",
          httpMethod: "GET",
          pathTemplate: "/gmail/v1/users/me/messages",
          inputSchema: {
            type: "object",
            properties: {
              maxResults: { type: "integer", description: "Maximum number of messages to return (default 10, max 500)" },
              q: { type: "string", description: "Gmail search query (e.g., 'from:sender@example.com' or 'is:unread')" },
              labelIds: { type: "array", items: { type: "string" }, description: "Filter by label IDs" }
            }
          },
          queryParams: { maxResults: "{{maxResults}}", q: "{{q}}" }
        },
        {
          name: "get_gmail_message",
          displayName: "Get Gmail Message",
          description: "Get a specific Gmail message by ID",
          httpMethod: "GET",
          pathTemplate: "/gmail/v1/users/me/messages/{messageId}",
          inputSchema: {
            type: "object",
            properties: {
              messageId: { type: "string", description: "The ID of the message to retrieve" },
              format: { type: "string", enum: ["minimal", "full", "raw", "metadata"], description: "The format to return the message in" }
            },
            required: ["messageId"]
          },
          queryParams: { format: "{{format}}" }
        },
        {
          name: "send_gmail_message",
          displayName: "Send Gmail Message",
          description: "Send an email message via Gmail",
          httpMethod: "POST",
          pathTemplate: "/gmail/v1/users/me/messages/send",
          inputSchema: {
            type: "object",
            properties: {
              to: { type: "string", description: "Recipient email address" },
              subject: { type: "string", description: "Email subject" },
              body: { type: "string", description: "Email body (plain text)" }
            },
            required: ["to", "subject", "body"]
          },
          headers: { "Content-Type": "application/json" }
        },
        {
          name: "list_calendar_events",
          displayName: "List Calendar Events",
          description: "List events from the user's primary Google Calendar",
          httpMethod: "GET",
          pathTemplate: "/calendar/v3/calendars/primary/events",
          inputSchema: {
            type: "object",
            properties: {
              maxResults: { type: "integer", description: "Maximum number of events to return" },
              timeMin: { type: "string", description: "Start time filter (RFC3339 timestamp)" },
              timeMax: { type: "string", description: "End time filter (RFC3339 timestamp)" },
              singleEvents: { type: "boolean", description: "Whether to expand recurring events" }
            }
          },
          queryParams: { maxResults: "{{maxResults}}", timeMin: "{{timeMin}}", timeMax: "{{timeMax}}", singleEvents: "{{singleEvents}}" }
        },
        {
          name: "create_calendar_event",
          displayName: "Create Calendar Event",
          description: "Create a new event in the user's primary Google Calendar",
          httpMethod: "POST",
          pathTemplate: "/calendar/v3/calendars/primary/events",
          inputSchema: {
            type: "object",
            properties: {
              summary: { type: "string", description: "Event title" },
              description: { type: "string", description: "Event description" },
              location: { type: "string", description: "Event location" },
              startDateTime: { type: "string", description: "Start time (RFC3339 timestamp)" },
              endDateTime: { type: "string", description: "End time (RFC3339 timestamp)" },
              attendees: { type: "array", items: { type: "string" }, description: "List of attendee email addresses" }
            },
            required: ["summary", "startDateTime", "endDateTime"]
          },
          headers: { "Content-Type": "application/json" }
        },
        {
          name: "list_drive_files",
          displayName: "List Drive Files",
          description: "List files in the user's Google Drive",
          httpMethod: "GET",
          pathTemplate: "/drive/v3/files",
          inputSchema: {
            type: "object",
            properties: {
              pageSize: { type: "integer", description: "Maximum number of files to return (default 10, max 1000)" },
              q: { type: "string", description: "Search query (e.g., \"name contains 'report'\")" },
              orderBy: { type: "string", description: "Sort order (e.g., 'modifiedTime desc')" }
            }
          },
          queryParams: { pageSize: "{{pageSize}}", q: "{{q}}", orderBy: "{{orderBy}}" }
        }
      ]),
      // documentationUrls - Links to auto-fetch
      [
        "https://developers.google.com/gmail/api/reference/rest",
        "https://developers.google.com/calendar/api/v3/reference",
        "https://developers.google.com/drive/api/v3/reference"
      ]
    ]);
    results.push("Google Workspace template configured");

    await pool.end();

    return NextResponse.json({
      success: true,
      message: "Migration completed successfully",
      steps: results,
    });
  } catch (error) {
    console.error("Migration error:", error);
    await pool.end();
    return NextResponse.json(
      { success: false, error: String(error), completedSteps: results },
      { status: 500 }
    );
  }
}
