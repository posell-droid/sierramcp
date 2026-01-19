import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@repo/functions";

/**
 * tRPC React client
 * Use this in React components for data fetching
 *
 * Usage:
 *   const { data, isLoading } = trpc.projects.list.useQuery();
 *   const mutation = trpc.projects.create.useMutation();
 */
export const trpc = createTRPCReact<AppRouter>();
