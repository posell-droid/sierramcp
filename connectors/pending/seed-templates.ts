/**
 * Batch 3 Pending Connector Templates for SierraMCP
 *
 * These template entries should be added to the `applicationTemplates` array
 * in packages/db/prisma/seed.ts when integrating into production.
 *
 * Connectors:
 *   - Zillow Premier Agent (Real Estate, API Key)
 *   - DoorDash Merchant (Food Delivery, OAuth2)
 *   - Facebook/Instagram Business (Social Media Marketing, OAuth2)
 *   - Canva (Design, OAuth2)
 */

// Import tool arrays from connector directories
// import { zillowTools } from "./zillow/tools";
// import { doordashTools } from "./doordash/tools";
// import { facebookBusinessTools } from "./facebook-business/tools";
// import { canvaTools } from "./canva/tools";

import { zillowTools } from "./zillow/tools";
import { doordashTools } from "./doordash/tools";
import { facebookBusinessTools } from "./facebook-business/tools";
import { canvaTools } from "./canva/tools";

export const pendingTemplates = [
  {
    slug: "zillow",
    name: "Zillow Premier Agent",
    category: "Real Estate",
    description: "Connect to Zillow Premier Agent for lead management, property listings, market analytics, reviews, and agent profile management",
    logoUrl: "/images/templates/zillow.svg",
    docsUrl: "https://bridgedataoutput.com/docs/explorer/zillow",
    authTypes: ["API_KEY"],
    isActive: true,
    sortOrder: 20,
    defaultBaseUrl: "https://api.bridgedataoutput.com/api/v2",
    defaultAuthType: "API_KEY" as const,
    authConfig: {
      headerName: "Authorization",
      headerPrefix: "Bearer",
    },
    defaultTools: zillowTools,
    documentationUrls: ["https://bridgedataoutput.com/docs/explorer/zillow"],
  },
  {
    slug: "doordash",
    name: "DoorDash Merchant",
    category: "Food Delivery",
    description: "Connect to DoorDash Merchant API for order management, menu updates, store operations, delivery tracking, promotions, and sales reporting",
    logoUrl: "/images/templates/doordash.svg",
    docsUrl: "https://developer.doordash.com/docs/api",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 21,
    defaultBaseUrl: "https://openapi.doordash.com",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://identity.doordash.com/connect/authorize",
      tokenUrl: "https://identity.doordash.com/connect/token",
      scopes: ["merchant.orders.read", "merchant.orders.write", "merchant.menus.read", "merchant.menus.write", "merchant.stores.read", "merchant.stores.write"],
    },
    defaultTools: doordashTools,
    documentationUrls: ["https://developer.doordash.com/docs/api"],
  },
  {
    slug: "facebook-business",
    name: "Facebook/Instagram Business",
    category: "Social Media Marketing",
    description: "Connect to Facebook and Instagram Business APIs for page management, post publishing, ad campaigns, audience insights, Messenger, and Instagram content",
    logoUrl: "/images/templates/facebook-business.svg",
    docsUrl: "https://developers.facebook.com/docs/graph-api",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 22,
    defaultBaseUrl: "https://graph.facebook.com/v19.0",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://www.facebook.com/v19.0/dialog/oauth",
      tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
      scopes: [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "pages_messaging",
        "ads_management",
        "ads_read",
        "instagram_basic",
        "instagram_content_publish",
        "instagram_manage_insights",
        "business_management",
      ],
    },
    defaultTools: facebookBusinessTools,
    documentationUrls: [
      "https://developers.facebook.com/docs/graph-api",
      "https://developers.facebook.com/docs/instagram-api",
      "https://developers.facebook.com/docs/marketing-apis",
    ],
  },
  {
    slug: "canva",
    name: "Canva",
    category: "Design",
    description: "Connect to Canva for design creation, template management, brand kit access, folder organization, and exporting designs to multiple formats",
    logoUrl: "/images/templates/canva.svg",
    docsUrl: "https://www.canva.dev/docs/connect/",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 23,
    defaultBaseUrl: "https://api.canva.com/rest/v1",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://www.canva.com/api/oauth/authorize",
      tokenUrl: "https://api.canva.com/rest/v1/oauth/token",
      scopes: [
        "design:content:read",
        "design:content:write",
        "design:meta:read",
        "folder:read",
        "folder:write",
        "asset:read",
        "asset:write",
        "brandtemplate:content:read",
        "brandtemplate:meta:read",
        "profile:read",
      ],
    },
    defaultTools: canvaTools,
    documentationUrls: ["https://www.canva.dev/docs/connect/"],
  },
];
