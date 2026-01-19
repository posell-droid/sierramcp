# SierraMCP Project Instructions

## Deployment

**Always use SST for deployments, not git.**

```bash
# Deploy to production
npx sst deploy --stage production

# Deploy to dev/staging
npx sst deploy --stage dev
```

Do NOT use git push for deployments. SST handles all infrastructure and code deployment.

## Database Access

The RDS database is in a private VPC and is not directly accessible.

**Important:** The database name is `gatemcp`, NOT `postgres`.

### Database Credentials

Credentials are stored in AWS Secrets Manager:
```bash
# Get database credentials
aws secretsmanager get-secret-value \
  --secret-id "gatemcp-production-DatabaseProxySecret-zzouendf" \
  --query 'SecretString' --output text
```

### Step 1: Find Bastion Instance

```bash
# Find bastion by SST tag (more reliable than name)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:sst:is-bastion,Values=true" "Name=tag:sst:app,Values=gatemcp" "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)

BASTION_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

AZ=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' --output text)

echo "Bastion: $INSTANCE_ID at $BASTION_IP ($AZ)"
```

### Step 2: Push SSH Key (valid for 60 seconds)

```bash
aws ec2-instance-connect send-ssh-public-key \
  --instance-id $INSTANCE_ID \
  --instance-os-user ec2-user \
  --ssh-public-key file://~/.ssh/id_ed25519.pub \
  --availability-zone $AZ
```

### Step 3: SSH with Port Forwarding

```bash
# RDS host (from SST outputs)
RDS_HOST="gatemcp-production-databaseinstance-bzdmuaez.cmz2wck4yag9.us-east-1.rds.amazonaws.com"

# Start tunnel (forward local 5433 to RDS 5432)
ssh -f -N -L 5433:$RDS_HOST:5432 ec2-user@$BASTION_IP
```

### Step 4: Run Database Commands

With the SSH tunnel active, get credentials and run commands:

```bash
cd packages/db

# Get credentials from Secrets Manager
DB_SECRET=$(aws secretsmanager get-secret-value \
  --secret-id "gatemcp-production-DatabaseProxySecret-zzouendf" \
  --query 'SecretString' --output text)

DB_USER=$(echo "$DB_SECRET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['username'])")
DB_PASS=$(echo "$DB_SECRET" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['password'])")

# IMPORTANT: Database name is "gatemcp", not "postgres"
export DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5433/gatemcp"

# Run migrations
npx prisma migrate deploy

# Or check migration status
npx prisma migrate status

# Or run a script
npx tsx your-script.ts
```

### Cleanup: Close SSH Tunnel

```bash
pkill -f "ssh.*5433"
```

## Project Structure

- `/packages/db` - Prisma schema and database queries
- `/packages/functions` - tRPC routers and Lambda functions
- `/packages/shared` - Shared types (ToolSpec, etc.)
- `/apps/web` - Next.js frontend

## SST Commands

```bash
# Start dev mode
npx sst dev

# Deploy
npx sst deploy --stage production

# Refresh state (fix stale resources)
npx sst refresh --stage production

# Open SST console
npx sst console

# Run command with SST env vars
npx sst shell --stage production -- <command>
```

## Stripe Configuration

Stripe keys are stored as SST secrets:

```bash
# Set Stripe keys (test/sandbox)
npx sst secret set StripeSecretKey sk_test_xxx --stage production
npx sst secret set StripeWebhookSecret whsec_xxx --stage production

# List current secrets
npx sst secret list --stage production
```

Webhook endpoint: `https://api.sierramcp.com/stripe/webhook`

Events to configure in Stripe Dashboard:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

## Common Issues

### "Column X does not exist"
The database schema is out of sync. Run migrations via bastion (see above).

### "Resource X is not linked"
Add the resource to the `link` array in `sst.config.ts` for the relevant function/web app.

### SST Deploy shows "RangeError: Invalid string length"
This is a known SST/Pulumi bug with error message formatting. **The deployment usually succeeds despite this error.** Check the output for "Updated" and "Created" lines to verify resources were deployed. The CloudFront invalidation (`WebInvalidation`) at the end indicates success.

### React Error #438 in Next.js App Router
In Next.js App Router, `params` is a plain object, NOT a Promise. Don't use `use(params)`:
```typescript
// WRONG - causes React Error #438
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)  // Error!
}

// CORRECT
export default function Page({ params }: { params: { id: string } }) {
  const { id } = params
}
```

### Stripe client initialization error during build
External API clients (Stripe, OpenAI, etc.) should be lazy-initialized to avoid "apiKey not provided" errors during Next.js build:
```typescript
// WRONG - initializes at module load (fails during build)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "")

// CORRECT - lazy initialization
let stripeClient: Stripe | null = null
function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return stripeClient
}
```

## Recent Implementations

### Metering & Billing (January 2026)
- **Metering Service** (`/packages/functions/src/services/metering.ts`): Aggregates UsageEvent records into daily UsageAggregate summaries
- **Billing Service** (`/packages/functions/src/services/billing.ts`): Stripe integration for subscriptions, metered billing, webhooks
- **Cron Jobs**: `UsageAggregation` (hourly), `UsageReporting` (daily at 2 AM UTC)
- **Database Tables**: `usage_events`, `usage_aggregates`

### MCP Management UI
- Create MCP: `/mcps/new` - Single-step form (name, type, description)
- MCP Detail pages: `/mcps/[id]/*` - Overview, Tools, Config, Deployments, Routes

## AWS Account Migration

See `AWS_MIGRATION_PLAN.md` for detailed migration instructions.

### Account-Specific Values in `sst.config.ts`

When migrating to a new AWS account, update these values:

| Value | Location | Description |
|-------|----------|-------------|
| `950941368861` | Bedrock ARNs | AWS Account ID |
| ACM Certificate ARN | line ~265 | SSL certificate for CloudFront |
| Route53 Hosted Zone ID | line ~253 | DNS zone for domain |

### SST Secrets Required

These must be set before deployment:
```bash
npx sst secret set OpenaiApiKey "..." --stage production
npx sst secret set AnthropicApiKey "..." --stage production
npx sst secret set WorkosApiKey "..." --stage production
npx sst secret set WorkosClientId "..." --stage production
npx sst secret set NextAuthSecret "..." --stage production
npx sst secret set StripeSecretKey "..." --stage production
npx sst secret set StripeWebhookSecret "..." --stage production
```

### Bedrock Model Access

New AWS accounts must request access to Claude models in the Bedrock console before deployment. Navigate to:
**AWS Console > Bedrock > Model access > Request access**
