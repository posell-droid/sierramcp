/**
 * Deployment Orchestrator Service
 *
 * Manages ECS Fargate deployments for MCP runtimes.
 * Handles:
 * - ECS task definition creation/updates
 * - ECS service management (create, update, scale)
 * - ALB target group and listener rule configuration
 * - Health check monitoring
 * - Deployment event logging
 *
 * ARCHITECTURE:
 * - Each tenant gets isolated ECS services
 * - ALB path-based routing: /mcp/{tenant}/{deployment}/...
 * - Task definitions are versioned per MCP version
 * - Auto-scaling based on deployment config
 */

import {
  ECSClient,
  CreateServiceCommand,
  UpdateServiceCommand,
  DeleteServiceCommand,
  DescribeServicesCommand,
  RegisterTaskDefinitionCommand,
  DeregisterTaskDefinitionCommand,
  DescribeTaskDefinitionCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  Compatibility,
  type Service,
  type TaskDefinition,
} from "@aws-sdk/client-ecs";

import {
  ElasticLoadBalancingV2Client,
  CreateTargetGroupCommand,
  DeleteTargetGroupCommand,
  CreateRuleCommand,
  DeleteRuleCommand,
  ModifyRuleCommand,
  DescribeTargetHealthCommand,
  DescribeTargetGroupsCommand,
  type TargetGroup,
} from "@aws-sdk/client-elastic-load-balancing-v2";

import {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand,
} from "@aws-sdk/client-cloudwatch-logs";

import { prisma, Prisma } from "@repo/db";

// =============================================================================
// CONFIGURATION
// =============================================================================

// These would typically come from SST Resource or environment variables
const AWS_REGION = process.env.AWS_REGION || "us-east-1";
const ECS_CLUSTER_ARN = process.env.ECS_CLUSTER_ARN || "";
const ALB_LISTENER_ARN = process.env.ALB_LISTENER_ARN || "";
const VPC_SUBNETS = (process.env.VPC_SUBNETS || "").split(",").filter(Boolean);
const VPC_SECURITY_GROUPS = (process.env.VPC_SECURITY_GROUPS || "").split(",").filter(Boolean);
const EXECUTION_ROLE_ARN = process.env.ECS_EXECUTION_ROLE_ARN || "";
const TASK_ROLE_ARN = process.env.ECS_TASK_ROLE_ARN || "";
const MCP_RUNTIME_IMAGE = process.env.MCP_RUNTIME_IMAGE || "";

// Compute profile mapping
const COMPUTE_PROFILES: Record<string, { cpu: string; memory: string }> = {
  SMALL: { cpu: "256", memory: "512" },
  MEDIUM: { cpu: "512", memory: "1024" },
  LARGE: { cpu: "1024", memory: "2048" },
  XLARGE: { cpu: "2048", memory: "4096" },
};

// =============================================================================
// AWS CLIENTS
// =============================================================================

const ecsClient = new ECSClient({ region: AWS_REGION });
const elbClient = new ElasticLoadBalancingV2Client({ region: AWS_REGION });
const logsClient = new CloudWatchLogsClient({ region: AWS_REGION });

// =============================================================================
// TYPES
// =============================================================================

export interface DeploymentConfig {
  deploymentId: string;
  tenantId: string;
  mcpId: string;
  mcpVersionId?: string;
  name: string;
  environment: "DEVELOPMENT" | "STAGING" | "PRODUCTION";
  computeProfile: "SMALL" | "MEDIUM" | "LARGE" | "XLARGE";
  minTasks: number;
  maxTasks: number;
  desiredTasks: number;
  configValues: Record<string, unknown>;
  healthCheckPath: string;
  imageUri?: string;
}

export interface DeploymentResult {
  success: boolean;
  endpointUrl?: string;
  ecsServiceArn?: string;
  taskDefinitionArn?: string;
  targetGroupArn?: string;
  error?: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function generateServiceName(tenantId: string, deploymentId: string): string {
  // Use short UUIDs to stay within AWS naming limits
  const shortTenant = tenantId.split("-")[0];
  const shortDeployment = deploymentId.split("-")[0];
  return `mcp-${shortTenant}-${shortDeployment}`;
}

function generateTaskDefFamily(tenantId: string, mcpId: string): string {
  const shortTenant = tenantId.split("-")[0];
  const shortMcp = mcpId.split("-")[0];
  return `mcp-task-${shortTenant}-${shortMcp}`;
}

function generateLogGroupName(tenantId: string, deploymentId: string): string {
  return `/ecs/mcp/${tenantId}/${deploymentId}`;
}

function generatePathPattern(tenantId: string, deploymentName: string): string {
  return `/mcp/${tenantId}/${deploymentName}/*`;
}

async function logDeploymentEvent(
  deploymentId: string,
  type: string,
  message: string,
  metadata: Record<string, unknown> = {},
  triggeredById?: string
): Promise<void> {
  try {
    await prisma.deploymentEvent.create({
      data: {
        deploymentId,
        type: type as never,
        message,
        metadata: metadata as Prisma.InputJsonValue,
        triggeredById,
      },
    });
  } catch (error) {
    console.error("Failed to log deployment event:", error);
  }
}

async function updateDeploymentStatus(
  deploymentId: string,
  status: string,
  updates: Record<string, unknown> = {}
): Promise<void> {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: {
      status: status as never,
      ...updates,
    },
  });
}

// =============================================================================
// CLOUDWATCH LOGS
// =============================================================================

async function ensureLogGroup(logGroupName: string): Promise<void> {
  try {
    await logsClient.send(
      new CreateLogGroupCommand({
        logGroupName,
        tags: {
          Application: "SierraMCP",
          Component: "MCPRuntime",
        },
      })
    );

    // Set retention to 30 days
    await logsClient.send(
      new PutRetentionPolicyCommand({
        logGroupName,
        retentionInDays: 30,
      })
    );
  } catch (error: unknown) {
    // Log group might already exist, which is fine
    if ((error as { name?: string })?.name !== "ResourceAlreadyExistsException") {
      throw error;
    }
  }
}

// =============================================================================
// ECS TASK DEFINITION
// =============================================================================

async function createTaskDefinition(config: DeploymentConfig): Promise<string> {
  const family = generateTaskDefFamily(config.tenantId, config.mcpId);
  const logGroupName = generateLogGroupName(config.tenantId, config.deploymentId);
  const compute = COMPUTE_PROFILES[config.computeProfile] || COMPUTE_PROFILES.SMALL;

  // Ensure log group exists
  await ensureLogGroup(logGroupName);

  // Build environment variables from config
  const environment = Object.entries(config.configValues).map(([name, value]) => ({
    name,
    value: String(value),
  }));

  // Add standard environment variables
  environment.push(
    { name: "MCP_DEPLOYMENT_ID", value: config.deploymentId },
    { name: "MCP_TENANT_ID", value: config.tenantId },
    { name: "MCP_ID", value: config.mcpId },
    { name: "MCP_ENVIRONMENT", value: config.environment },
    { name: "PORT", value: "8080" }
  );

  const imageUri = config.imageUri || MCP_RUNTIME_IMAGE;
  if (!imageUri) {
    throw new Error("No container image specified for deployment");
  }

  const response = await ecsClient.send(
    new RegisterTaskDefinitionCommand({
      family,
      networkMode: "awsvpc",
      requiresCompatibilities: [Compatibility.FARGATE],
      cpu: compute.cpu,
      memory: compute.memory,
      executionRoleArn: EXECUTION_ROLE_ARN,
      taskRoleArn: TASK_ROLE_ARN,
      containerDefinitions: [
        {
          name: "mcp-runtime",
          image: imageUri,
          essential: true,
          portMappings: [
            {
              containerPort: 8080,
              hostPort: 8080,
              protocol: "tcp",
            },
          ],
          environment,
          logConfiguration: {
            logDriver: "awslogs",
            options: {
              "awslogs-group": logGroupName,
              "awslogs-region": AWS_REGION,
              "awslogs-stream-prefix": "mcp",
            },
          },
          healthCheck: {
            command: ["CMD-SHELL", `curl -f http://localhost:8080${config.healthCheckPath} || exit 1`],
            interval: 30,
            timeout: 5,
            retries: 3,
            startPeriod: 60,
          },
        },
      ],
      tags: [
        { key: "Application", value: "SierraMCP" },
        { key: "TenantId", value: config.tenantId },
        { key: "DeploymentId", value: config.deploymentId },
        { key: "McpId", value: config.mcpId },
      ],
    })
  );

  const taskDefArn = response.taskDefinition?.taskDefinitionArn;
  if (!taskDefArn) {
    throw new Error("Failed to create task definition");
  }

  return taskDefArn;
}

// =============================================================================
// ALB TARGET GROUP
// =============================================================================

async function createTargetGroup(config: DeploymentConfig): Promise<string> {
  const targetGroupName = generateServiceName(config.tenantId, config.deploymentId);

  // Get VPC ID from subnets (would typically be passed in or derived)
  const vpcId = process.env.VPC_ID || "";

  const response = await elbClient.send(
    new CreateTargetGroupCommand({
      Name: targetGroupName,
      Protocol: "HTTP",
      Port: 8080,
      VpcId: vpcId,
      TargetType: "ip",
      HealthCheckPath: config.healthCheckPath,
      HealthCheckIntervalSeconds: 30,
      HealthCheckTimeoutSeconds: 5,
      HealthyThresholdCount: 2,
      UnhealthyThresholdCount: 3,
      Tags: [
        { Key: "Application", Value: "SierraMCP" },
        { Key: "TenantId", Value: config.tenantId },
        { Key: "DeploymentId", Value: config.deploymentId },
      ],
    })
  );

  const targetGroupArn = response.TargetGroups?.[0]?.TargetGroupArn;
  if (!targetGroupArn) {
    throw new Error("Failed to create target group");
  }

  return targetGroupArn;
}

async function createListenerRule(
  targetGroupArn: string,
  config: DeploymentConfig,
  priority: number
): Promise<string> {
  const pathPattern = generatePathPattern(config.tenantId, config.name);

  const response = await elbClient.send(
    new CreateRuleCommand({
      ListenerArn: ALB_LISTENER_ARN,
      Priority: priority,
      Conditions: [
        {
          Field: "path-pattern",
          Values: [pathPattern],
        },
      ],
      Actions: [
        {
          Type: "forward",
          TargetGroupArn: targetGroupArn,
        },
      ],
      Tags: [
        { Key: "Application", Value: "SierraMCP" },
        { Key: "DeploymentId", Value: config.deploymentId },
      ],
    })
  );

  const ruleArn = response.Rules?.[0]?.RuleArn;
  if (!ruleArn) {
    throw new Error("Failed to create listener rule");
  }

  return ruleArn;
}

// =============================================================================
// ECS SERVICE
// =============================================================================

async function createEcsService(
  taskDefinitionArn: string,
  targetGroupArn: string,
  config: DeploymentConfig
): Promise<string> {
  const serviceName = generateServiceName(config.tenantId, config.deploymentId);

  const response = await ecsClient.send(
    new CreateServiceCommand({
      cluster: ECS_CLUSTER_ARN,
      serviceName,
      taskDefinition: taskDefinitionArn,
      desiredCount: config.desiredTasks,
      launchType: "FARGATE",
      networkConfiguration: {
        awsvpcConfiguration: {
          subnets: VPC_SUBNETS,
          securityGroups: VPC_SECURITY_GROUPS,
          assignPublicIp: "DISABLED",
        },
      },
      loadBalancers: [
        {
          targetGroupArn,
          containerName: "mcp-runtime",
          containerPort: 8080,
        },
      ],
      healthCheckGracePeriodSeconds: 60,
      deploymentConfiguration: {
        minimumHealthyPercent: 50,
        maximumPercent: 200,
        deploymentCircuitBreaker: {
          enable: true,
          rollback: true,
        },
      },
      enableECSManagedTags: true,
      propagateTags: "TASK_DEFINITION",
      tags: [
        { key: "Application", value: "SierraMCP" },
        { key: "TenantId", value: config.tenantId },
        { key: "DeploymentId", value: config.deploymentId },
        { key: "Environment", value: config.environment },
      ],
    })
  );

  const serviceArn = response.service?.serviceArn;
  if (!serviceArn) {
    throw new Error("Failed to create ECS service");
  }

  return serviceArn;
}

async function updateEcsService(
  serviceArn: string,
  taskDefinitionArn: string,
  desiredCount: number
): Promise<void> {
  await ecsClient.send(
    new UpdateServiceCommand({
      cluster: ECS_CLUSTER_ARN,
      service: serviceArn,
      taskDefinition: taskDefinitionArn,
      desiredCount,
      forceNewDeployment: true,
    })
  );
}

async function scaleEcsService(serviceArn: string, desiredCount: number): Promise<void> {
  await ecsClient.send(
    new UpdateServiceCommand({
      cluster: ECS_CLUSTER_ARN,
      service: serviceArn,
      desiredCount,
    })
  );
}

async function deleteEcsService(serviceArn: string): Promise<void> {
  // First scale to 0
  await scaleEcsService(serviceArn, 0);

  // Then delete
  await ecsClient.send(
    new DeleteServiceCommand({
      cluster: ECS_CLUSTER_ARN,
      service: serviceArn,
      force: true,
    })
  );
}

// =============================================================================
// HEALTH MONITORING
// =============================================================================

async function checkServiceHealth(
  serviceArn: string,
  targetGroupArn: string
): Promise<{ healthy: boolean; runningTasks: number; healthyTargets: number }> {
  // Check ECS service status
  const serviceResponse = await ecsClient.send(
    new DescribeServicesCommand({
      cluster: ECS_CLUSTER_ARN,
      services: [serviceArn],
    })
  );

  const service = serviceResponse.services?.[0];
  const runningTasks = service?.runningCount || 0;

  // Check target group health
  const healthResponse = await elbClient.send(
    new DescribeTargetHealthCommand({
      TargetGroupArn: targetGroupArn,
    })
  );

  const healthyTargets =
    healthResponse.TargetHealthDescriptions?.filter(
      (t) => t.TargetHealth?.State === "healthy"
    ).length || 0;

  return {
    healthy: healthyTargets > 0,
    runningTasks,
    healthyTargets,
  };
}

// =============================================================================
// MAIN ORCHESTRATION FUNCTIONS
// =============================================================================

/**
 * Provision a new deployment (PROVISIONING -> DEPLOYING -> RUNNING)
 */
export async function provisionDeployment(config: DeploymentConfig): Promise<DeploymentResult> {
  const { deploymentId } = config;

  try {
    await logDeploymentEvent(deploymentId, "STARTED", "Starting deployment provisioning");

    // Step 1: Create task definition
    await logDeploymentEvent(deploymentId, "DEPLOYED", "Creating ECS task definition");
    const taskDefinitionArn = await createTaskDefinition(config);

    // Step 2: Create target group
    await logDeploymentEvent(deploymentId, "DEPLOYED", "Creating ALB target group");
    const targetGroupArn = await createTargetGroup(config);

    // Step 3: Create listener rule
    // Generate a priority based on deployment ID hash
    const priority = Math.abs(hashCode(deploymentId)) % 40000 + 10000; // Range 10000-50000
    await createListenerRule(targetGroupArn, config, priority);

    // Step 4: Update status to DEPLOYING
    await updateDeploymentStatus(deploymentId, "DEPLOYING", {
      taskDefinitionArn,
      targetGroupArn,
    });

    // Step 5: Create ECS service
    await logDeploymentEvent(deploymentId, "DEPLOYED", "Creating ECS service");
    const ecsServiceArn = await createEcsService(taskDefinitionArn, targetGroupArn, config);

    // Step 6: Generate endpoint URL
    const endpointUrl = generateEndpointUrl(config.tenantId, config.name);

    // Step 7: Update deployment with infrastructure details
    await updateDeploymentStatus(deploymentId, "RUNNING", {
      ecsServiceArn,
      taskDefinitionArn,
      targetGroupArn,
      endpointUrl,
      deployedAt: new Date(),
      health: "UNKNOWN",
    });

    await logDeploymentEvent(deploymentId, "DEPLOYED", "Deployment completed successfully", {
      endpointUrl,
      ecsServiceArn,
    });

    return {
      success: true,
      endpointUrl,
      ecsServiceArn,
      taskDefinitionArn,
      targetGroupArn,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logDeploymentEvent(deploymentId, "ERROR", `Deployment failed: ${errorMessage}`, {
      error: errorMessage,
    });

    await updateDeploymentStatus(deploymentId, "FAILED");

    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Update an existing deployment (new version, config changes)
 */
export async function updateDeployment(
  deploymentId: string,
  newConfig: Partial<DeploymentConfig>
): Promise<DeploymentResult> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { mcp: true, mcpVersion: true },
    });

    if (!deployment) {
      return { success: false, error: "Deployment not found" };
    }

    if (!deployment.ecsServiceArn) {
      return { success: false, error: "Deployment has no ECS service" };
    }

    await updateDeploymentStatus(deploymentId, "UPDATING");
    await logDeploymentEvent(deploymentId, "UPDATED", "Starting deployment update");

    // Merge existing config with updates
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
      ...newConfig,
    };

    // Create new task definition
    const taskDefinitionArn = await createTaskDefinition(config);

    // Update ECS service with new task definition
    await updateEcsService(deployment.ecsServiceArn, taskDefinitionArn, config.desiredTasks);

    await updateDeploymentStatus(deploymentId, "RUNNING", {
      taskDefinitionArn,
    });

    await logDeploymentEvent(deploymentId, "UPDATED", "Deployment update completed");

    return {
      success: true,
      taskDefinitionArn,
      ecsServiceArn: deployment.ecsServiceArn,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    await logDeploymentEvent(deploymentId, "ERROR", `Update failed: ${errorMessage}`);
    await updateDeploymentStatus(deploymentId, "FAILED");

    return { success: false, error: errorMessage };
  }
}

/**
 * Scale a deployment
 */
export async function scaleDeployment(
  deploymentId: string,
  desiredTasks: number
): Promise<DeploymentResult> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || !deployment.ecsServiceArn) {
      return { success: false, error: "Deployment not found or has no service" };
    }

    await updateDeploymentStatus(deploymentId, "SCALING");
    await logDeploymentEvent(deploymentId, "SCALED", `Scaling to ${desiredTasks} tasks`, {
      from: deployment.desiredTasks,
      to: desiredTasks,
    });

    await scaleEcsService(deployment.ecsServiceArn, desiredTasks);

    await updateDeploymentStatus(deploymentId, "RUNNING", {
      desiredTasks,
    });

    return { success: true, ecsServiceArn: deployment.ecsServiceArn };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    await updateDeploymentStatus(deploymentId, "FAILED");
    return { success: false, error: errorMessage };
  }
}

/**
 * Stop a deployment (drain and stop tasks)
 */
export async function stopDeployment(deploymentId: string): Promise<DeploymentResult> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || !deployment.ecsServiceArn) {
      return { success: false, error: "Deployment not found or has no service" };
    }

    await updateDeploymentStatus(deploymentId, "DRAINING");
    await logDeploymentEvent(deploymentId, "STOPPED", "Stopping deployment");

    // Scale to 0 to drain
    await scaleEcsService(deployment.ecsServiceArn, 0);

    await updateDeploymentStatus(deploymentId, "STOPPED", {
      desiredTasks: 0,
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete a deployment (remove all infrastructure)
 */
export async function deleteDeployment(deploymentId: string): Promise<DeploymentResult> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment) {
      return { success: false, error: "Deployment not found" };
    }

    await logDeploymentEvent(deploymentId, "DELETED", "Deleting deployment infrastructure");

    // Delete ECS service
    if (deployment.ecsServiceArn) {
      try {
        await deleteEcsService(deployment.ecsServiceArn);
      } catch {
        console.warn("Failed to delete ECS service, may already be deleted");
      }
    }

    // Delete target group (this will also remove the listener rule)
    if (deployment.targetGroupArn) {
      try {
        await elbClient.send(
          new DeleteTargetGroupCommand({
            TargetGroupArn: deployment.targetGroupArn,
          })
        );
      } catch {
        console.warn("Failed to delete target group, may already be deleted");
      }
    }

    // Mark as deleted in database (soft delete handled by router)
    await updateDeploymentStatus(deploymentId, "DELETED", {
      deletedAt: new Date(),
    });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
}

/**
 * Check and update deployment health
 */
export async function checkDeploymentHealth(deploymentId: string): Promise<{
  health: "UNKNOWN" | "HEALTHY" | "UNHEALTHY" | "DEGRADED";
  details: Record<string, unknown>;
}> {
  try {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || !deployment.ecsServiceArn || !deployment.targetGroupArn) {
      return { health: "UNKNOWN", details: { error: "Missing infrastructure" } };
    }

    const healthStatus = await checkServiceHealth(
      deployment.ecsServiceArn,
      deployment.targetGroupArn
    );

    let health: "UNKNOWN" | "HEALTHY" | "UNHEALTHY" | "DEGRADED";
    if (healthStatus.healthyTargets === 0) {
      health = "UNHEALTHY";
    } else if (healthStatus.healthyTargets < deployment.desiredTasks) {
      health = "DEGRADED";
    } else {
      health = "HEALTHY";
    }

    // Update deployment health status
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        health,
        lastHealthCheck: new Date(),
      },
    });

    await logDeploymentEvent(deploymentId, "HEALTH_CHECK", `Health: ${health}`, healthStatus);

    return { health, details: healthStatus };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { health: "UNKNOWN", details: { error: errorMessage } };
  }
}

// =============================================================================
// UTILITIES
// =============================================================================

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

function generateEndpointUrl(tenantId: string, deploymentName: string): string {
  // This would be configured based on your ALB domain
  const baseDomain = process.env.MCP_BASE_DOMAIN || "mcp.sierramcp.com";
  return `https://${baseDomain}/mcp/${tenantId}/${deploymentName}/sse`;
}
