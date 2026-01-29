/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "gatemcp",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
      providers: {
        aws: {
          region: "us-east-1",
        },
      },
    };
  },
  async run() {
    // ============================================
    // VPC & Networking
    // ============================================
    const vpc = new sst.aws.Vpc("Vpc", {
      bastion: true, // For database access during development
      nat: "managed",
    });

    // ============================================
    // Database (Aurora PostgreSQL Serverless v2)
    // ============================================
    const database = new sst.aws.Postgres("Database", {
      vpc,
      scaling: {
        min: "0.5 ACU",
        max: "4 ACU",
      },
      // Enable Data API for easier Lambda connectivity
      dataApi: true,
    });

    // ============================================
    // File Storage (S3)
    // ============================================
    const uploads = new sst.aws.Bucket("Uploads", {
      cors: {
        allowHeaders: ["*"],
        allowMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
        allowOrigins: ["*"], // Will be tightened in production
        maxAge: "1 day",
      },
      transform: {
        bucket: {
          // Block all public access - use signed URLs
          publicAccessBlock: {
            blockPublicAcls: true,
            blockPublicPolicy: true,
            ignorePublicAcls: true,
            restrictPublicBuckets: true,
          },
        },
      },
    });

    // ============================================
    // Background Jobs (SQS + Lambda)
    // ============================================
    const jobQueue = new sst.aws.Queue("JobQueue", {
      visibilityTimeout: "5 minutes",
    });

    jobQueue.subscribe("packages/functions/src/jobs/processor.handler", {
      link: [database],
      vpc,
    });

    // ============================================
    // OpenAI API Key (for embeddings)
    // ============================================
    const openaiApiKey = new sst.Secret("OpenaiApiKey");

    // ============================================
    // Anthropic API Key (for LLM - direct API, bypassing Bedrock)
    // ============================================
    const anthropicApiKey = new sst.Secret("AnthropicApiKey");

    // ============================================
    // Document Processing Queue (FIFO for deduplication)
    // ============================================
    // Uses OpenAI text-embedding-3-small for embeddings (1536 dimensions)
    // THROTTLING MITIGATIONS:
    // - FIFO queue with MessageGroupId=tenantId limits parallelism per tenant
    // - p-limit caps in-flight OpenAI calls per invocation
    // - Exponential backoff + jitter on rate limiting
    // - Chunk hash caching skips re-embedding identical content

    const documentQueue = new sst.aws.Queue("DocumentQueue", {
      visibilityTimeout: "15 minutes", // Must be >= Lambda timeout
      fifo: {
        contentBasedDeduplication: true,
      },
    });

    documentQueue.subscribe({
      handler: "packages/functions/src/jobs/document-processor/index.handler",
      link: [database, uploads, openaiApiKey],
      vpc,
      timeout: "15 minutes",  // Increased for crawling
      memory: "2048 MB",
      environment: {
        // Tell Prisma where to find the query engine binary
        PRISMA_QUERY_ENGINE_LIBRARY: "/var/task/libquery_engine-rhel-openssl-3.0.x.so.node",
        // OpenAI API key is accessed via Resource.OpenaiApiKey.value
        // Smart document processing configuration
        MAX_CRAWL_PAGES: "500",
        CRAWL_RATE_LIMIT: "2",  // requests per second
        DEFAULT_CRAWL_DEPTH: "2",
      },
      // Bundle Prisma for Lambda - don't externalize it
      nodejs: {
        esbuild: {
          // Don't externalize Prisma - bundle it
          external: [],
          // Copy the Prisma binaries
          loader: {
            ".node": "copy",
          },
        },
      },
      copyFiles: [
        // Copy Prisma engine binary
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    });

    // ============================================
    // ECS Cluster for MCP Deployments
    // ============================================
    // Note: ECS cluster and ALB are created here but managed by the deployment orchestrator.
    // The orchestrator creates ECS services, task definitions, and target groups dynamically.

    // ECS Cluster for MCP runtime containers
    const ecsCluster = new aws.ecs.Cluster("McpCluster", {
      name: `mcp-cluster-${$app.stage}`,
      settings: [
        {
          name: "containerInsights",
          value: "enabled",
        },
      ],
      tags: {
        Application: "SierraMCP",
        Stage: $app.stage,
      },
    });

    // Execution role for ECS tasks (pulls images, writes logs)
    const ecsExecutionRole = new aws.iam.Role("EcsExecutionRole", {
      name: `mcp-ecs-execution-${$app.stage}`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ecs-tasks.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
      ],
    });

    // Task role for MCP containers (access secrets, call APIs)
    const ecsTaskRole = new aws.iam.Role("EcsTaskRole", {
      name: `mcp-ecs-task-${$app.stage}`,
      assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Principal: { Service: "ecs-tasks.amazonaws.com" },
            Action: "sts:AssumeRole",
          },
        ],
      }),
    });

    // Allow task role to access secrets
    new aws.iam.RolePolicy("EcsTaskSecretsPolicy", {
      name: "secrets-access",
      role: ecsTaskRole.name,
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Effect: "Allow",
            Action: ["secretsmanager:GetSecretValue"],
            Resource: ["arn:aws:secretsmanager:*:*:secret:gatemcp/*"],
          },
        ],
      }),
    });

    // Security group for MCP containers
    const mcpSecurityGroup = new aws.ec2.SecurityGroup("McpSecurityGroup", {
      name: `mcp-containers-${$app.stage}`,
      description: "Security group for MCP runtime containers",
      vpcId: vpc.id,
      ingress: [
        {
          protocol: "tcp",
          fromPort: 8080,
          toPort: 8080,
          cidrBlocks: ["10.0.0.0/8"], // Allow from VPC
          description: "MCP HTTP port",
        },
      ],
      egress: [
        {
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          cidrBlocks: ["0.0.0.0/0"],
          description: "Allow all outbound",
        },
      ],
      tags: {
        Application: "SierraMCP",
      },
    });

    // ALB for MCP endpoints
    const mcpAlb = new aws.lb.LoadBalancer("McpAlb", {
      name: `mcp-alb-${$app.stage}`,
      internal: false,
      loadBalancerType: "application",
      securityGroups: [mcpSecurityGroup.id],
      subnets: vpc.publicSubnets,
      tags: {
        Application: "SierraMCP",
      },
    });

    // Default target group (for health checks and 404s)
    const defaultTargetGroup = new aws.lb.TargetGroup("McpDefaultTargetGroup", {
      name: `mcp-default-${$app.stage}`,
      port: 8080,
      protocol: "HTTP",
      targetType: "ip",
      vpcId: vpc.id,
      healthCheck: {
        path: "/health",
        healthyThreshold: 2,
        unhealthyThreshold: 3,
        timeout: 5,
        interval: 30,
      },
    });

    // HTTPS listener (requires certificate)
    const mcpListener = new aws.lb.Listener("McpListener", {
      loadBalancerArn: mcpAlb.arn,
      port: 443,
      protocol: "HTTPS",
      sslPolicy: "ELBSecurityPolicy-TLS13-1-2-2021-06",
      certificateArn:
        $app.stage === "production"
          ? "arn:aws:acm:us-east-1:950941368861:certificate/80684a17-96df-4bd9-9804-982522918d89"
          : undefined, // Use default cert for non-prod
      defaultActions: [
        {
          type: "fixed-response",
          fixedResponse: {
            contentType: "application/json",
            messageBody: '{"error":"Not Found"}',
            statusCode: "404",
          },
        },
      ],
    });

    // ============================================
    // Deployment Queue (FIFO for ordering)
    // ============================================
    const deploymentQueue = new sst.aws.Queue("DeploymentQueue", {
      visibilityTimeout: "10 minutes",
      fifo: {
        contentBasedDeduplication: false, // We provide dedup IDs
      },
    });

    deploymentQueue.subscribe({
      handler: "packages/functions/src/jobs/deployment-processor.handler",
      link: [database],
      vpc,
      timeout: "10 minutes",
      memory: "512 MB",
      permissions: [
        // ECS permissions
        {
          actions: [
            "ecs:CreateService",
            "ecs:UpdateService",
            "ecs:DeleteService",
            "ecs:DescribeServices",
            "ecs:RegisterTaskDefinition",
            "ecs:DeregisterTaskDefinition",
            "ecs:DescribeTaskDefinition",
            "ecs:ListTasks",
            "ecs:DescribeTasks",
          ],
          resources: ["*"],
        },
        // ELB permissions
        {
          actions: [
            "elasticloadbalancing:CreateTargetGroup",
            "elasticloadbalancing:DeleteTargetGroup",
            "elasticloadbalancing:DescribeTargetGroups",
            "elasticloadbalancing:DescribeTargetHealth",
            "elasticloadbalancing:CreateRule",
            "elasticloadbalancing:DeleteRule",
            "elasticloadbalancing:ModifyRule",
          ],
          resources: ["*"],
        },
        // CloudWatch Logs permissions
        {
          actions: [
            "logs:CreateLogGroup",
            "logs:PutRetentionPolicy",
          ],
          resources: ["*"],
        },
        // IAM pass role for ECS
        {
          actions: ["iam:PassRole"],
          resources: [ecsExecutionRole.arn, ecsTaskRole.arn],
        },
      ],
      environment: {
        ECS_CLUSTER_ARN: ecsCluster.arn,
        ALB_LISTENER_ARN: mcpListener.arn,
        VPC_ID: vpc.id,
        VPC_SUBNETS: vpc.privateSubnets.apply((subnets) => subnets.join(",")),
        VPC_SECURITY_GROUPS: mcpSecurityGroup.id,
        ECS_EXECUTION_ROLE_ARN: ecsExecutionRole.arn,
        ECS_TASK_ROLE_ARN: ecsTaskRole.arn,
        MCP_BASE_DOMAIN: $app.stage === "production" ? "mcp.sierramcp.com" : "mcp-dev.sierramcp.com",
      },
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    });

    // ============================================
    // Health Check Cron (every 5 minutes)
    // ============================================
    new sst.aws.Cron("DeploymentHealthCheck", {
      schedule: "rate(5 minutes)",
      job: {
        handler: "packages/functions/src/jobs/health-check-cron.handler",
        link: [database, deploymentQueue],
        vpc,
        timeout: "2 minutes",
        nodejs: {
          esbuild: {
            external: [],
            loader: { ".node": "copy" },
          },
        },
        copyFiles: [
          {
            from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
            to: "libquery_engine-rhel-openssl-3.0.x.so.node",
          },
          {
            from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
            to: "schema.prisma",
          },
        ],
        environment: {
          DEPLOYMENT_QUEUE_URL: deploymentQueue.url,
        },
      },
    });

    // ============================================
    // Authentication (Cognito)
    // ============================================
    const userPool = new sst.aws.CognitoUserPool("UserPool", {
      usernames: ["email"],
      triggers: {
        // Custom trigger to inject tenant_id into tokens
        preTokenGeneration: "packages/functions/src/auth/pre-token.handler",
      },
    });

    // Create client with localhost callbacks for now
    // Production callbacks can be added via AWS Console or updated config
    const userPoolClient = userPool.addClient("WebClient", {
      transform: {
        client: {
          explicitAuthFlows: [
            "ALLOW_USER_PASSWORD_AUTH",
            "ALLOW_REFRESH_TOKEN_AUTH",
            "ALLOW_USER_SRP_AUTH",
          ],
          supportedIdentityProviders: ["COGNITO"],
          callbackUrls: [
            "http://localhost:3000/api/auth/callback/cognito",
          ],
          logoutUrls: [
            "http://localhost:3000",
          ],
        },
      },
    });

    // ============================================
    // Next.js Application
    // ============================================
    // ============================================
    // WorkOS Secrets
    // ============================================
    const workosApiKey = new sst.Secret("WorkosApiKey");
    const workosClientId = new sst.Secret("WorkosClientId");
    const workosCookiePassword = new sst.Secret("WorkosCookiePassword");
    const workosRedirectUri = new sst.Secret("WorkosRedirectUri");
    const nextAuthSecret = new sst.Secret("NextAuthSecret");
    const nextAuthUrl = new sst.Secret("NextAuthUrl");

    // ============================================
    // Shopify OAuth Secrets
    // ============================================
    const shopifyClientId = new sst.Secret("ShopifyClientId");
    const shopifyClientSecret = new sst.Secret("ShopifyClientSecret");

    // ============================================
    // Amazon SP-API OAuth Secrets
    // ============================================
    const amazonClientId = new sst.Secret("AmazonClientId");
    const amazonClientSecret = new sst.Secret("AmazonClientSecret");

    const web = new sst.aws.Nextjs("Web", {
      path: "apps/web",
      vpc,
      link: [database, uploads, userPool, jobQueue, documentQueue, openaiApiKey, anthropicApiKey, workosApiKey, workosClientId, workosCookiePassword, workosRedirectUri, nextAuthSecret, nextAuthUrl, shopifyClientId, shopifyClientSecret, amazonClientId, amazonClientSecret],
      server: {
        timeout: "60 seconds", // Increased for LLM API calls
        memory: "1024 MB",
      },
      permissions: [
        // Secrets Manager permissions for storing application credentials
        {
          actions: [
            "secretsmanager:CreateSecret",
            "secretsmanager:UpdateSecret",
            "secretsmanager:DeleteSecret",
            "secretsmanager:GetSecretValue",
            "secretsmanager:TagResource",
          ],
          resources: ["arn:aws:secretsmanager:*:*:secret:gatemcp/*"],
        },
        // Bedrock permissions for LLM-powered tool generation
        {
          actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          resources: [
            // Foundation model (direct access)
            "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
            // Cross-region inference profile (required for on-demand throughput)
            "arn:aws:bedrock:us-east-1:950941368861:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            // Also allow the shorthand format
            "arn:aws:bedrock:*::foundation-model/anthropic.*",
          ],
        },
        // SES permissions for sending invitation emails
        {
          actions: ["ses:SendEmail", "ses:SendRawEmail"],
          resources: ["*"],
        },
      ],
      environment: {
        NEXT_PUBLIC_COGNITO_USER_POOL_ID: userPool.id,
        NEXT_PUBLIC_COGNITO_CLIENT_ID: userPoolClient.id,
        COGNITO_CLIENT_SECRET: userPoolClient.secret,
        DATABASE_URL: database.url,
        UPLOADS_BUCKET: uploads.name,
        // WorkOS
        WORKOS_API_KEY: workosApiKey.value,
        WORKOS_CLIENT_ID: workosClientId.value,
        WORKOS_COOKIE_PASSWORD: workosCookiePassword.value,
        WORKOS_REDIRECT_URI: workosRedirectUri.value,
        // NextAuth
        NEXTAUTH_SECRET: nextAuthSecret.value,
        NEXTAUTH_URL: nextAuthUrl.value,
        // Email (use web URL from deployment)
        NEXT_PUBLIC_APP_URL: $app.stage === "production"
          ? "https://app.sierramcp.com"
          : "http://localhost:3000",
        EMAIL_FROM: "noreply@sierramcp.com",
      },
      // Custom domain for production
      domain: $app.stage === "production"
        ? {
            name: "app.sierramcp.com",
            dns: sst.aws.dns({
              zone: "Z01458417KZZVV1XXX1R",
            }),
            cert: "arn:aws:acm:us-east-1:950941368861:certificate/80684a17-96df-4bd9-9804-982522918d89",
          }
        : undefined,
    });

    // ============================================
    // Landing Page (www.sierramcp.com)
    // ============================================
    const waitlist = new sst.aws.Dynamo("Waitlist", {
      fields: {
        email: "string",
      },
      primaryIndex: { hashKey: "email" },
    });

    const landing = new sst.aws.Nextjs("Landing", {
      path: "apps/landing",
      link: [waitlist],
      environment: {
        WAITLIST_TABLE_NAME: waitlist.name,
      },
      domain: $app.stage === "production"
        ? {
            name: "www.sierramcp.com",
            dns: sst.aws.dns({
              zone: "Z01458417KZZVV1XXX1R",
            }),
            cert: "arn:aws:acm:us-east-1:950941368861:certificate/80684a17-96df-4bd9-9804-982522918d89",
          }
        : undefined,
    });

    // ============================================
    // API (Optional standalone API Gateway)
    // ============================================
    const api = new sst.aws.ApiGatewayV2("Api", {
      vpc,
      link: [database, uploads, shopifyClientId, shopifyClientSecret, amazonClientId, amazonClientSecret],
      domain: $app.stage === "production"
        ? {
            name: "api.sierramcp.com",
            dns: sst.aws.dns({
              zone: "Z01458417KZZVV1XXX1R",
            }),
          }
        : undefined,
    });

    api.route("GET /health", "packages/functions/src/api/health.handler");

    // ============================================
    // MCP Runtime API Routes
    // ============================================
    const mcpRuntimeConfig = {
      link: [database],
      vpc,
      timeout: "60 seconds", // Longer timeout for tool invocations
      memory: "512 MB",
      permissions: [
        // Secrets Manager for retrieving credentials
        {
          actions: ["secretsmanager:GetSecretValue"],
          resources: ["arn:aws:secretsmanager:*:*:secret:sierramcp/*"],
        },
      ],
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    };

    // Tool invocation endpoint
    api.route("POST /mcp/invoke", "packages/functions/src/api/mcp-runtime-handler.handler", mcpRuntimeConfig);

    // Batch tool invocation endpoint
    api.route("POST /mcp/invoke/batch", "packages/functions/src/api/mcp-runtime-handler.handler", mcpRuntimeConfig);

    // List tools for a deployment
    api.route("GET /mcp/tools", "packages/functions/src/api/mcp-runtime-handler.handler", mcpRuntimeConfig);

    // SSE streaming endpoint
    api.route("POST /mcp/sse", "packages/functions/src/api/mcp-runtime-handler.handler", mcpRuntimeConfig);

    // MCP Runtime health check
    api.route("GET /mcp/health", "packages/functions/src/api/mcp-runtime-handler.healthHandler", mcpRuntimeConfig);

    // ============================================
    // Stripe Integration Secrets
    // ============================================
    const stripeSecretKey = new sst.Secret("StripeSecretKey");
    const stripeWebhookSecret = new sst.Secret("StripeWebhookSecret");

    // ============================================
    // Slack Integration Secrets
    // ============================================
    const slackSigningSecret = new sst.Secret("SlackSigningSecret");
    const slackBotToken = new sst.Secret("SlackBotToken");
    const slackClientId = new sst.Secret("SlackClientId");
    const slackClientSecret = new sst.Secret("SlackClientSecret");

    // ============================================
    // Slack Webhook Routes
    // ============================================
    const slackWebhookConfig = {
      link: [database, anthropicApiKey, slackSigningSecret, slackBotToken],
      vpc,
      timeout: "60 seconds", // Allow time for LLM + tool calls
      memory: "512 MB",
      environment: {
        SLACK_SIGNING_SECRET: slackSigningSecret.value,
        SLACK_BOT_TOKEN: slackBotToken.value,
        ANTHROPIC_API_KEY: anthropicApiKey.value,
      },
      permissions: [
        // Secrets Manager for retrieving credentials
        {
          actions: ["secretsmanager:GetSecretValue"],
          resources: ["arn:aws:secretsmanager:*:*:secret:sierramcp/*"],
        },
      ],
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    };

    // Slack Events API webhook
    api.route("POST /slack/events", "packages/functions/src/api/slack-webhook.handler", slackWebhookConfig);

    // Slack OAuth callback
    api.route("GET /slack/oauth", "packages/functions/src/api/slack-webhook.oauthHandler", {
      ...slackWebhookConfig,
      link: [database, slackClientId, slackClientSecret],
      environment: {
        SLACK_CLIENT_ID: slackClientId.value,
        SLACK_CLIENT_SECRET: slackClientSecret.value,
        NEXT_PUBLIC_APP_URL: $app.stage === "production"
          ? "https://app.sierramcp.com"
          : "http://localhost:3000",
      },
    });

    // ============================================
    // Stripe Webhook Route
    // ============================================
    const stripeWebhookConfig = {
      link: [database, stripeSecretKey, stripeWebhookSecret],
      vpc,
      timeout: "30 seconds",
      memory: "256 MB",
      environment: {
        STRIPE_SECRET_KEY: stripeSecretKey.value,
        STRIPE_WEBHOOK_SECRET: stripeWebhookSecret.value,
      },
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    };

    api.route("POST /stripe/webhook", "packages/functions/src/api/stripe-webhook.handler", stripeWebhookConfig);

    // ============================================
    // Shopify OAuth Callback Function
    // ============================================
    // Using standalone Function because api.route() doesn't apply route-level config properly
    const shopifyOAuthCallback = new sst.aws.Function("ShopifyOAuthCallback", {
      handler: "packages/functions/src/api/oauth/shopify-callback.handler",
      link: [database, shopifyClientId, shopifyClientSecret],
      vpc,
      timeout: "30 seconds",
      memory: "256 MB",
      permissions: [
        {
          actions: [
            "secretsmanager:CreateSecret",
            "secretsmanager:UpdateSecret",
            "secretsmanager:GetSecretValue",
            "secretsmanager:TagResource",
          ],
          resources: ["arn:aws:secretsmanager:*:*:secret:gatemcp/*"],
        },
      ],
      environment: {
        SHOPIFY_CLIENT_ID: shopifyClientId.value,
        SHOPIFY_CLIENT_SECRET: shopifyClientSecret.value,
        APP_URL: $app.stage === "production"
          ? "https://app.sierramcp.com"
          : "http://localhost:3000",
        PRISMA_QUERY_ENGINE_LIBRARY: "/var/task/libquery_engine-rhel-openssl-3.0.x.so.node",
      },
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    });

    api.route("GET /oauth/shopify/callback", shopifyOAuthCallback.arn);

    // ============================================
    // Amazon SP-API OAuth Callback Function
    // ============================================
    const amazonOAuthCallback = new sst.aws.Function("AmazonOAuthCallback", {
      handler: "packages/functions/src/api/oauth/amazon-callback.handler",
      link: [database, amazonClientId, amazonClientSecret],
      vpc,
      timeout: "30 seconds",
      memory: "256 MB",
      permissions: [
        {
          actions: [
            "secretsmanager:CreateSecret",
            "secretsmanager:UpdateSecret",
            "secretsmanager:GetSecretValue",
            "secretsmanager:TagResource",
          ],
          resources: ["arn:aws:secretsmanager:*:*:secret:gatemcp/*"],
        },
      ],
      environment: {
        AMAZON_CLIENT_ID: amazonClientId.value,
        AMAZON_CLIENT_SECRET: amazonClientSecret.value,
        APP_URL: $app.stage === "production"
          ? "https://app.sierramcp.com"
          : "http://localhost:3000",
        API_URL: $app.stage === "production"
          ? "https://api.sierramcp.com"
          : undefined,
        PRISMA_QUERY_ENGINE_LIBRARY: "/var/task/libquery_engine-rhel-openssl-3.0.x.so.node",
      },
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    });

    api.route("GET /oauth/amazon/callback", amazonOAuthCallback.arn);

    // ============================================
    // Metering Cron Jobs
    // ============================================
    const meteringConfig = {
      link: [database, stripeSecretKey],
      vpc,
      timeout: "5 minutes",
      memory: "512 MB",
      environment: {
        STRIPE_SECRET_KEY: stripeSecretKey.value,
      },
      nodejs: {
        esbuild: {
          external: [],
          loader: { ".node": "copy" },
        },
      },
      copyFiles: [
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/libquery_engine-rhel-openssl-3.0.x.so.node",
          to: "libquery_engine-rhel-openssl-3.0.x.so.node",
        },
        {
          from: "node_modules/.pnpm/@prisma+client@5.22.0_prisma@5.22.0/node_modules/.prisma/client/schema.prisma",
          to: "schema.prisma",
        },
      ],
    };

    // Usage aggregation - runs hourly
    new sst.aws.Cron("UsageAggregation", {
      schedule: "rate(1 hour)",
      job: {
        handler: "packages/functions/src/api/metering-handler.aggregateHandler",
        ...meteringConfig,
      },
    });

    // Usage reporting to Stripe - runs daily at 2 AM UTC
    new sst.aws.Cron("UsageReporting", {
      schedule: "cron(0 2 * * ? *)",
      job: {
        handler: "packages/functions/src/api/metering-handler.usageReportHandler",
        ...meteringConfig,
      },
    });

    api.route("$default", "packages/functions/src/api/trpc.handler", {
      link: [database, userPool],
      permissions: [
        // Bedrock permissions for LLM-powered tool generation
        {
          actions: ["bedrock:InvokeModel", "bedrock:InvokeModelWithResponseStream"],
          resources: [
            "arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-3-5-sonnet-20241022-v2:0",
            "arn:aws:bedrock:us-east-1:507041485944:inference-profile/us.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "arn:aws:bedrock:*::foundation-model/anthropic.*",
          ],
        },
      ],
    });

    // ============================================
    // Outputs
    // ============================================
    return {
      web: web.url,
      landing: landing.url,
      api: api.url,
      userPoolId: userPool.id,
      userPoolClientId: userPoolClient.id,
      databaseHost: database.host,
      uploadsBucket: uploads.name,
    };
  },
});
