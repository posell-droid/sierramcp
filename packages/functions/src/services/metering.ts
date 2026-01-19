/**
 * Metering Service
 *
 * Aggregates raw UsageEvent records into daily UsageAggregate summaries.
 * Designed to run as a scheduled Lambda (hourly or daily).
 *
 * ARCHITECTURE:
 * - Queries UsageEvent records for the aggregation window
 * - Groups by tenant, MCP, deployment, and date
 * - Upserts into UsageAggregate using atomic increment operations
 * - Marks processed events (via metadata.aggregated flag)
 */

import { prisma, Prisma } from "@repo/db";

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_LOOKBACK_HOURS = 2; // Process events from last 2 hours
const BATCH_SIZE = 1000; // Process events in batches

// =============================================================================
// TYPES
// =============================================================================

export interface AggregationResult {
  success: boolean;
  eventsProcessed: number;
  aggregatesUpdated: number;
  errors: string[];
  duration: number;
}

interface AggregationKey {
  tenantId: string;
  mcpId: string;
  deploymentId: string | null;
  date: Date;
}

interface AggregationMetrics {
  totalRequests: number;
  successCount: number;
  errorCount: number;
  totalLatencyMs: number;
  totalTokens: number;
}

// =============================================================================
// AGGREGATION LOGIC
// =============================================================================

/**
 * Aggregate usage events into daily summaries
 */
export async function aggregateUsageEvents(
  lookbackHours: number = DEFAULT_LOOKBACK_HOURS
): Promise<AggregationResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  // Calculate time window
  const endTime = new Date();
  const startTimeWindow = new Date(endTime.getTime() - lookbackHours * 60 * 60 * 1000);

  console.log(`Aggregating events from ${startTimeWindow.toISOString()} to ${endTime.toISOString()}`);

  try {
    // Fetch events that haven't been aggregated yet
    const events = await prisma.usageEvent.findMany({
      where: {
        timestamp: {
          gte: startTimeWindow,
          lte: endTime,
        },
        // Skip events already marked as aggregated
        NOT: {
          metadata: {
            path: ["aggregated"],
            equals: true,
          },
        },
      },
      take: BATCH_SIZE,
      orderBy: { timestamp: "asc" },
    });

    if (events.length === 0) {
      console.log("No new events to aggregate");
      return {
        success: true,
        eventsProcessed: 0,
        aggregatesUpdated: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    console.log(`Processing ${events.length} events`);

    // Group events by aggregation key
    const aggregations = new Map<string, AggregationMetrics>();
    const eventIds: string[] = [];

    for (const event of events) {
      eventIds.push(event.id);

      // Get date at midnight UTC
      const eventDate = new Date(event.timestamp);
      eventDate.setUTCHours(0, 0, 0, 0);

      // Build key
      const key = JSON.stringify({
        tenantId: event.tenantId,
        mcpId: event.mcpId,
        deploymentId: event.deploymentId,
        date: eventDate.toISOString(),
      });

      // Accumulate metrics
      const existing = aggregations.get(key) || {
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        totalLatencyMs: 0,
        totalTokens: 0,
      };

      existing.totalRequests += event.requestCount;
      existing.successCount += event.success ? event.requestCount : 0;
      existing.errorCount += event.success ? 0 : event.requestCount;
      existing.totalLatencyMs += event.latencyMs || 0;
      existing.totalTokens += event.tokenCount || 0;

      aggregations.set(key, existing);
    }

    console.log(`Aggregated into ${aggregations.size} buckets`);

    // Upsert aggregates using atomic operations
    let aggregatesUpdated = 0;

    for (const [keyStr, metrics] of Array.from(aggregations.entries())) {
      const key = JSON.parse(keyStr) as {
        tenantId: string;
        mcpId: string;
        deploymentId: string | null;
        date: string;
      };

      try {
        await prisma.usageAggregate.upsert({
          where: {
            tenantId_mcpId_deploymentId_date: {
              tenantId: key.tenantId,
              mcpId: key.mcpId,
              deploymentId: key.deploymentId || "",
              date: new Date(key.date),
            },
          },
          create: {
            tenantId: key.tenantId,
            mcpId: key.mcpId,
            deploymentId: key.deploymentId,
            date: new Date(key.date),
            totalRequests: metrics.totalRequests,
            successCount: metrics.successCount,
            errorCount: metrics.errorCount,
            totalLatencyMs: metrics.totalLatencyMs,
            totalTokens: metrics.totalTokens,
          },
          update: {
            totalRequests: { increment: metrics.totalRequests },
            successCount: { increment: metrics.successCount },
            errorCount: { increment: metrics.errorCount },
            totalLatencyMs: { increment: metrics.totalLatencyMs },
            totalTokens: { increment: metrics.totalTokens },
          },
        });
        aggregatesUpdated++;
      } catch (error) {
        const msg = `Failed to upsert aggregate for ${key.tenantId}/${key.mcpId}: ${error}`;
        console.error(msg);
        errors.push(msg);
      }
    }

    // Mark events as aggregated
    await prisma.usageEvent.updateMany({
      where: { id: { in: eventIds } },
      data: {
        metadata: {
          aggregated: true,
          aggregatedAt: new Date().toISOString(),
        },
      },
    });

    console.log(`Marked ${eventIds.length} events as aggregated`);

    return {
      success: errors.length === 0,
      eventsProcessed: events.length,
      aggregatesUpdated,
      errors,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    console.error("Aggregation failed:", error);
    return {
      success: false,
      eventsProcessed: 0,
      aggregatesUpdated: 0,
      errors: [error instanceof Error ? error.message : String(error)],
      duration: Date.now() - startTime,
    };
  }
}

// =============================================================================
// USAGE QUERIES
// =============================================================================

export interface UsageSummary {
  tenantId: string;
  period: {
    start: Date;
    end: Date;
  };
  totals: {
    requests: number;
    successRate: number;
    avgLatencyMs: number;
    tokens: number;
  };
  byMcp: {
    mcpId: string;
    mcpName: string;
    requests: number;
    successRate: number;
    avgLatencyMs: number;
    tokens: number;
  }[];
  byDeployment: {
    deploymentId: string;
    deploymentName: string;
    environment: string;
    requests: number;
    successRate: number;
  }[];
  dailyBreakdown: {
    date: Date;
    requests: number;
    successCount: number;
    errorCount: number;
  }[];
}

/**
 * Get usage summary for a tenant
 */
export async function getTenantUsageSummary(
  tenantId: string,
  startDate: Date,
  endDate: Date
): Promise<UsageSummary> {
  // Fetch aggregates for the period
  const aggregates = await prisma.usageAggregate.findMany({
    where: {
      tenantId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      mcp: { select: { id: true, name: true } },
      deployment: { select: { id: true, name: true, environment: true } },
    },
    orderBy: { date: "asc" },
  });

  // Calculate totals
  let totalRequests = 0;
  let totalSuccess = 0;
  let totalLatency = 0;
  let totalTokens = 0;

  const mcpMetrics = new Map<string, {
    mcpId: string;
    mcpName: string;
    requests: number;
    success: number;
    latency: number;
    tokens: number;
  }>();

  const deploymentMetrics = new Map<string, {
    deploymentId: string;
    deploymentName: string;
    environment: string;
    requests: number;
    success: number;
  }>();

  const dailyMetrics = new Map<string, {
    date: Date;
    requests: number;
    successCount: number;
    errorCount: number;
  }>();

  for (const agg of aggregates) {
    totalRequests += agg.totalRequests;
    totalSuccess += agg.successCount;
    totalLatency += agg.totalLatencyMs;
    totalTokens += agg.totalTokens;

    // MCP breakdown
    const mcpKey = agg.mcpId;
    const existing = mcpMetrics.get(mcpKey) || {
      mcpId: agg.mcpId,
      mcpName: agg.mcp.name,
      requests: 0,
      success: 0,
      latency: 0,
      tokens: 0,
    };
    existing.requests += agg.totalRequests;
    existing.success += agg.successCount;
    existing.latency += agg.totalLatencyMs;
    existing.tokens += agg.totalTokens;
    mcpMetrics.set(mcpKey, existing);

    // Deployment breakdown
    if (agg.deploymentId && agg.deployment) {
      const deplKey = agg.deploymentId;
      const deplExisting = deploymentMetrics.get(deplKey) || {
        deploymentId: agg.deploymentId,
        deploymentName: agg.deployment.name,
        environment: agg.deployment.environment,
        requests: 0,
        success: 0,
      };
      deplExisting.requests += agg.totalRequests;
      deplExisting.success += agg.successCount;
      deploymentMetrics.set(deplKey, deplExisting);
    }

    // Daily breakdown
    const dateKey = agg.date.toISOString().split("T")[0];
    const dayExisting = dailyMetrics.get(dateKey) || {
      date: agg.date,
      requests: 0,
      successCount: 0,
      errorCount: 0,
    };
    dayExisting.requests += agg.totalRequests;
    dayExisting.successCount += agg.successCount;
    dayExisting.errorCount += agg.errorCount;
    dailyMetrics.set(dateKey, dayExisting);
  }

  return {
    tenantId,
    period: { start: startDate, end: endDate },
    totals: {
      requests: totalRequests,
      successRate: totalRequests > 0 ? totalSuccess / totalRequests : 0,
      avgLatencyMs: totalRequests > 0 ? totalLatency / totalRequests : 0,
      tokens: totalTokens,
    },
    byMcp: Array.from(mcpMetrics.values()).map((m) => ({
      mcpId: m.mcpId,
      mcpName: m.mcpName,
      requests: m.requests,
      successRate: m.requests > 0 ? m.success / m.requests : 0,
      avgLatencyMs: m.requests > 0 ? m.latency / m.requests : 0,
      tokens: m.tokens,
    })),
    byDeployment: Array.from(deploymentMetrics.values()).map((d) => ({
      deploymentId: d.deploymentId,
      deploymentName: d.deploymentName,
      environment: d.environment,
      requests: d.requests,
      successRate: d.requests > 0 ? d.success / d.requests : 0,
    })),
    dailyBreakdown: Array.from(dailyMetrics.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    ),
  };
}

/**
 * Get current billing period usage for a tenant
 */
export async function getCurrentPeriodUsage(tenantId: string): Promise<{
  periodStart: Date;
  periodEnd: Date;
  totalRequests: number;
  totalTokens: number;
  estimatedCost: number;
}> {
  // Get tenant to determine billing cycle
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      subscriptionPlan: true,
      stripeSubscriptionId: true,
      createdAt: true,
    },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Calculate current billing period (monthly, starting on signup date)
  const now = new Date();
  const signupDay = tenant.createdAt.getUTCDate();

  let periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth(), signupDay);
  if (periodStart > now) {
    periodStart = new Date(now.getUTCFullYear(), now.getUTCMonth() - 1, signupDay);
  }

  const periodEnd = new Date(periodStart);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  // Get aggregated usage for the period
  const aggregates = await prisma.usageAggregate.aggregate({
    where: {
      tenantId,
      date: {
        gte: periodStart,
        lt: periodEnd,
      },
    },
    _sum: {
      totalRequests: true,
      totalTokens: true,
    },
  });

  const totalRequests = aggregates._sum.totalRequests || 0;
  const totalTokens = aggregates._sum.totalTokens || 0;

  // Calculate estimated cost based on plan
  const estimatedCost = calculateCost(
    tenant.subscriptionPlan || "starter",
    totalRequests,
    totalTokens
  );

  return {
    periodStart,
    periodEnd,
    totalRequests,
    totalTokens,
    estimatedCost,
  };
}

// =============================================================================
// COST CALCULATION
// =============================================================================

interface PricingTier {
  name: string;
  basePrice: number; // Monthly base price in cents
  includedRequests: number;
  includedTokens: number;
  requestOverageRate: number; // Cents per 1000 requests
  tokenOverageRate: number; // Cents per 1M tokens
}

const PRICING_TIERS: Record<string, PricingTier> = {
  free: {
    name: "Free",
    basePrice: 0,
    includedRequests: 1000,
    includedTokens: 100000,
    requestOverageRate: 0, // No overages allowed on free
    tokenOverageRate: 0,
  },
  starter: {
    name: "Starter",
    basePrice: 4900, // $49/month
    includedRequests: 10000,
    includedTokens: 1000000,
    requestOverageRate: 50, // $0.50 per 1000 requests
    tokenOverageRate: 100, // $1.00 per 1M tokens
  },
  professional: {
    name: "Professional",
    basePrice: 19900, // $199/month
    includedRequests: 100000,
    includedTokens: 10000000,
    requestOverageRate: 30, // $0.30 per 1000 requests
    tokenOverageRate: 80, // $0.80 per 1M tokens
  },
  enterprise: {
    name: "Enterprise",
    basePrice: 99900, // $999/month
    includedRequests: 1000000,
    includedTokens: 100000000,
    requestOverageRate: 10, // $0.10 per 1000 requests
    tokenOverageRate: 50, // $0.50 per 1M tokens
  },
};

/**
 * Calculate cost for a billing period
 */
function calculateCost(
  plan: string,
  totalRequests: number,
  totalTokens: number
): number {
  const tier = PRICING_TIERS[plan] || PRICING_TIERS.starter;

  let cost = tier.basePrice;

  // Request overages
  const requestOverage = Math.max(0, totalRequests - tier.includedRequests);
  if (requestOverage > 0 && tier.requestOverageRate > 0) {
    cost += Math.ceil(requestOverage / 1000) * tier.requestOverageRate;
  }

  // Token overages
  const tokenOverage = Math.max(0, totalTokens - tier.includedTokens);
  if (tokenOverage > 0 && tier.tokenOverageRate > 0) {
    cost += Math.ceil(tokenOverage / 1000000) * tier.tokenOverageRate;
  }

  return cost;
}

/**
 * Get pricing tier details
 */
export function getPricingTiers(): PricingTier[] {
  return Object.values(PRICING_TIERS);
}
