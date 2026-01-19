-- CreateTable
CREATE TABLE "blocked_signups" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "workosId" TEXT,
    "reason" TEXT NOT NULL,
    "name" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_signups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blocked_signups_email_idx" ON "blocked_signups"("email");

-- CreateIndex
CREATE INDEX "blocked_signups_domain_idx" ON "blocked_signups"("domain");

-- CreateIndex
CREATE INDEX "blocked_signups_createdAt_idx" ON "blocked_signups"("createdAt");
