# GateMCP

A multi-tenant MCP (Model Context Protocol) gateway application built on AWS using SST, Next.js, and PostgreSQL.

## Project Structure

```
gatemcp/
├── sst.config.ts                 # SST infrastructure configuration
├── package.json
├── tsconfig.json
│
├── packages/
│   ├── core/                     # Shared business logic & utilities
│   │   ├── src/
│   │   │   ├── tenant/           # Multi-tenancy primitives
│   │   │   │   ├── context.ts    # Tenant context management
│   │   │   │   └── middleware.ts # Tenant extraction middleware
│   │   │   ├── auth/             # Authentication utilities
│   │   │   └── db/               # Database client & utilities
│   │   └── package.json
│   │
│   ├── functions/                # Lambda functions
│   │   ├── src/
│   │   │   ├── api/              # API handlers
│   │   │   └── jobs/             # Background job handlers
│   │   └── package.json
│   │
│   └── db/                       # Database package
│       ├── prisma/
│       │   ├── schema.prisma     # Prisma schema with multi-tenancy
│       │   └── migrations/
│       └── package.json
│
├── apps/
│   └── web/                      # Next.js frontend
│       ├── app/                  # App Router
│       │   ├── (auth)/           # Auth routes (login, signup)
│       │   ├── (dashboard)/      # Authenticated routes
│       │   │   ├── layout.tsx    # Dashboard layout with sidebar
│       │   │   ├── page.tsx      # Dashboard home
│       │   │   ├── settings/     # Tenant settings
│       │   │   └── users/        # User management
│       │   ├── api/              # API routes (tRPC)
│       │   └── layout.tsx        # Root layout
│       ├── components/           # React components
│       ├── lib/                  # Frontend utilities
│       └── package.json
│
├── infra/                        # Additional infrastructure
│   ├── dns.ts                    # DNS & certificates
│   ├── database.ts               # RDS configuration
│   ├── auth.ts                   # Cognito configuration
│   └── storage.ts                # S3 buckets
│
└── scripts/                      # Development & deployment scripts
    ├── seed.ts                   # Database seeding
    └── migrate.ts                # Migration runner
```

## Key Features

- **Multi-Tenancy**: Row-level security with tenant context propagation
- **Authentication**: AWS Cognito with custom tenant claims
- **Type Safety**: End-to-end TypeScript with tRPC
- **Infrastructure as Code**: SST v3 with AWS CDK
- **Database**: Aurora PostgreSQL Serverless v2 with Prisma

## Getting Started

```bash
# Install dependencies
pnpm install

# Start local development
pnpm dev

# Deploy to AWS
pnpm sst deploy --stage dev
```

## Environment Variables

Create a `.env` file in the root:

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="your-secret"
COGNITO_CLIENT_ID="..."
COGNITO_CLIENT_SECRET="..."
COGNITO_ISSUER="https://cognito-idp.{region}.amazonaws.com/{poolId}"
```
