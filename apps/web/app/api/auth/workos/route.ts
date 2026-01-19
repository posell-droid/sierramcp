import { NextRequest, NextResponse } from "next/server";

// Force dynamic rendering - no caching
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  console.log("SSO route called");

  try {
    // Get redirect URI - try SST Resource first, then env vars
    let redirectUri: string | undefined;
    let clientId: string | undefined;

    try {
      // Dynamic import to avoid issues if sst isn't available
      const { Resource } = await import("sst");
      const resource = Resource as unknown as {
        WorkosRedirectUri?: { value: string };
        WorkosClientId?: { value: string };
      };
      redirectUri = resource.WorkosRedirectUri?.value;
      clientId = resource.WorkosClientId?.value;
      console.log("SST Resources loaded:", {
        hasRedirectUri: !!redirectUri,
        hasClientId: !!clientId
      });
    } catch (e) {
      console.log("SST Resource not available, using env vars:", e);
    }

    // Fallback to env vars
    redirectUri = redirectUri || process.env.WORKOS_REDIRECT_URI || process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
    clientId = clientId || process.env.WORKOS_CLIENT_ID;

    console.log("Final config:", {
      hasRedirectUri: !!redirectUri,
      hasClientId: !!clientId,
      redirectUri: redirectUri?.substring(0, 50) + "..."
    });

    if (!clientId) {
      console.error("WORKOS_CLIENT_ID not configured");
      return NextResponse.redirect(new URL("/login?error=MissingClientId", request.url));
    }

    if (!redirectUri) {
      console.error("WORKOS_REDIRECT_URI not configured");
      return NextResponse.redirect(new URL("/login?error=MissingRedirectUri", request.url));
    }

    // Check if signup screen was requested (for invitations)
    const screenHint = request.nextUrl.searchParams.get("screen") === "sign-up"
      ? "sign-up"
      : "sign-in";

    // Build the WorkOS authorization URL manually
    const authUrl = new URL("https://api.workos.com/user_management/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("provider", "authkit");
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("screen_hint", screenHint);

    console.log("Redirecting to WorkOS:", authUrl.toString());

    // Use NextResponse.redirect
    return NextResponse.redirect(authUrl.toString());
  } catch (error) {
    console.error("SSO route error:", error);
    return NextResponse.redirect(new URL("/login?error=SSOError", request.url));
  }
}
