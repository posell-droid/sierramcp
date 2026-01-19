/**
 * Billing Service
 *
 * Handles Stripe integration for subscription and usage-based billing.
 *
 * ARCHITECTURE:
 * - Creates/updates Stripe customers for tenants
 * - Manages subscription lifecycle
 * - Reports usage for metered billing
 * - Handles webhook events from Stripe
 */

import Stripe from "stripe";
import { prisma } from "@repo/db";
import { getCurrentPeriodUsage } from "./metering";

// =============================================================================
// CONFIGURATION
// =============================================================================

// Lazy-initialized Stripe client (avoid initialization during build)
let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    if (!apiKey) {
      throw new Error("STRIPE_SECRET_KEY environment variable is not set");
    }
    stripeClient = new Stripe(apiKey);
  }
  return stripeClient;
}

// Stripe Price IDs (configured in Stripe dashboard)
const PRICE_IDS: Record<string, { monthly: string; metered?: string }> = {
  free: {
    monthly: process.env.STRIPE_PRICE_FREE || "price_free",
  },
  starter: {
    monthly: process.env.STRIPE_PRICE_STARTER || "price_starter",
    metered: process.env.STRIPE_PRICE_STARTER_METERED || "price_starter_metered",
  },
  professional: {
    monthly: process.env.STRIPE_PRICE_PROFESSIONAL || "price_professional",
    metered: process.env.STRIPE_PRICE_PROFESSIONAL_METERED || "price_professional_metered",
  },
  enterprise: {
    monthly: process.env.STRIPE_PRICE_ENTERPRISE || "price_enterprise",
    metered: process.env.STRIPE_PRICE_ENTERPRISE_METERED || "price_enterprise_metered",
  },
};

// =============================================================================
// TYPES
// =============================================================================

export interface CreateCustomerRequest {
  tenantId: string;
  email: string;
  name: string;
  metadata?: Record<string, string>;
}

export interface CreateSubscriptionRequest {
  tenantId: string;
  plan: string;
  paymentMethodId?: string;
}

export interface SubscriptionDetails {
  id: string;
  status: string;
  plan: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  usage?: {
    requests: number;
    tokens: number;
  };
}

export interface BillingPortalSession {
  url: string;
}

// =============================================================================
// CUSTOMER MANAGEMENT
// =============================================================================

/**
 * Create or get Stripe customer for a tenant
 */
export async function getOrCreateStripeCustomer(
  request: CreateCustomerRequest
): Promise<string> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: request.tenantId },
    select: { stripeCustomerId: true },
  });

  if (tenant?.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  // Create new Stripe customer
  const customer = await getStripe().customers.create({
    email: request.email,
    name: request.name,
    metadata: {
      tenantId: request.tenantId,
      ...request.metadata,
    },
  });

  // Update tenant with Stripe customer ID
  await prisma.tenant.update({
    where: { id: request.tenantId },
    data: { stripeCustomerId: customer.id },
  });

  console.log(`Created Stripe customer ${customer.id} for tenant ${request.tenantId}`);

  return customer.id;
}

/**
 * Update Stripe customer details
 */
export async function updateStripeCustomer(
  tenantId: string,
  updates: {
    email?: string;
    name?: string;
    address?: Stripe.AddressParam;
  }
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (!tenant?.stripeCustomerId) {
    throw new Error("Tenant has no Stripe customer");
  }

  await getStripe().customers.update(tenant.stripeCustomerId, updates);
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

/**
 * Create a new subscription for a tenant
 */
export async function createSubscription(
  request: CreateSubscriptionRequest
): Promise<SubscriptionDetails> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: request.tenantId },
    select: {
      stripeCustomerId: true,
      stripeSubscriptionId: true,
      name: true,
      billingContactEmail: true,
    },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Ensure customer exists
  const customerId = tenant.stripeCustomerId || await getOrCreateStripeCustomer({
    tenantId: request.tenantId,
    email: tenant.billingContactEmail || "",
    name: tenant.name,
  });

  // Cancel existing subscription if any
  if (tenant.stripeSubscriptionId) {
    try {
      await getStripe().subscriptions.cancel(tenant.stripeSubscriptionId);
    } catch (error) {
      console.warn("Failed to cancel existing subscription:", error);
    }
  }

  const prices = PRICE_IDS[request.plan] || PRICE_IDS.starter;

  // Build subscription items
  const items: Stripe.SubscriptionCreateParams.Item[] = [
    { price: prices.monthly },
  ];

  // Add metered component if available
  if (prices.metered) {
    items.push({ price: prices.metered });
  }

  // Create subscription
  const subscriptionParams: Stripe.SubscriptionCreateParams = {
    customer: customerId,
    items,
    payment_behavior: "default_incomplete",
    payment_settings: { save_default_payment_method: "on_subscription" },
    expand: ["latest_invoice.payment_intent"],
    metadata: {
      tenantId: request.tenantId,
      plan: request.plan,
    },
  };

  // Attach payment method if provided
  if (request.paymentMethodId) {
    await getStripe().paymentMethods.attach(request.paymentMethodId, {
      customer: customerId,
    });
    await getStripe().customers.update(customerId, {
      invoice_settings: { default_payment_method: request.paymentMethodId },
    });
  }

  const subscription = await getStripe().subscriptions.create(subscriptionParams);

  // Update tenant
  await prisma.tenant.update({
    where: { id: request.tenantId },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionPlan: request.plan,
      subscriptionStatus: subscription.status,
      billingStatus: subscription.status === "active" ? "ACTIVE" : "NOT_CONFIGURED",
    },
  });

  console.log(`Created subscription ${subscription.id} for tenant ${request.tenantId}`);

  // Access period dates from subscription object
  const periodStart = (subscription as unknown as { current_period_start: number }).current_period_start;
  const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

  return {
    id: subscription.id,
    status: subscription.status,
    plan: request.plan,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}

/**
 * Get subscription details for a tenant
 */
export async function getSubscription(
  tenantId: string
): Promise<SubscriptionDetails | null> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeSubscriptionId: true,
      subscriptionPlan: true,
    },
  });

  if (!tenant?.stripeSubscriptionId) {
    return null;
  }

  try {
    const subscription = await getStripe().subscriptions.retrieve(
      tenant.stripeSubscriptionId
    );

    // Get current period usage
    const usage = await getCurrentPeriodUsage(tenantId);

    // Access period dates from subscription object
    const periodStart = (subscription as unknown as { current_period_start: number }).current_period_start;
    const periodEnd = (subscription as unknown as { current_period_end: number }).current_period_end;

    return {
      id: subscription.id,
      status: subscription.status,
      plan: tenant.subscriptionPlan || "starter",
      currentPeriodStart: new Date(periodStart * 1000),
      currentPeriodEnd: new Date(periodEnd * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      usage: {
        requests: usage.totalRequests,
        tokens: usage.totalTokens,
      },
    };
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return null;
  }
}

/**
 * Cancel a subscription (at period end)
 */
export async function cancelSubscription(
  tenantId: string,
  immediately: boolean = false
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true },
  });

  if (!tenant?.stripeSubscriptionId) {
    throw new Error("No active subscription");
  }

  if (immediately) {
    await getStripe().subscriptions.cancel(tenant.stripeSubscriptionId);
    await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionStatus: "canceled",
        billingStatus: "NOT_CONFIGURED",
      },
    });
  } else {
    await getStripe().subscriptions.update(tenant.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
    await prisma.tenant.update({
      where: { id: tenantId },
      data: { subscriptionStatus: "canceling" },
    });
  }

  console.log(`Canceled subscription for tenant ${tenantId}`);
}

/**
 * Resume a canceled subscription (before period end)
 */
export async function resumeSubscription(tenantId: string): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true },
  });

  if (!tenant?.stripeSubscriptionId) {
    throw new Error("No active subscription");
  }

  await getStripe().subscriptions.update(tenant.stripeSubscriptionId, {
    cancel_at_period_end: false,
  });

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionStatus: "active" },
  });

  console.log(`Resumed subscription for tenant ${tenantId}`);
}

/**
 * Change subscription plan
 */
export async function changePlan(
  tenantId: string,
  newPlan: string
): Promise<SubscriptionDetails> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true },
  });

  if (!tenant?.stripeSubscriptionId) {
    throw new Error("No active subscription");
  }

  const subscription = await getStripe().subscriptions.retrieve(
    tenant.stripeSubscriptionId
  );

  const prices = PRICE_IDS[newPlan] || PRICE_IDS.starter;

  // Update subscription items
  const items: Stripe.SubscriptionUpdateParams.Item[] = [];

  // Find and update the base price item
  const baseItem = subscription.items.data.find(
    (item) => !item.price.recurring?.usage_type
  );
  if (baseItem) {
    items.push({
      id: baseItem.id,
      price: prices.monthly,
    });
  }

  // Find and update the metered price item
  const meteredItem = subscription.items.data.find(
    (item) => item.price.recurring?.usage_type === "metered"
  );
  if (meteredItem && prices.metered) {
    items.push({
      id: meteredItem.id,
      price: prices.metered,
    });
  } else if (!meteredItem && prices.metered) {
    items.push({ price: prices.metered });
  }

  const updated = await getStripe().subscriptions.update(
    tenant.stripeSubscriptionId,
    {
      items,
      proration_behavior: "create_prorations",
      metadata: { plan: newPlan },
    }
  );

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { subscriptionPlan: newPlan },
  });

  console.log(`Changed plan to ${newPlan} for tenant ${tenantId}`);

  // Access period dates from subscription object
  const periodStart = (updated as unknown as { current_period_start: number }).current_period_start;
  const periodEnd = (updated as unknown as { current_period_end: number }).current_period_end;

  return {
    id: updated.id,
    status: updated.status,
    plan: newPlan,
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: updated.cancel_at_period_end,
  };
}

// =============================================================================
// USAGE REPORTING (for metered billing)
// =============================================================================

/**
 * Report usage to Stripe for metered billing
 */
export async function reportUsage(
  tenantId: string,
  quantity: number,
  timestamp?: Date
): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeSubscriptionId: true },
  });

  if (!tenant?.stripeSubscriptionId) {
    console.warn(`Cannot report usage: tenant ${tenantId} has no subscription`);
    return;
  }

  try {
    const subscription = await getStripe().subscriptions.retrieve(
      tenant.stripeSubscriptionId
    );

    // Find the metered subscription item
    const meteredItem = subscription.items.data.find(
      (item) => item.price.recurring?.usage_type === "metered"
    );

    if (!meteredItem) {
      console.warn(`No metered item found for subscription ${subscription.id}`);
      return;
    }

    // Create usage record using billing meter events API (Stripe v20+)
    // For metered billing, we use the newer meter events API
    await getStripe().billing.meterEvents.create({
      event_name: "api_requests",
      payload: {
        value: String(quantity),
        stripe_customer_id: subscription.customer as string,
      },
      timestamp: timestamp ? Math.floor(timestamp.getTime() / 1000) : undefined,
    });

    console.log(`Reported ${quantity} units for tenant ${tenantId}`);
  } catch (error) {
    console.error("Failed to report usage:", error);
  }
}

/**
 * Report batch usage for all tenants (called by aggregation job)
 */
export async function reportAllTenantUsage(date: Date): Promise<{
  success: number;
  failed: number;
}> {
  // Get all tenants with active subscriptions
  const tenants = await prisma.tenant.findMany({
    where: {
      stripeSubscriptionId: { not: null },
      billingStatus: "ACTIVE",
    },
    select: { id: true },
  });

  let success = 0;
  let failed = 0;

  for (const tenant of tenants) {
    try {
      // Get usage for the date
      const startOfDay = new Date(date);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const aggregate = await prisma.usageAggregate.aggregate({
        where: {
          tenantId: tenant.id,
          date: {
            gte: startOfDay,
            lt: endOfDay,
          },
        },
        _sum: { totalRequests: true },
      });

      const requests = aggregate._sum.totalRequests || 0;
      if (requests > 0) {
        await reportUsage(tenant.id, requests, date);
        success++;
      }
    } catch (error) {
      console.error(`Failed to report usage for tenant ${tenant.id}:`, error);
      failed++;
    }
  }

  return { success, failed };
}

// =============================================================================
// BILLING PORTAL
// =============================================================================

/**
 * Create a billing portal session for customer self-service
 */
export async function createBillingPortalSession(
  tenantId: string,
  returnUrl: string
): Promise<BillingPortalSession> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { stripeCustomerId: true },
  });

  if (!tenant?.stripeCustomerId) {
    throw new Error("Tenant has no billing account");
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Create a checkout session for new subscription
 */
export async function createCheckoutSession(
  tenantId: string,
  plan: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ url: string; sessionId: string }> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      stripeCustomerId: true,
      name: true,
      billingContactEmail: true,
    },
  });

  if (!tenant) {
    throw new Error("Tenant not found");
  }

  // Ensure customer exists
  const customerId = tenant.stripeCustomerId || await getOrCreateStripeCustomer({
    tenantId,
    email: tenant.billingContactEmail || "",
    name: tenant.name,
  });

  const prices = PRICE_IDS[plan] || PRICE_IDS.starter;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: prices.monthly, quantity: 1 },
  ];

  if (prices.metered) {
    lineItems.push({ price: prices.metered });
  }

  const session = await getStripe().checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    subscription_data: {
      metadata: {
        tenantId,
        plan,
      },
    },
  });

  return {
    url: session.url || "",
    sessionId: session.id,
  };
}

// =============================================================================
// WEBHOOK HANDLERS
// =============================================================================

export type WebhookEventType =
  | "customer.subscription.created"
  | "customer.subscription.updated"
  | "customer.subscription.deleted"
  | "invoice.payment_succeeded"
  | "invoice.payment_failed"
  | "checkout.session.completed";

/**
 * Process Stripe webhook event
 */
export async function handleWebhookEvent(
  event: Stripe.Event
): Promise<{ handled: boolean; message: string }> {
  const eventType = event.type as WebhookEventType;

  switch (eventType) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata.tenantId;

      if (!tenantId) {
        return { handled: false, message: "No tenantId in metadata" };
      }

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeSubscriptionId: subscription.id,
          subscriptionStatus: subscription.status,
          subscriptionPlan: subscription.metadata.plan,
          billingStatus:
            subscription.status === "active" ? "ACTIVE" : "NOT_CONFIGURED",
        },
      });

      return { handled: true, message: `Updated subscription for ${tenantId}` };
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const tenantId = subscription.metadata.tenantId;

      if (!tenantId) {
        return { handled: false, message: "No tenantId in metadata" };
      }

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          subscriptionStatus: "canceled",
          billingStatus: "NOT_CONFIGURED",
        },
      });

      return { handled: true, message: `Canceled subscription for ${tenantId}` };
    }

    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      // Access subscription from invoice - may be string, object, or null
      const invoiceData = invoice as unknown as { subscription?: string | { id: string } | null };
      const subscriptionId = typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : invoiceData.subscription?.id;

      if (!subscriptionId) {
        return { handled: false, message: "No subscription on invoice" };
      }

      const tenant = await prisma.tenant.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (tenant) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { billingStatus: "ACTIVE" },
        });

        // Record audit log
        await prisma.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: "billing.payment_succeeded",
            entityType: "Invoice",
            entityId: invoice.id,
            metadata: {
              amount: invoice.amount_paid,
              currency: invoice.currency,
            },
          },
        });
      }

      return { handled: true, message: "Payment recorded" };
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      // Access subscription from invoice - may be string, object, or null
      const invoiceData = invoice as unknown as { subscription?: string | { id: string } | null };
      const subscriptionId = typeof invoiceData.subscription === 'string'
        ? invoiceData.subscription
        : invoiceData.subscription?.id;

      if (!subscriptionId) {
        return { handled: false, message: "No subscription on invoice" };
      }

      const tenant = await prisma.tenant.findFirst({
        where: { stripeSubscriptionId: subscriptionId },
      });

      if (tenant) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { billingStatus: "PAYMENT_FAILED" },
        });

        // Record audit log
        await prisma.auditLog.create({
          data: {
            tenantId: tenant.id,
            action: "billing.payment_failed",
            entityType: "Invoice",
            entityId: invoice.id,
            metadata: {
              amount: invoice.amount_due,
              currency: invoice.currency,
            },
          },
        });
      }

      return { handled: true, message: "Payment failure recorded" };
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const tenantId = session.metadata?.tenantId;
      const plan = session.metadata?.plan;

      if (!tenantId) {
        return { handled: false, message: "No tenantId in session metadata" };
      }

      // Access subscription from session - may be string, object, or null
      const sessionData = session as unknown as { subscription?: string | { id: string } | null };
      const subscriptionId = typeof sessionData.subscription === 'string'
        ? sessionData.subscription
        : sessionData.subscription?.id;

      await prisma.tenant.update({
        where: { id: tenantId },
        data: {
          stripeSubscriptionId: subscriptionId || null,
          subscriptionPlan: plan,
          subscriptionStatus: "active",
          billingStatus: "ACTIVE",
        },
      });

      return { handled: true, message: `Checkout completed for ${tenantId}` };
    }

    default:
      return { handled: false, message: `Unhandled event type: ${eventType}` };
  }
}

/**
 * Verify Stripe webhook signature
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET not configured");
  }

  return getStripe().webhooks.constructEvent(payload, signature, webhookSecret);
}
