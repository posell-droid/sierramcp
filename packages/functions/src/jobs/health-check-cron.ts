/**
 * Deployment Health Check Cron
 *
 * Runs every 5 minutes to check the health of all running deployments.
 * Queues health check operations to the deployment queue.
 */

import type { Handler } from "aws-lambda";
import { prisma } from "@repo/db";
import { queueHealthCheck } from "./deployment-processor";
import { Resource } from "sst";

// Get queue URL from SST resources
function getDeploymentQueueUrl(): string {
  const resource = Resource as unknown as { DeploymentQueue?: { url: string } };
  if (!resource.DeploymentQueue?.url) {
    throw new Error("Deployment queue URL not configured");
  }
  return resource.DeploymentQueue.url;
}

export const handler: Handler = async () => {
  console.log("Starting deployment health check cron");

  try {
    // Find all running deployments that need health checks
    const deployments = await prisma.deployment.findMany({
      where: {
        status: "RUNNING",
        deletedAt: null,
        // Only check deployments that have been running for at least 2 minutes
        deployedAt: {
          lt: new Date(Date.now() - 2 * 60 * 1000),
        },
      },
      select: {
        id: true,
        name: true,
        tenantId: true,
        lastHealthCheck: true,
      },
    });

    console.log(`Found ${deployments.length} running deployments to check`);

    if (deployments.length === 0) {
      return { checked: 0 };
    }

    const queueUrl = getDeploymentQueueUrl();

    // Queue health checks for each deployment
    const results = await Promise.allSettled(
      deployments.map((d) => queueHealthCheck(queueUrl, d.id))
    );

    const queued = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`Queued ${queued} health checks, ${failed} failed to queue`);

    return {
      checked: deployments.length,
      queued,
      failed,
    };
  } catch (error) {
    console.error("Health check cron failed:", error);
    throw error;
  }
};
