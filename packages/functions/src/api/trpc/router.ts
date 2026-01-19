import { router } from "./trpc";
import { authRouter } from "./routers/auth";
import { mcpsRouter } from "./routers/mcps";
import { usersRouter } from "./routers/users";
import { tenantRouter } from "./routers/tenant";
import { applicationsRouter } from "./routers/applications";
import { documentsRouter } from "./routers/documents";
import { toolsRouter } from "./routers/tools";
import { llmRouter } from "./routers/llm";
import { deploymentsRouter } from "./routers/deployments";
import { botProfilesRouter } from "./routers/botProfiles";
import { chatRoutesRouter } from "./routers/chatRoutes";
import { billingRouter } from "./routers/billing";

/**
 * Main application router
 * All sub-routers are combined here
 */
export const appRouter = router({
  auth: authRouter,
  mcps: mcpsRouter,
  users: usersRouter,
  tenant: tenantRouter,
  applications: applicationsRouter,
  documents: documentsRouter,
  tools: toolsRouter,
  llm: llmRouter,
  deployments: deploymentsRouter,
  botProfiles: botProfilesRouter,
  chatRoutes: chatRoutesRouter,
  billing: billingRouter,
});

// Export type for client
export type AppRouter = typeof appRouter;
