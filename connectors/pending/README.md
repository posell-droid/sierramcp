# Pending Connectors - Batch 3

Staged connector definitions for integration into SierraMCP production. These connectors are ready to be copied into the main codebase.

## Quick Reference

| Connector | Slug | Category | Auth | Tools | Status |
|-----------|------|----------|------|-------|--------|
| Zillow Premier Agent | `zillow` | Real Estate | API_KEY | 40 | Pending |
| DoorDash Merchant | `doordash` | Food Delivery | OAUTH2 | 55 | Pending |
| Facebook/Instagram Business | `facebook-business` | Social Media Marketing | OAUTH2 | 48 | Pending |
| Canva | `canva` | Design | OAUTH2 | 40 | Pending |

## File Structure

```
connectors/pending/
├── README.md                          # This file
├── seed-templates.ts                  # Template entries for seed.ts
├── zillow/
│   └── tools.ts                       # 40 tools (API Key - no callback/refresh needed)
├── doordash/
│   ├── tools.ts                       # 55 tools
│   ├── callback.ts                    # OAuth callback handler
│   └── token-refresh.ts              # Token refresh service
├── facebook-business/
│   ├── tools.ts                       # 48 tools
│   ├── callback.ts                    # OAuth callback (long-lived token exchange)
│   └── token-refresh.ts              # Token refresh (fb_exchange_token)
└── canva/
    ├── tools.ts                       # 40 tools
    ├── callback.ts                    # OAuth callback handler
    └── token-refresh.ts              # Token refresh service
```

## Integration Instructions

### 1. Zillow Premier Agent

**Auth Type:** API Key (Bearer token)
**Base URL:** `https://api.bridgedataoutput.com/api/v2`

Steps:
1. Copy tool definitions from `zillow/tools.ts` into `packages/db/prisma/seed.ts` as `zillowDefaultTools`
2. Add the template entry from `seed-templates.ts` to the `applicationTemplates` array
3. No OAuth callback or token refresh needed (API Key auth)

**API Modules:**
- Leads (10 tools) - Lead management, assignment, activity tracking
- Listings (11 tools) - Property listings, Zestimates, comparables, market data
- Profile (6 tools) - Agent profile, team, advertising, connection score
- Reviews (5 tools) - Review management, responses, review requests
- Analytics (8 tools) - Performance reports, conversion, market share, ROI

### 2. DoorDash Merchant

**Auth Type:** OAuth 2.0 (JWT / client_credentials)
**Base URL:** `https://openapi.doordash.com`

Steps:
1. Copy tool definitions from `doordash/tools.ts` into `packages/db/prisma/seed.ts` as `doordashDefaultTools`
2. Add the template entry from `seed-templates.ts` to the `applicationTemplates` array
3. Copy `doordash/callback.ts` to `packages/functions/src/api/oauth/doordash-callback.ts`
4. Copy `doordash/token-refresh.ts` to `packages/functions/src/services/doordash-token-refresh.ts`
5. Add SST secrets: `DoorDashClientId`, `DoorDashClientSecret`
6. Add OAuth route in `sst.config.ts`

**API Modules:**
- Orders (12 tools) - Order lifecycle, confirmation, cancellation, delivery tracking
- Menu (11 tools) - Menu management, items, categories, pricing, availability
- Store (8 tools) - Store settings, hours, pause/resume, prep time
- Delivery (6 tools) - DoorDash Drive on-demand delivery, quotes, tracking
- Promotions (7 tools) - Discount offers, scheduling, performance
- Reports (8 tools) - Sales, operations, ratings, payouts, cancellations

### 3. Facebook/Instagram Business

**Auth Type:** OAuth 2.0 (authorization code with long-lived token exchange)
**Base URL:** `https://graph.facebook.com/v19.0`

Steps:
1. Copy tool definitions from `facebook-business/tools.ts` into `packages/db/prisma/seed.ts` as `facebookBusinessDefaultTools`
2. Add the template entry from `seed-templates.ts` to the `applicationTemplates` array
3. Copy `facebook-business/callback.ts` to `packages/functions/src/api/oauth/facebook-business-callback.ts`
4. Copy `facebook-business/token-refresh.ts` to `packages/functions/src/services/facebook-business-token-refresh.ts`
5. Add SST secrets: `FacebookAppId`, `FacebookAppSecret`
6. Add OAuth route in `sst.config.ts`

**Important:** Facebook uses a token exchange model, not traditional refresh tokens. Short-lived tokens are exchanged for long-lived tokens (~60 days) during the callback, and long-lived tokens can be re-exchanged before expiry.

**API Modules:**
- Pages (4 tools) - Page management, feed, settings
- Posts (9 tools) - Publishing text/photo/video, comments, scheduling
- Ads (8 tools) - Campaign management, ad sets, ads, insights
- Insights (4 tools) - Page analytics, post performance, audience demographics
- Messages (4 tools) - Messenger conversations, sending messages, metrics
- Instagram (9 tools) - Profile, media, stories, publishing, hashtag search
- Audiences (6 tools) - Custom audiences, lookalikes, size estimates, ad insights

### 4. Canva

**Auth Type:** OAuth 2.0 (authorization code with refresh)
**Base URL:** `https://api.canva.com/rest/v1`

Steps:
1. Copy tool definitions from `canva/tools.ts` into `packages/db/prisma/seed.ts` as `canvaDefaultTools`
2. Add the template entry from `seed-templates.ts` to the `applicationTemplates` array
3. Copy `canva/callback.ts` to `packages/functions/src/api/oauth/canva-callback.ts`
4. Copy `canva/token-refresh.ts` to `packages/functions/src/services/canva-token-refresh.ts`
5. Add SST secrets: `CanvaClientId`, `CanvaClientSecret`
6. Add OAuth route in `sst.config.ts`

**Important:** Canva uses Basic auth (base64 client_id:client_secret) in the Authorization header for token exchange and refresh, not form-encoded credentials.

**API Modules:**
- Designs (11 tools) - Create, update, delete, duplicate, search, pages, comments
- Templates (4 tools) - Template library, brand templates, create from template
- Brand Kit (5 tools) - Colors, fonts, logos, images
- Folders (7 tools) - Organization, items, moving designs
- Export (6 tools) - Export to PNG/JPG/PDF/MP4/GIF/PPTX, assets, sharing

## SST Secrets Required

When integrating OAuth connectors, add these secrets:

```bash
# DoorDash
npx sst secret set DoorDashClientId "..." --stage production
npx sst secret set DoorDashClientSecret "..." --stage production

# Facebook/Instagram Business
npx sst secret set FacebookAppId "..." --stage production
npx sst secret set FacebookAppSecret "..." --stage production

# Canva
npx sst secret set CanvaClientId "..." --stage production
npx sst secret set CanvaClientSecret "..." --stage production
```

## Template Entry Format

Each entry in `seed-templates.ts` follows the `ApplicationTemplate` Prisma model shape:

```typescript
{
  slug: string,           // Unique identifier
  name: string,           // Display name
  category: string,       // Category for grouping
  description: string,    // Short description
  logoUrl: string,        // Path to logo SVG
  docsUrl: string,        // Official API docs URL
  authTypes: string[],    // Supported auth types
  isActive: boolean,      // Whether template is active
  sortOrder: number,      // Display order (Batch 3: 20-23)
  defaultBaseUrl: string,  // API base URL
  defaultAuthType: string, // Recommended auth type
  authConfig: object,     // OAuth URLs, scopes, etc.
  defaultTools: array,    // Tool definitions array
  documentationUrls: string[], // Documentation links
}
```
