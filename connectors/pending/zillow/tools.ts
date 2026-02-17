// Zillow Premier Agent Tool Definitions for SierraMCP seed.ts

export const zillowTools = [
  // ============================================
  // LEADS MODULE
  // ============================================
  {
    name: "list_leads",
    title: "List Leads",
    description:
      "Retrieve a paginated list of leads from Zillow Premier Agent. Returns lead contact info, source, and status.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/leads",
    inputs: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "converted", "lost"],
          description: "Filter by lead status",
        },
        source: {
          type: "string",
          description: "Filter by lead source (e.g., zillow, trulia, hotpads)",
        },
        startDate: {
          type: "string",
          format: "date",
          description: "Filter leads created on or after this date",
        },
        endDate: {
          type: "string",
          format: "date",
          description: "Filter leads created on or before this date",
        },
        limit: {
          type: "integer",
          description: "Number of results to return (max 100)",
        },
        offset: {
          type: "integer",
          description: "Offset for pagination",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        leads: { type: "array", description: "Array of lead objects" },
        totalCount: { type: "integer", description: "Total number of matching leads" },
        hasMore: { type: "boolean", description: "Whether more results exist" },
      },
    },
  },
  {
    name: "get_lead",
    title: "Get Lead Details",
    description:
      "Retrieve detailed information about a specific lead including contact info, property interest, and interaction history.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/leads/{leadId}",
    inputs: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "The lead ID" },
      },
      required: ["leadId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        email: { type: "string" },
        phone: { type: "string" },
        propertyInterest: { type: "object" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "update_lead_status",
    title: "Update Lead Status",
    description:
      "Update the status of a lead (e.g., from new to contacted, qualified, converted, or lost).",
    httpMethod: "PUT",
    pathTemplate: "/zestimates/leads/{leadId}/status",
    inputs: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "The lead ID" },
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "converted", "lost"],
          description: "New status for the lead",
        },
        notes: { type: "string", description: "Notes about the status change" },
      },
      required: ["leadId", "status"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        updatedAt: { type: "string" },
      },
    },
  },
  {
    name: "add_lead_note",
    title: "Add Lead Note",
    description:
      "Add a note or comment to a lead record for tracking interactions and follow-ups.",
    httpMethod: "POST",
    pathTemplate: "/zestimates/leads/{leadId}/notes",
    inputs: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "The lead ID" },
        content: { type: "string", description: "Note content" },
        type: {
          type: "string",
          enum: ["call", "email", "text", "meeting", "general"],
          description: "Type of interaction",
        },
      },
      required: ["leadId", "content"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        content: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
  {
    name: "get_lead_activity",
    title: "Get Lead Activity",
    description:
      "Get the activity history for a lead including property views, saved searches, and agent interactions.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/leads/{leadId}/activity",
    inputs: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "The lead ID" },
        limit: { type: "integer", description: "Number of activities to return" },
        offset: { type: "integer", description: "Offset for pagination" },
      },
      required: ["leadId"],
    },
    outputs: {
      type: "object",
      properties: {
        activities: { type: "array", description: "Array of activity objects" },
        totalCount: { type: "integer" },
      },
    },
  },
  {
    name: "assign_lead",
    title: "Assign Lead",
    description:
      "Assign or reassign a lead to a specific agent on the team.",
    httpMethod: "PUT",
    pathTemplate: "/zestimates/leads/{leadId}/assign",
    inputs: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "The lead ID" },
        agentId: { type: "string", description: "ID of the agent to assign" },
        notes: { type: "string", description: "Assignment notes" },
      },
      required: ["leadId", "agentId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        assignedTo: { type: "string" },
        assignedAt: { type: "string" },
      },
    },
  },
  {
    name: "get_lead_property_interests",
    title: "Get Lead Property Interests",
    description:
      "Get properties a lead has shown interest in, including viewed listings and saved homes.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/leads/{leadId}/properties",
    inputs: {
      type: "object",
      properties: {
        leadId: { type: "string", description: "The lead ID" },
      },
      required: ["leadId"],
    },
    outputs: {
      type: "object",
      properties: {
        properties: { type: "array", description: "Array of property objects the lead is interested in" },
      },
    },
  },
  {
    name: "search_leads",
    title: "Search Leads",
    description:
      "Search leads by name, email, phone number, or property address.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/leads/search",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (name, email, phone, or address)" },
        status: {
          type: "string",
          enum: ["new", "contacted", "qualified", "converted", "lost"],
          description: "Filter by status",
        },
        limit: { type: "integer", description: "Number of results (max 100)" },
      },
      required: ["query"],
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array", description: "Matching leads" },
        totalCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_lead_sources",
    title: "Get Lead Sources",
    description:
      "Get a breakdown of lead sources showing where leads are coming from (Zillow, Trulia, HotPads, etc.).",
    httpMethod: "GET",
    pathTemplate: "/zestimates/leads/sources",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date for analysis" },
        endDate: { type: "string", format: "date", description: "End date for analysis" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        sources: { type: "array", description: "Array of source objects with counts" },
      },
    },
  },
  {
    name: "bulk_update_leads",
    title: "Bulk Update Leads",
    description:
      "Update status or assignment for multiple leads at once.",
    httpMethod: "POST",
    pathTemplate: "/zestimates/leads/bulk-update",
    inputs: {
      type: "object",
      properties: {
        leadIds: {
          type: "array",
          items: { type: "string" },
          description: "Array of lead IDs to update",
        },
        status: { type: "string", description: "New status to set" },
        agentId: { type: "string", description: "Agent to assign leads to" },
      },
      required: ["leadIds"],
    },
    outputs: {
      type: "object",
      properties: {
        updated: { type: "integer", description: "Number of leads updated" },
        failed: { type: "array", description: "IDs that failed to update" },
      },
    },
  },
  // ============================================
  // LISTINGS MODULE
  // ============================================
  {
    name: "list_listings",
    title: "List Listings",
    description:
      "Get all listings associated with the agent's account. Returns active, pending, and sold listings.",
    httpMethod: "GET",
    pathTemplate: "/OData/listings",
    inputs: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["Active", "Pending", "Sold", "Withdrawn", "Expired"],
          description: "Filter by listing status",
        },
        propertyType: {
          type: "string",
          enum: ["SingleFamily", "Condo", "Townhouse", "MultiFamily", "Land", "Commercial"],
          description: "Filter by property type",
        },
        minPrice: { type: "number", description: "Minimum list price" },
        maxPrice: { type: "number", description: "Maximum list price" },
        city: { type: "string", description: "Filter by city" },
        state: { type: "string", description: "Filter by state abbreviation" },
        zipCode: { type: "string", description: "Filter by ZIP code" },
        limit: { type: "integer", description: "Number of results (max 200)" },
        offset: { type: "integer", description: "Offset for pagination" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        listings: { type: "array", description: "Array of listing objects" },
        totalCount: { type: "integer" },
        hasMore: { type: "boolean" },
      },
    },
  },
  {
    name: "get_listing",
    title: "Get Listing Details",
    description:
      "Get detailed information about a specific listing including property details, photos, price history, and Zestimate.",
    httpMethod: "GET",
    pathTemplate: "/OData/listings/{listingId}",
    inputs: {
      type: "object",
      properties: {
        listingId: { type: "string", description: "The listing ID or MLS number" },
      },
      required: ["listingId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        address: { type: "object" },
        price: { type: "number" },
        status: { type: "string" },
        bedrooms: { type: "integer" },
        bathrooms: { type: "number" },
        sqft: { type: "integer" },
        photos: { type: "array" },
        zestimate: { type: "number" },
      },
    },
  },
  {
    name: "get_listing_stats",
    title: "Get Listing Statistics",
    description:
      "Get performance statistics for a listing including views, saves, shares, and contact requests.",
    httpMethod: "GET",
    pathTemplate: "/OData/listings/{listingId}/stats",
    inputs: {
      type: "object",
      properties: {
        listingId: { type: "string", description: "The listing ID" },
        period: {
          type: "string",
          enum: ["7d", "30d", "90d", "all"],
          description: "Time period for stats",
        },
      },
      required: ["listingId"],
    },
    outputs: {
      type: "object",
      properties: {
        views: { type: "integer" },
        saves: { type: "integer" },
        shares: { type: "integer" },
        contactRequests: { type: "integer" },
        averageTimeOnPage: { type: "number" },
      },
    },
  },
  {
    name: "get_property_zestimate",
    title: "Get Property Zestimate",
    description:
      "Get the Zillow Zestimate (automated home valuation) for a property by address or ZPID.",
    httpMethod: "GET",
    pathTemplate: "/zestimates",
    inputs: {
      type: "object",
      properties: {
        zpid: { type: "string", description: "Zillow Property ID" },
        address: { type: "string", description: "Full property address" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        zpid: { type: "string" },
        zestimate: { type: "number" },
        zestimateRange: { type: "object" },
        rentZestimate: { type: "number" },
        lastUpdated: { type: "string" },
      },
    },
  },
  {
    name: "get_comparable_sales",
    title: "Get Comparable Sales",
    description:
      "Get recently sold comparable properties near a given property for market analysis and CMA reports.",
    httpMethod: "GET",
    pathTemplate: "/OData/listings/{listingId}/comparables",
    inputs: {
      type: "object",
      properties: {
        listingId: { type: "string", description: "The listing ID or ZPID" },
        radius: { type: "number", description: "Search radius in miles (default 1)" },
        limit: { type: "integer", description: "Number of comps to return (max 25)" },
        soldWithinDays: { type: "integer", description: "Only include sales within this many days" },
      },
      required: ["listingId"],
    },
    outputs: {
      type: "object",
      properties: {
        comparables: { type: "array", description: "Array of comparable property objects" },
        subjectProperty: { type: "object", description: "The subject property details" },
      },
    },
  },
  {
    name: "search_properties",
    title: "Search Properties",
    description:
      "Search for properties by location, price range, features, and other criteria.",
    httpMethod: "GET",
    pathTemplate: "/OData/properties/search",
    inputs: {
      type: "object",
      properties: {
        location: { type: "string", description: "City, ZIP, or neighborhood" },
        minPrice: { type: "number", description: "Minimum price" },
        maxPrice: { type: "number", description: "Maximum price" },
        minBeds: { type: "integer", description: "Minimum bedrooms" },
        maxBeds: { type: "integer", description: "Maximum bedrooms" },
        minBaths: { type: "number", description: "Minimum bathrooms" },
        minSqft: { type: "integer", description: "Minimum square footage" },
        maxSqft: { type: "integer", description: "Maximum square footage" },
        propertyType: { type: "string", description: "Property type filter" },
        status: { type: "string", enum: ["ForSale", "RecentlySold", "ForRent"], description: "Listing status" },
        limit: { type: "integer", description: "Results per page" },
        offset: { type: "integer", description: "Pagination offset" },
      },
      required: ["location"],
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array", description: "Array of property objects" },
        totalCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_property_details",
    title: "Get Property Details",
    description:
      "Get comprehensive property details including tax history, price history, schools, and neighborhood info.",
    httpMethod: "GET",
    pathTemplate: "/OData/properties/{zpid}",
    inputs: {
      type: "object",
      properties: {
        zpid: { type: "string", description: "Zillow Property ID" },
      },
      required: ["zpid"],
    },
    outputs: {
      type: "object",
      properties: {
        zpid: { type: "string" },
        address: { type: "object" },
        price: { type: "number" },
        taxHistory: { type: "array" },
        priceHistory: { type: "array" },
        schools: { type: "array" },
        walkScore: { type: "integer" },
      },
    },
  },
  {
    name: "get_market_trends",
    title: "Get Market Trends",
    description:
      "Get market trend data for a ZIP code or city including median prices, inventory levels, and days on market.",
    httpMethod: "GET",
    pathTemplate: "/OData/market/trends",
    inputs: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region ID (ZIP, city, or county)" },
        regionType: {
          type: "string",
          enum: ["zip", "city", "county", "state"],
          description: "Type of region",
        },
        metric: {
          type: "string",
          enum: ["medianListPrice", "medianSalePrice", "inventory", "daysOnMarket", "priceToSaleRatio"],
          description: "Market metric to retrieve",
        },
        period: {
          type: "string",
          enum: ["1m", "3m", "6m", "1y", "3y", "5y"],
          description: "Time period for trend data",
        },
      },
      required: ["regionId"],
    },
    outputs: {
      type: "object",
      properties: {
        region: { type: "object" },
        data: { type: "array", description: "Time series data points" },
        summary: { type: "object", description: "Summary statistics" },
      },
    },
  },
  {
    name: "get_price_history",
    title: "Get Price History",
    description:
      "Get the price history for a property including all listing events, price changes, and sales.",
    httpMethod: "GET",
    pathTemplate: "/OData/properties/{zpid}/price-history",
    inputs: {
      type: "object",
      properties: {
        zpid: { type: "string", description: "Zillow Property ID" },
      },
      required: ["zpid"],
    },
    outputs: {
      type: "object",
      properties: {
        events: { type: "array", description: "Array of price history events" },
      },
    },
  },
  {
    name: "get_tax_history",
    title: "Get Tax History",
    description:
      "Get the tax assessment history for a property.",
    httpMethod: "GET",
    pathTemplate: "/OData/properties/{zpid}/tax-history",
    inputs: {
      type: "object",
      properties: {
        zpid: { type: "string", description: "Zillow Property ID" },
      },
      required: ["zpid"],
    },
    outputs: {
      type: "object",
      properties: {
        taxHistory: { type: "array", description: "Array of tax assessment records" },
      },
    },
  },
  {
    name: "get_neighborhood_info",
    title: "Get Neighborhood Info",
    description:
      "Get neighborhood information including demographics, schools, walkability, and amenities.",
    httpMethod: "GET",
    pathTemplate: "/OData/neighborhoods/{regionId}",
    inputs: {
      type: "object",
      properties: {
        regionId: { type: "string", description: "Region or neighborhood ID" },
      },
      required: ["regionId"],
    },
    outputs: {
      type: "object",
      properties: {
        name: { type: "string" },
        demographics: { type: "object" },
        schools: { type: "array" },
        walkScore: { type: "integer" },
        transitScore: { type: "integer" },
        bikeScore: { type: "integer" },
      },
    },
  },
  // ============================================
  // PROFILE MODULE
  // ============================================
  {
    name: "get_agent_profile",
    title: "Get Agent Profile",
    description:
      "Get the agent's Zillow profile information including bio, specializations, service areas, and credentials.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/profile",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        bio: { type: "string" },
        specializations: { type: "array" },
        serviceAreas: { type: "array" },
        salesCount: { type: "integer" },
        averageRating: { type: "number" },
      },
    },
  },
  {
    name: "update_agent_profile",
    title: "Update Agent Profile",
    description:
      "Update the agent's Zillow profile details such as bio, specializations, and contact info.",
    httpMethod: "PUT",
    pathTemplate: "/zestimates/agents/profile",
    inputs: {
      type: "object",
      properties: {
        bio: { type: "string", description: "Agent biography" },
        specializations: {
          type: "array",
          items: { type: "string" },
          description: "List of specializations",
        },
        serviceAreas: {
          type: "array",
          items: { type: "string" },
          description: "ZIP codes or city names for service areas",
        },
        phone: { type: "string", description: "Contact phone number" },
        website: { type: "string", description: "Agent website URL" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        updatedAt: { type: "string" },
      },
    },
  },
  {
    name: "get_team_members",
    title: "Get Team Members",
    description:
      "Get a list of agents on the team with their profiles and performance metrics.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/team",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        members: { type: "array", description: "Array of team member objects" },
      },
    },
  },
  {
    name: "get_agent_listings",
    title: "Get Agent Listings",
    description:
      "Get all listings currently managed by a specific agent.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/{agentId}/listings",
    inputs: {
      type: "object",
      properties: {
        agentId: { type: "string", description: "The agent ID" },
        status: {
          type: "string",
          enum: ["Active", "Pending", "Sold"],
          description: "Filter by listing status",
        },
      },
      required: ["agentId"],
    },
    outputs: {
      type: "object",
      properties: {
        listings: { type: "array", description: "Agent's listings" },
        totalCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_advertising_spend",
    title: "Get Advertising Spend",
    description:
      "Get the agent's Premier Agent advertising spend, budget allocation, and impression data.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/advertising",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        totalSpend: { type: "number" },
        budget: { type: "number" },
        impressions: { type: "integer" },
        zipCodeBreakdown: { type: "array" },
      },
    },
  },
  {
    name: "get_connection_score",
    title: "Get Connection Score",
    description:
      "Get the agent's Zillow connection score which measures responsiveness and engagement.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/connection-score",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        score: { type: "number" },
        responseRate: { type: "number" },
        averageResponseTime: { type: "integer" },
        recommendations: { type: "array" },
      },
    },
  },
  // ============================================
  // REVIEWS MODULE
  // ============================================
  {
    name: "list_reviews",
    title: "List Reviews",
    description:
      "Get all reviews for the agent's Zillow profile with ratings and review text.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/reviews",
    inputs: {
      type: "object",
      properties: {
        rating: { type: "integer", description: "Filter by star rating (1-5)" },
        sortBy: {
          type: "string",
          enum: ["date", "rating"],
          description: "Sort order for reviews",
        },
        limit: { type: "integer", description: "Number of reviews to return" },
        offset: { type: "integer", description: "Offset for pagination" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        reviews: { type: "array", description: "Array of review objects" },
        averageRating: { type: "number" },
        totalCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_review",
    title: "Get Review Details",
    description:
      "Get details of a specific review including the reviewer's transaction details.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/reviews/{reviewId}",
    inputs: {
      type: "object",
      properties: {
        reviewId: { type: "string", description: "The review ID" },
      },
      required: ["reviewId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        rating: { type: "integer" },
        text: { type: "string" },
        reviewerName: { type: "string" },
        transactionType: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
  {
    name: "respond_to_review",
    title: "Respond to Review",
    description:
      "Post a public response to a client review on the agent's Zillow profile.",
    httpMethod: "POST",
    pathTemplate: "/zestimates/agents/reviews/{reviewId}/response",
    inputs: {
      type: "object",
      properties: {
        reviewId: { type: "string", description: "The review ID" },
        response: { type: "string", description: "Response text" },
      },
      required: ["reviewId", "response"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        reviewId: { type: "string" },
        response: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
  {
    name: "request_review",
    title: "Request Review",
    description:
      "Send a review request to a past client via email.",
    httpMethod: "POST",
    pathTemplate: "/zestimates/agents/reviews/request",
    inputs: {
      type: "object",
      properties: {
        clientEmail: { type: "string", description: "Client's email address" },
        clientName: { type: "string", description: "Client's name" },
        transactionType: {
          type: "string",
          enum: ["buy", "sell", "rent"],
          description: "Type of transaction",
        },
        message: { type: "string", description: "Optional personalized message" },
      },
      required: ["clientEmail", "clientName"],
    },
    outputs: {
      type: "object",
      properties: {
        sent: { type: "boolean" },
        requestId: { type: "string" },
      },
    },
  },
  {
    name: "get_review_summary",
    title: "Get Review Summary",
    description:
      "Get a summary of all reviews including average rating, rating distribution, and review count by type.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/agents/reviews/summary",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        averageRating: { type: "number" },
        totalReviews: { type: "integer" },
        ratingDistribution: { type: "object" },
        byTransactionType: { type: "object" },
      },
    },
  },
  // ============================================
  // ANALYTICS MODULE
  // ============================================
  {
    name: "get_profile_views",
    title: "Get Profile Views",
    description:
      "Get the number of views on the agent's Zillow profile over a specified time period.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/profile-views",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        granularity: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Data granularity",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        total: { type: "integer" },
        data: { type: "array", description: "Time series of profile views" },
      },
    },
  },
  {
    name: "get_listing_performance",
    title: "Get Listing Performance",
    description:
      "Get aggregated performance metrics across all active listings including views, saves, and inquiries.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/listings",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        groupBy: {
          type: "string",
          enum: ["listing", "zipCode", "propertyType"],
          description: "Group results by dimension",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        totalViews: { type: "integer" },
        totalSaves: { type: "integer" },
        totalInquiries: { type: "integer" },
        data: { type: "array", description: "Performance data grouped by dimension" },
      },
    },
  },
  {
    name: "get_lead_conversion_report",
    title: "Get Lead Conversion Report",
    description:
      "Get a report on lead conversion rates by source, status, and time period.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/conversions",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        groupBy: {
          type: "string",
          enum: ["source", "agent", "month"],
          description: "Group results by dimension",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        totalLeads: { type: "integer" },
        convertedLeads: { type: "integer" },
        conversionRate: { type: "number" },
        data: { type: "array", description: "Conversion data by group" },
      },
    },
  },
  {
    name: "get_response_time_report",
    title: "Get Response Time Report",
    description:
      "Get the agent's response time metrics for lead inquiries broken down by source and time period.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/response-time",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        averageResponseTime: { type: "integer", description: "Average response time in minutes" },
        medianResponseTime: { type: "integer" },
        responseRate: { type: "number" },
        bySource: { type: "array", description: "Response times by lead source" },
      },
    },
  },
  {
    name: "get_market_share_report",
    title: "Get Market Share Report",
    description:
      "Get the agent's market share metrics in their service areas based on transactions and volume.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/market-share",
    inputs: {
      type: "object",
      properties: {
        zipCode: { type: "string", description: "Filter by ZIP code" },
        period: {
          type: "string",
          enum: ["3m", "6m", "1y"],
          description: "Time period",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        transactionShare: { type: "number" },
        volumeShare: { type: "number" },
        totalTransactions: { type: "integer" },
        totalVolume: { type: "number" },
        ranking: { type: "integer", description: "Agent ranking in area" },
      },
    },
  },
  {
    name: "get_advertising_roi",
    title: "Get Advertising ROI",
    description:
      "Get return on investment metrics for Premier Agent advertising spend.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/advertising-roi",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        groupBy: {
          type: "string",
          enum: ["zipCode", "month"],
          description: "Group results by dimension",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        totalSpend: { type: "number" },
        totalLeads: { type: "integer" },
        costPerLead: { type: "number" },
        closedDeals: { type: "integer" },
        revenue: { type: "number" },
        roi: { type: "number" },
      },
    },
  },
  {
    name: "get_competitor_analysis",
    title: "Get Competitor Analysis",
    description:
      "Get competitive analysis data showing how the agent compares to other Premier Agents in their service areas.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/competitors",
    inputs: {
      type: "object",
      properties: {
        zipCode: { type: "string", description: "ZIP code to analyze" },
      },
      required: ["zipCode"],
    },
    outputs: {
      type: "object",
      properties: {
        agentPosition: { type: "integer" },
        totalAgents: { type: "integer" },
        shareOfVoice: { type: "number" },
        competitorCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_monthly_summary",
    title: "Get Monthly Summary",
    description:
      "Get a comprehensive monthly performance summary including leads, conversions, listings, and revenue.",
    httpMethod: "GET",
    pathTemplate: "/zestimates/analytics/monthly-summary",
    inputs: {
      type: "object",
      properties: {
        month: { type: "string", description: "Month in YYYY-MM format" },
      },
      required: ["month"],
    },
    outputs: {
      type: "object",
      properties: {
        newLeads: { type: "integer" },
        conversions: { type: "integer" },
        activeListings: { type: "integer" },
        closedTransactions: { type: "integer" },
        totalVolume: { type: "number" },
        profileViews: { type: "integer" },
        averageRating: { type: "number" },
      },
    },
  },
  {
    name: "export_analytics",
    title: "Export Analytics",
    description:
      "Export analytics data for a date range in CSV or JSON format.",
    httpMethod: "POST",
    pathTemplate: "/zestimates/analytics/export",
    inputs: {
      type: "object",
      properties: {
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        format: {
          type: "string",
          enum: ["csv", "json"],
          description: "Export format",
        },
        metrics: {
          type: "array",
          items: { type: "string" },
          description: "Metrics to include in export",
        },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        downloadUrl: { type: "string", description: "URL to download the export" },
        expiresAt: { type: "string" },
      },
    },
  },
];
