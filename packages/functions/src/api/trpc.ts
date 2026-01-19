import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { appRouter } from "./trpc/router";
import { createContext } from "./trpc/trpc";

export const handler: APIGatewayProxyHandlerV2 = async (event, context) => {
  // Convert API Gateway event to fetch Request
  const url = new URL(
    event.rawPath + (event.rawQueryString ? `?${event.rawQueryString}` : ""),
    `https://${event.requestContext.domainName}`
  );

  const headers = new Headers();
  for (const [key, value] of Object.entries(event.headers || {})) {
    if (value) headers.set(key, value);
  }

  const request = new Request(url.toString(), {
    method: event.requestContext.http.method,
    headers,
    body: event.body
      ? event.isBase64Encoded
        ? Buffer.from(event.body, "base64").toString()
        : event.body
      : undefined,
  });

  // Handle with tRPC
  const response = await fetchRequestHandler({
    endpoint: "",
    req: request,
    router: appRouter,
    createContext: async () => createContext({ headers }),
    onError: ({ error, path }) => {
      console.error(`tRPC error on ${path}:`, error);
    },
  });

  // Convert Response back to API Gateway format
  const responseHeaders: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    statusCode: response.status,
    headers: responseHeaders,
    body: await response.text(),
  };
};
