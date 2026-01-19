/**
 * Deployment Queue Processor
 *
 * Lambda handler for processing deployment operations from SQS queue.
 * Handles async operations like:
 * - Provisioning new deployments
 * - Updating existing deployments
 * - Scaling deployments
 * - Stopping deployments
 * - Deleting deployments
 * - Health checks
 */

import type { SQSHandler, SQSEvent, SQSRecord } from "aws-lambda";
import { prisma } from "@repo/db";
import {
  provisionDeployment,
  updateDeployment,
  scaleDeployment,
  stopDeployment,
  deleteDeployment,
  checkDeploymentHealth,
  type DeploymentConfig,
} from "../services/deployment-orchestrator";

// =============================================================================
// TYPES
// =============================================================================

interface DeploymentMessage {
  type:
    | "PROVISION"
    | "UPDATE"
    | "SCALE"
    | "STOP"
    | "DELETE"
    | "HEALTH_CHECK"
    | "ROLLBACK";
  deploymentId: string;
  payload?: Record<string, unknown>;
  triggeredBy?: string;
}

// =============================================================================
// MESSAGE PROCESSING
// =============================================================================

async function processProvision(deploymentId: string): Promise<void> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      mcp: true,
      mcpVersion: true,
    },
  });

  if (!deployment) {
    console.error(`Deployment ${deploymentId} not found`);
    return;
  }

  if (deployment.status !== "PROVISIONING") {
    console.warn(`Deployment ${deploymentId} is not in PROVISIONING status, skipping`);
    return;
  }

  const config: DeploymentConfig = {
    deploymentId,
    tenantId: deployment.tenantId,
    mcpId: deployment.mcpId,
    mcpVersionId: deployment.mcpVersionId || undefined,
    name: deployment.name,
    environment: deployment.environment as "DEVELOPMENT" | "STAGING" | "PRODUCTION",
    computeProfile: deployment.computeProfile as "SMALL" | "MEDIUM" | "LARGE" | "XLARGE",
    minTasks: deployment.minTasks,
    maxTasks: deployment.maxTasks,
    desiredTasks: deployment.desiredTasks,
    configValues: (deployment.configValues as Record<string, unknown>) || {},
    healthCheckPath: deployment.healthCheckPath,
    imageUri: deployment.mcpVersion?.imageUri || undefined,
  };

  const result = await provisionDeployment(config);

  if (!result.success) {
    console.error(`Failed to provision deployment ${deploymentId}:`, result.error);
  }
}

async function processUpdate(
  deploymentId: string,
  payload?: Record<string, unknown>
): Promise<void> {
  const result = await updateDeployment(deploymentId, payload as Partial<DeploymentConfig>);

  if (!result.success) {
    console.error(`Failed to update deployment ${deploymentId}:`, result.error);
  }
}

async function processScale(deploymentId: string, desiredTasks: number): Promise<void> {
  const result = await scaleDeployment(deploymentId, desiredTasks);

  if (!result.success) {
    console.error(`Failed to scale deployment ${deploymentId}:`, result.error);
  }
}

async function processStop(deploymentId: string): Promise<void> {
  const result = await stopDeployment(deploymentId);

  if (!result.success) {
    console.error(`Failed to stop deployment ${deploymentId}:`, result.error);
  }
}

async function processDelete(deploymentId: string): Promise<void> {
  const result = await deleteDeployment(deploymentId);

  if (!result.success) {
    console.error(`Failed to delete deployment ${deploymentId}:`, result.error);
  }
}

async function processHealthCheck(deploymentId: string): Promise<void> {
  const result = await checkDeploymentHealth(deploymentId);
  console.log(`Health check for ${deploymentId}: ${result.health}`, result.details);
}

async function processRollback(
  deploymentId: string,
  mcpVersionId: string
): Promise<void> {
  const result = await updateDeployment(deploymentId, { mcpVersionId });

  if (!result.success) {
    console.error(`Failed to rollback deployment ${deploymentId}:`, result.error);
  }
}

// =============================================================================
// RECORD PROCESSING
// =============================================================================

async function processRecord(record: SQSRecord): Promise<void> {
  let message: DeploymentMessage;

  try {
    message = JSON.parse(record.body) as DeploymentMessage;
  } catch (error) {
    console.error("Failed to parse SQS message:", record.body);
    return;
  }

  console.log(`Processing ${message.type} for deployment ${message.deploymentId}`);

  switch (message.type) {
    case "PROVISION":
      await processProvision(message.deploymentId);
      break;

    case "UPDATE":
      await processUpdate(message.deploymentId, message.payload);
      break;

    case "SCALE":
      const desiredTasks = (message.payload?.desiredTasks as number) || 1;
      await processScale(message.deploymentId, desiredTasks);
      break;

    case "STOP":
      await processStop(message.deploymentId);
      break;

    case "DELETE":
      await processDelete(message.deploymentId);
      break;

    case "HEALTH_CHECK":
      await processHealthCheck(message.deploymentId);
      break;

    case "ROLLBACK":
      const mcpVersionId = message.payload?.mcpVersionId as string;
      if (mcpVersionId) {
        await processRollback(message.deploymentId, mcpVersionId);
      } else {
        console.error("ROLLBACK requires mcpVersionId in payload");
      }
      break;

    default:
      console.warn(`Unknown message type: ${message.type}`);
  }
}

// =============================================================================
// LAMBDA HANDLER
// =============================================================================

export const handler: SQSHandler = async (event: SQSEvent): Promise<void> => {
  console.log(`Processing ${event.Records.length} deployment messages`);

  const results = await Promise.allSettled(event.Records.map(processRecord));

  // Log any failures
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`Failed to process record ${index}:`, result.reason);
    }
  });

  // Count failures
  const failures = results.filter((r) => r.status === "rejected").length;
  if (failures > 0) {
    console.warn(`${failures} of ${event.Records.length} messages failed to process`);
  }
};

// =============================================================================
// HELPER: Queue Message Sender
// =============================================================================

import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const sqsClient = new SQSClient({ region: process.env.AWS_REGION || "us-east-1" });

/**
 * Send a deployment operation to the queue for async processing.
 * Call this from tRPC routers to trigger deployment operations.
 */
export async function queueDeploymentOperation(
  queueUrl: string,
  message: DeploymentMessage
): Promise<void> {
  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(message),
      MessageGroupId: message.deploymentId, // For FIFO queue
      MessageDeduplicationId: `${message.type}-${message.deploymentId}-${Date.now()}`,
    })
  );
}

/**
 * Queue a deployment provisioning operation.
 */
export async function queueProvision(
  queueUrl: string,
  deploymentId: string,
  triggeredBy?: string
): Promise<void> {
  await queueDeploymentOperation(queueUrl, {
    type: "PROVISION",
    deploymentId,
    triggeredBy,
  });
}

/**
 * Queue a deployment health check.
 */
export async function queueHealthCheck(
  queueUrl: string,
  deploymentId: string
): Promise<void> {
  await queueDeploymentOperation(queueUrl, {
    type: "HEALTH_CHECK",
    deploymentId,
  });
}
