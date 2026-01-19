# AWS Account Migration Plan - SierraMCP

## Overview

This document outlines the steps required to migrate the SierraMCP deployment from the current AWS account (`507041485944`) to a new AWS account.

---

## Pre-Migration Checklist

### New AWS Account Setup

- [ ] Create new AWS account
- [ ] Enable AWS Organizations (if using)
- [ ] Set up billing alerts
- [ ] Configure IAM Identity Center (SSO) or IAM users
- [ ] Install and configure AWS CLI with new account credentials

### Required AWS Services to Enable

- [ ] EC2 (VPC, Subnets, NAT Gateways)
- [ ] RDS (PostgreSQL with pgvector)
- [ ] ECS Fargate
- [ ] ECR (Elastic Container Registry)
- [ ] Lambda
- [ ] API Gateway
- [ ] CloudFront
- [ ] S3
- [ ] Secrets Manager
- [ ] ACM (Certificate Manager)
- [ ] Route53 (if transferring domain)
- [ ] CloudWatch
- [ ] Bedrock (for AI models)

### Service Quotas to Check

- [ ] VPC quota (default: 5 per region)
- [ ] Elastic IPs (default: 5 per region)
- [ ] NAT Gateways per AZ
- [ ] RDS instance limits
- [ ] Lambda concurrent executions
- [ ] ECS Fargate vCPU limits

---

## Account-Specific Values to Update

### File: `sst.config.ts`

| Current Value | Description | Action |
|--------------|-------------|--------|
| `507041485944` | AWS Account ID in Bedrock ARNs | Update to new account ID |
| `arn:aws:acm:us-east-1:507041485944:certificate/78f924c9-cb8c-494f-85e7-2209b948271c` | ACM Certificate for CloudFront | Create new certificate in new account |
| `Z05897153UVNHEM7B5DNL` | Route53 Hosted Zone ID | Create new hosted zone or transfer domain |

### Bedrock Model ARNs (lines 96-100)

```typescript
// Current (with old account ID)
const BEDROCK_MODEL_ARNS = [
  `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0`,
  `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-haiku-20240307-v1:0`,
  `arn:aws:bedrock:us-east-1:507041485944:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0`,
];
```

Update the inference profile ARN with new account ID.

### ACM Certificate (line 265)

```typescript
// Current
certificateArn: "arn:aws:acm:us-east-1:507041485944:certificate/78f924c9-cb8c-494f-85e7-2209b948271c",
```

Create new ACM certificate in new account for `*.sierramcp.com`.

### Route53 Hosted Zone (line 253)

```typescript
// Current
dns: sst.aws.dns({ zone: "Z05897153UVNHEM7B5DNL" }),
```

Update with new hosted zone ID.

---

## SST Secrets to Recreate

These secrets must be set in the new account before deployment:

```bash
# OpenAI (for embeddings)
npx sst secret set OpenaiApiKey "sk-..." --stage production

# Anthropic (for Claude)
npx sst secret set AnthropicApiKey "sk-ant-..." --stage production

# WorkOS (authentication)
npx sst secret set WorkosApiKey "sk_live_..." --stage production
npx sst secret set WorkosClientId "client_..." --stage production

# NextAuth
npx sst secret set NextAuthSecret "..." --stage production

# Stripe (billing)
npx sst secret set StripeSecretKey "sk_live_..." --stage production
npx sst secret set StripeWebhookSecret "whsec_..." --stage production

# Slack (notifications - if used)
npx sst secret set SlackBotToken "xoxb-..." --stage production
npx sst secret set SlackSigningSecret "..." --stage production

# GitHub (if used for deployments)
npx sst secret set GithubAppId "..." --stage production
npx sst secret set GithubAppPrivateKey "..." --stage production
```

**Important**: Collect all current secret values BEFORE migration. Some (like Stripe webhook secrets) will need to be regenerated for the new endpoint URL.

---

## Domain & DNS Options

### Option A: Transfer Domain to New Account (Recommended)

1. Request domain transfer in Route53 (current account)
2. Accept transfer in new account
3. Wait for propagation (can take 24-48 hours)
4. Create new hosted zone in new account
5. Update sst.config.ts with new hosted zone ID

### Option B: Keep Domain in Current Account

1. Keep Route53 hosted zone in current account
2. Manually add DNS records pointing to new account resources
3. Remove `dns` configuration from sst.config.ts
4. Manually configure CloudFront CNAME records

### Option C: Use External DNS (Cloudflare, etc.)

1. Transfer domain to external DNS provider
2. Point records to new AWS account resources
3. Remove Route53 configuration from SST

---

## Database Migration

### Current Database

- **Engine**: PostgreSQL with pgvector extension
- **Instance**: `gatemcp-production-databaseinstance-svuexfuk`
- **Database name**: `gatemcp`
- **Location**: Private VPC, accessed via bastion host

### Migration Steps

1. **Create snapshot in current account**
   ```bash
   aws rds create-db-snapshot \
     --db-instance-identifier gatemcp-production-databaseinstance-svuexfuk \
     --db-snapshot-identifier gatemcp-migration-snapshot
   ```

2. **Share snapshot with new account**
   ```bash
   aws rds modify-db-snapshot-attribute \
     --db-snapshot-identifier gatemcp-migration-snapshot \
     --attribute-name restore \
     --values-to-add NEW_ACCOUNT_ID
   ```

3. **Copy snapshot to new account** (from new account)
   ```bash
   aws rds copy-db-snapshot \
     --source-db-snapshot-identifier arn:aws:rds:us-east-1:507041485944:snapshot:gatemcp-migration-snapshot \
     --target-db-snapshot-identifier gatemcp-migration-snapshot
   ```

4. **Deploy SST first** (creates empty database)
   ```bash
   npx sst deploy --stage production
   ```

5. **Restore from snapshot** (if needed, or run migrations on fresh DB)

### Alternative: pg_dump/pg_restore

If data volume is small:

```bash
# Export from old account (via bastion)
pg_dump -h localhost -p 5433 -U admin -d gatemcp > gatemcp_backup.sql

# Import to new account (via new bastion)
psql -h localhost -p 5433 -U admin -d gatemcp < gatemcp_backup.sql
```

---

## S3 Bucket Migration

### Current Buckets

- **Uploads bucket**: User-uploaded files, documents for RAG

### Migration Steps

```bash
# Sync from old to new bucket
aws s3 sync s3://old-bucket-name s3://new-bucket-name --source-region us-east-1 --region us-east-1
```

Or use cross-account bucket policy to allow new account access, then sync.

---

## Secrets Manager Migration

### Current Secrets Pattern

- `gatemcp/*` - Application secrets
- `sierramcp/*` - MCP deployment credentials

### Migration

Secrets Manager secrets cannot be directly transferred. Export and recreate:

```bash
# List all secrets
aws secretsmanager list-secrets --query 'SecretList[*].Name'

# Get each secret value
aws secretsmanager get-secret-value --secret-id "secret-name" --query 'SecretString'

# Create in new account
aws secretsmanager create-secret --name "secret-name" --secret-string "value"
```

---

## Step-by-Step Migration Procedure

### Phase 1: Preparation (Current Account)

1. [ ] Document all current SST secret values
2. [ ] Create RDS snapshot
3. [ ] Export Secrets Manager secrets
4. [ ] Note all current resource ARNs and IDs
5. [ ] Test backup/restore procedures

### Phase 2: New Account Setup

1. [ ] Create and configure new AWS account
2. [ ] Install AWS CLI with new credentials
3. [ ] Request ACM certificate for `*.sierramcp.com`
4. [ ] Wait for certificate validation (requires DNS)
5. [ ] Set up Route53 hosted zone (if transferring domain)
6. [ ] Enable Bedrock model access (may require approval)

### Phase 3: Configuration Updates

1. [ ] Update `sst.config.ts`:
   - [ ] Update ACM certificate ARN
   - [ ] Update Route53 hosted zone ID
   - [ ] Update Bedrock inference profile ARN
2. [ ] Set all SST secrets in new account
3. [ ] Commit configuration changes (local branch)

### Phase 4: Initial Deployment

1. [ ] Run initial SST deploy (creates infrastructure)
   ```bash
   npx sst deploy --stage production
   ```
2. [ ] Verify all resources created successfully
3. [ ] Note new resource endpoints

### Phase 5: Data Migration

1. [ ] Set up bastion SSH tunnel to new database
2. [ ] Run Prisma migrations on new database
3. [ ] Import data from backup (if migrating existing data)
4. [ ] Sync S3 bucket contents
5. [ ] Recreate Secrets Manager secrets for MCP credentials

### Phase 6: DNS Cutover

1. [ ] Update DNS records to point to new CloudFront distribution
2. [ ] Wait for propagation (check with dig/nslookup)
3. [ ] Verify application accessible at new endpoints

### Phase 7: Verification

1. [ ] Test all application functionality
2. [ ] Verify authentication (WorkOS)
3. [ ] Verify billing (Stripe webhooks)
4. [ ] Test MCP deployments
5. [ ] Verify tool generation (OpenAI/Claude)
6. [ ] Check CloudWatch logs for errors

### Phase 8: Cleanup

1. [ ] Update Stripe webhook endpoint URL (if changed)
2. [ ] Update any external integrations
3. [ ] Monitor for 24-48 hours
4. [ ] Decommission old account resources (after verification period)

---

## Rollback Plan

If issues occur during migration:

1. **DNS Rollback**: Update DNS to point back to old CloudFront
2. **Keep Old Running**: Don't delete old resources until verified
3. **Database**: Old database remains untouched until cutover confirmed

---

## Estimated Timeline

| Phase | Duration |
|-------|----------|
| Preparation | 1-2 hours |
| New Account Setup | 2-4 hours (plus certificate validation wait) |
| ACM Certificate Validation | 15 min - 24 hours (depends on DNS) |
| Configuration Updates | 30 minutes |
| Initial Deployment | 15-30 minutes |
| Data Migration | 1-2 hours (depends on data volume) |
| DNS Cutover | 5 minutes (propagation: up to 48 hours) |
| Verification | 1-2 hours |

**Total**: 1-2 days (including DNS propagation wait times)

---

## Notes

- **Bedrock Access**: New accounts may need to request access to Claude models in Bedrock console
- **Service Limits**: New accounts have conservative default limits; request increases if needed
- **Stripe**: Webhook endpoint URL may change; update in Stripe Dashboard
- **WorkOS**: May need to update redirect URLs in WorkOS Dashboard
- **Cost Monitoring**: Set up billing alerts in new account immediately
