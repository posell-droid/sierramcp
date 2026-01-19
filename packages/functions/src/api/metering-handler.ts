/**
 * Metering Handler
 *
 * Scheduled Lambda for aggregating usage events into daily summaries.
 * Triggered by EventBridge schedule (hourly).
 */

import type { ScheduledEvent, Handler } from "aws-lambda";
import { aggregateUsageEvents } from "../services/metering";
import { reportAllTenantUsage } from "../services/billing";

/**
 * Aggregation handler - runs hourly
 */
export const aggregateHandler: Handler<ScheduledEvent, void> = async (event) => {
  console.log("Starting usage aggregation", { event });

  try {
    // Aggregate usage events from the last 2 hours
    const result = await aggregateUsageEvents(2);

    console.log("Aggregation complete", {
      eventsProcessed: result.eventsProcessed,
      aggregatesUpdated: result.aggregatesUpdated,
      duration: result.duration,
      errors: result.errors.length,
    });

    if (result.errors.length > 0) {
      console.error("Aggregation errors:", result.errors);
    }
  } catch (error) {
    console.error("Aggregation failed:", error);
    throw error;
  }
};

/**
 * Usage reporting handler - runs daily
 * Reports usage to Stripe for metered billing
 */
export const usageReportHandler: Handler<ScheduledEvent, void> = async (event) => {
  console.log("Starting usage reporting to Stripe", { event });

  try {
    // Report yesterday's usage
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setUTCHours(0, 0, 0, 0);

    const result = await reportAllTenantUsage(yesterday);

    console.log("Usage reporting complete", {
      success: result.success,
      failed: result.failed,
      date: yesterday.toISOString(),
    });
  } catch (error) {
    console.error("Usage reporting failed:", error);
    throw error;
  }
};
