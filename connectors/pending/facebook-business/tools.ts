// Facebook/Instagram Business Tool Definitions for SierraMCP seed.ts

export const facebookBusinessTools = [
  // ============================================
  // PAGES MODULE
  // ============================================
  {
    name: "list_pages",
    title: "List Pages",
    description:
      "Get all Facebook Pages managed by the authenticated user. Returns page name, category, and access tokens.",
    httpMethod: "GET",
    pathTemplate: "/me/accounts",
    inputs: {
      type: "object",
      properties: {
        fields: {
          type: "string",
          description: "Comma-separated fields to return (e.g., name,category,fan_count,picture)",
        },
        limit: { type: "integer", description: "Number of results (max 100)" },
        after: { type: "string", description: "Pagination cursor" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of Page objects" },
        paging: { type: "object", description: "Pagination cursors" },
      },
    },
  },
  {
    name: "get_page",
    title: "Get Page Details",
    description:
      "Get detailed information about a Facebook Page including category, description, follower count, and contact info.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (name,category,fan_count,about,website,phone,hours,location)",
        },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        category: { type: "string" },
        fan_count: { type: "integer" },
        about: { type: "string" },
      },
    },
  },
  {
    name: "get_page_feed",
    title: "Get Page Feed",
    description:
      "Get the feed of posts on a Facebook Page including organic and paid posts.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/feed",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (message,created_time,shares,likes.summary(true),comments.summary(true))",
        },
        since: { type: "string", description: "Unix timestamp or date string for start of range" },
        until: { type: "string", description: "Unix timestamp or date string for end of range" },
        limit: { type: "integer", description: "Number of posts to return" },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of post objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_page_settings",
    title: "Get Page Settings",
    description:
      "Get the current settings for a Facebook Page including messaging, posting, and notification preferences.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/settings",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of setting objects" },
      },
    },
  },
  // ============================================
  // POSTS MODULE
  // ============================================
  {
    name: "create_post",
    title: "Create Post",
    description:
      "Publish a new post to a Facebook Page. Supports text, links, and scheduled publishing.",
    httpMethod: "POST",
    pathTemplate: "/{pageId}/feed",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        message: { type: "string", description: "Post text content" },
        link: { type: "string", description: "URL to share" },
        published: { type: "boolean", description: "Whether to publish immediately (default true)" },
        scheduled_publish_time: { type: "integer", description: "Unix timestamp for scheduled publish" },
        targeting: { type: "object", description: "Audience targeting parameters" },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "The post ID" },
      },
    },
  },
  {
    name: "create_photo_post",
    title: "Create Photo Post",
    description:
      "Publish a photo post to a Facebook Page with an image URL and optional caption.",
    httpMethod: "POST",
    pathTemplate: "/{pageId}/photos",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        url: { type: "string", description: "URL of the image to post" },
        caption: { type: "string", description: "Photo caption" },
        published: { type: "boolean", description: "Whether to publish immediately" },
        scheduled_publish_time: { type: "integer", description: "Unix timestamp for scheduled publish" },
      },
      required: ["pageId", "url"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        post_id: { type: "string" },
      },
    },
  },
  {
    name: "create_video_post",
    title: "Create Video Post",
    description:
      "Publish a video post to a Facebook Page with a video URL and description.",
    httpMethod: "POST",
    pathTemplate: "/{pageId}/videos",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        file_url: { type: "string", description: "URL of the video file" },
        title: { type: "string", description: "Video title" },
        description: { type: "string", description: "Video description" },
        published: { type: "boolean", description: "Whether to publish immediately" },
        scheduled_publish_time: { type: "integer", description: "Unix timestamp for scheduled publish" },
      },
      required: ["pageId", "file_url"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    },
  },
  {
    name: "get_post",
    title: "Get Post Details",
    description:
      "Get details of a specific post including engagement metrics, comments, and shares.",
    httpMethod: "GET",
    pathTemplate: "/{postId}",
    inputs: {
      type: "object",
      properties: {
        postId: { type: "string", description: "The post ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (message,created_time,shares,likes.summary(true),comments.summary(true),insights)",
        },
      },
      required: ["postId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        message: { type: "string" },
        created_time: { type: "string" },
        shares: { type: "object" },
        likes: { type: "object" },
        comments: { type: "object" },
      },
    },
  },
  {
    name: "update_post",
    title: "Update Post",
    description:
      "Update the text content of an existing post.",
    httpMethod: "POST",
    pathTemplate: "/{postId}",
    inputs: {
      type: "object",
      properties: {
        postId: { type: "string", description: "The post ID" },
        message: { type: "string", description: "Updated post text" },
      },
      required: ["postId", "message"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "delete_post",
    title: "Delete Post",
    description:
      "Delete a post from a Facebook Page.",
    httpMethod: "DELETE",
    pathTemplate: "/{postId}",
    inputs: {
      type: "object",
      properties: {
        postId: { type: "string", description: "The post ID" },
      },
      required: ["postId"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "get_post_comments",
    title: "Get Post Comments",
    description:
      "Get comments on a specific post with optional filtering and sorting.",
    httpMethod: "GET",
    pathTemplate: "/{postId}/comments",
    inputs: {
      type: "object",
      properties: {
        postId: { type: "string", description: "The post ID" },
        filter: {
          type: "string",
          enum: ["toplevel", "stream"],
          description: "Comment filter type",
        },
        order: {
          type: "string",
          enum: ["chronological", "reverse_chronological"],
          description: "Sort order",
        },
        limit: { type: "integer", description: "Number of comments to return" },
      },
      required: ["postId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of comment objects" },
        paging: { type: "object" },
        summary: { type: "object" },
      },
    },
  },
  {
    name: "reply_to_comment",
    title: "Reply to Comment",
    description:
      "Post a reply to a comment on a Page post.",
    httpMethod: "POST",
    pathTemplate: "/{commentId}/comments",
    inputs: {
      type: "object",
      properties: {
        commentId: { type: "string", description: "The comment ID to reply to" },
        message: { type: "string", description: "Reply text" },
      },
      required: ["commentId", "message"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    },
  },
  {
    name: "get_scheduled_posts",
    title: "Get Scheduled Posts",
    description:
      "Get all scheduled (unpublished) posts for a Page.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/scheduled_posts",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of scheduled post objects" },
        paging: { type: "object" },
      },
    },
  },
  // ============================================
  // ADS MODULE
  // ============================================
  {
    name: "list_ad_accounts",
    title: "List Ad Accounts",
    description:
      "Get all ad accounts the user has access to.",
    httpMethod: "GET",
    pathTemplate: "/me/adaccounts",
    inputs: {
      type: "object",
      properties: {
        fields: {
          type: "string",
          description: "Comma-separated fields (name,account_status,currency,balance,amount_spent)",
        },
        limit: { type: "integer", description: "Number of results" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of ad account objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_ad_account",
    title: "Get Ad Account",
    description:
      "Get details of a specific ad account including balance, spend, and status.",
    httpMethod: "GET",
    pathTemplate: "/act_{adAccountId}",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID (without act_ prefix)" },
        fields: {
          type: "string",
          description: "Comma-separated fields (name,account_status,currency,balance,amount_spent,business)",
        },
      },
      required: ["adAccountId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        account_status: { type: "integer" },
        currency: { type: "string" },
        balance: { type: "string" },
        amount_spent: { type: "string" },
      },
    },
  },
  {
    name: "list_campaigns",
    title: "List Campaigns",
    description:
      "Get all campaigns for an ad account with status and budget information.",
    httpMethod: "GET",
    pathTemplate: "/act_{adAccountId}/campaigns",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (name,status,objective,daily_budget,lifetime_budget,start_time,stop_time)",
        },
        effective_status: {
          type: "array",
          items: { type: "string" },
          description: "Filter by status (ACTIVE, PAUSED, DELETED, ARCHIVED)",
        },
        limit: { type: "integer", description: "Number of results" },
      },
      required: ["adAccountId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of campaign objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_campaign_insights",
    title: "Get Campaign Insights",
    description:
      "Get performance insights for a campaign including impressions, clicks, spend, and conversions.",
    httpMethod: "GET",
    pathTemplate: "/{campaignId}/insights",
    inputs: {
      type: "object",
      properties: {
        campaignId: { type: "string", description: "The campaign ID" },
        fields: {
          type: "string",
          description: "Comma-separated metrics (impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,conversions)",
        },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "this_week_sun_today", "last_7d", "last_14d", "last_30d", "this_month", "last_month"],
          description: "Predefined date range",
        },
        time_range: { type: "object", description: "Custom date range with since and until" },
        level: {
          type: "string",
          enum: ["campaign", "adset", "ad"],
          description: "Aggregation level",
        },
        time_increment: { type: "string", description: "Time increment (1 for daily, 7 for weekly, monthly)" },
      },
      required: ["campaignId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of insight objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "create_campaign",
    title: "Create Campaign",
    description:
      "Create a new advertising campaign with specified objective and budget.",
    httpMethod: "POST",
    pathTemplate: "/act_{adAccountId}/campaigns",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        name: { type: "string", description: "Campaign name" },
        objective: {
          type: "string",
          enum: ["OUTCOME_AWARENESS", "OUTCOME_TRAFFIC", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS", "OUTCOME_APP_PROMOTION", "OUTCOME_SALES"],
          description: "Campaign objective",
        },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED"],
          description: "Initial campaign status",
        },
        daily_budget: { type: "integer", description: "Daily budget in cents" },
        lifetime_budget: { type: "integer", description: "Lifetime budget in cents" },
        special_ad_categories: {
          type: "array",
          items: { type: "string" },
          description: "Special ad categories (HOUSING, CREDIT, EMPLOYMENT, etc.)",
        },
      },
      required: ["adAccountId", "name", "objective"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    },
  },
  {
    name: "update_campaign",
    title: "Update Campaign",
    description:
      "Update a campaign's name, status, budget, or other settings.",
    httpMethod: "POST",
    pathTemplate: "/{campaignId}",
    inputs: {
      type: "object",
      properties: {
        campaignId: { type: "string", description: "The campaign ID" },
        name: { type: "string", description: "Updated campaign name" },
        status: {
          type: "string",
          enum: ["ACTIVE", "PAUSED", "DELETED", "ARCHIVED"],
          description: "Updated status",
        },
        daily_budget: { type: "integer", description: "Updated daily budget in cents" },
      },
      required: ["campaignId"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "list_ad_sets",
    title: "List Ad Sets",
    description:
      "Get all ad sets for a campaign with targeting and budget details.",
    httpMethod: "GET",
    pathTemplate: "/{campaignId}/adsets",
    inputs: {
      type: "object",
      properties: {
        campaignId: { type: "string", description: "The campaign ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (name,status,daily_budget,targeting,optimization_goal,bid_amount)",
        },
        limit: { type: "integer", description: "Number of results" },
      },
      required: ["campaignId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of ad set objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "list_ads",
    title: "List Ads",
    description:
      "Get all ads within an ad set with creative and performance data.",
    httpMethod: "GET",
    pathTemplate: "/{adSetId}/ads",
    inputs: {
      type: "object",
      properties: {
        adSetId: { type: "string", description: "The ad set ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (name,status,creative,tracking_specs)",
        },
        limit: { type: "integer", description: "Number of results" },
      },
      required: ["adSetId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of ad objects" },
        paging: { type: "object" },
      },
    },
  },
  // ============================================
  // INSIGHTS MODULE
  // ============================================
  {
    name: "get_page_insights",
    title: "Get Page Insights",
    description:
      "Get Page-level insights and analytics including reach, engagement, and follower demographics.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/insights",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        metric: {
          type: "string",
          description: "Comma-separated metrics (page_impressions,page_engaged_users,page_fans,page_fan_adds,page_views_total)",
        },
        period: {
          type: "string",
          enum: ["day", "week", "days_28", "month", "lifetime"],
          description: "Aggregation period",
        },
        since: { type: "string", description: "Start date (Unix timestamp or ISO date)" },
        until: { type: "string", description: "End date (Unix timestamp or ISO date)" },
      },
      required: ["pageId", "metric"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of metric objects with values" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_post_insights",
    title: "Get Post Insights",
    description:
      "Get detailed insights for a specific post including reach, engagement, and reactions breakdown.",
    httpMethod: "GET",
    pathTemplate: "/{postId}/insights",
    inputs: {
      type: "object",
      properties: {
        postId: { type: "string", description: "The post ID" },
        metric: {
          type: "string",
          description: "Comma-separated metrics (post_impressions,post_engaged_users,post_clicks,post_reactions_by_type_total)",
        },
      },
      required: ["postId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of metric objects" },
      },
    },
  },
  {
    name: "get_audience_insights",
    title: "Get Audience Insights",
    description:
      "Get audience demographics for a Page including age, gender, location, and language breakdown.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/insights",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        metric: {
          type: "string",
          description: "Audience metrics (page_fans_city,page_fans_country,page_fans_gender_age,page_fans_locale)",
        },
        period: {
          type: "string",
          enum: ["day", "lifetime"],
          description: "Aggregation period",
        },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of audience metric objects" },
      },
    },
  },
  {
    name: "get_video_insights",
    title: "Get Video Insights",
    description:
      "Get performance metrics for a video post including views, retention, and average watch time.",
    httpMethod: "GET",
    pathTemplate: "/{videoId}/video_insights",
    inputs: {
      type: "object",
      properties: {
        videoId: { type: "string", description: "The video ID" },
        metric: {
          type: "string",
          description: "Video metrics (total_video_views,total_video_views_unique,total_video_avg_time_watched)",
        },
      },
      required: ["videoId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of video metric objects" },
      },
    },
  },
  // ============================================
  // MESSAGES MODULE
  // ============================================
  {
    name: "get_conversations",
    title: "Get Conversations",
    description:
      "Get all Messenger conversations for a Page.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/conversations",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        folder: {
          type: "string",
          enum: ["inbox", "other", "page_done", "pending", "spam"],
          description: "Message folder to retrieve",
        },
        fields: {
          type: "string",
          description: "Fields (participants,messages{message,from,created_time},updated_time,unread_count)",
        },
        limit: { type: "integer", description: "Number of conversations" },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of conversation objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_conversation_messages",
    title: "Get Conversation Messages",
    description:
      "Get messages within a specific conversation thread.",
    httpMethod: "GET",
    pathTemplate: "/{conversationId}/messages",
    inputs: {
      type: "object",
      properties: {
        conversationId: { type: "string", description: "The conversation ID" },
        fields: {
          type: "string",
          description: "Message fields (message,from,created_time,attachments)",
        },
        limit: { type: "integer", description: "Number of messages" },
      },
      required: ["conversationId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of message objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "send_message",
    title: "Send Message",
    description:
      "Send a message to a user via Messenger using the Page's identity.",
    httpMethod: "POST",
    pathTemplate: "/{pageId}/messages",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        recipient: {
          type: "object",
          description: "Recipient object with id field",
          properties: {
            id: { type: "string", description: "Recipient's PSID" },
          },
        },
        message: {
          type: "object",
          description: "Message object with text field",
          properties: {
            text: { type: "string", description: "Message text" },
          },
        },
        messaging_type: {
          type: "string",
          enum: ["RESPONSE", "UPDATE", "MESSAGE_TAG"],
          description: "Message type (RESPONSE for replies within 24h)",
        },
      },
      required: ["pageId", "recipient", "message"],
    },
    outputs: {
      type: "object",
      properties: {
        recipient_id: { type: "string" },
        message_id: { type: "string" },
      },
    },
  },
  {
    name: "get_message_metrics",
    title: "Get Message Metrics",
    description:
      "Get messaging metrics for a Page including response rate and response time.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}/insights",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        metric: {
          type: "string",
          description: "Messaging metrics (page_messages_total_messaging_connections,page_messages_new_conversations_unique)",
        },
        period: {
          type: "string",
          enum: ["day", "week", "days_28"],
          description: "Aggregation period",
        },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of messaging metric objects" },
      },
    },
  },
  // ============================================
  // INSTAGRAM MODULE
  // ============================================
  {
    name: "get_instagram_account",
    title: "Get Instagram Account",
    description:
      "Get the Instagram Business account connected to a Facebook Page.",
    httpMethod: "GET",
    pathTemplate: "/{pageId}",
    inputs: {
      type: "object",
      properties: {
        pageId: { type: "string", description: "The Page ID" },
        fields: {
          type: "string",
          description: "Fields: instagram_business_account",
        },
      },
      required: ["pageId"],
    },
    outputs: {
      type: "object",
      properties: {
        instagram_business_account: { type: "object", description: "Instagram account object with id" },
      },
    },
  },
  {
    name: "get_instagram_profile",
    title: "Get Instagram Profile",
    description:
      "Get Instagram Business profile information including bio, follower count, and media count.",
    httpMethod: "GET",
    pathTemplate: "/{igUserId}",
    inputs: {
      type: "object",
      properties: {
        igUserId: { type: "string", description: "Instagram Business account ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (username,name,biography,followers_count,follows_count,media_count,profile_picture_url,website)",
        },
      },
      required: ["igUserId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        username: { type: "string" },
        name: { type: "string" },
        biography: { type: "string" },
        followers_count: { type: "integer" },
        follows_count: { type: "integer" },
        media_count: { type: "integer" },
      },
    },
  },
  {
    name: "get_instagram_media",
    title: "Get Instagram Media",
    description:
      "Get media posts from an Instagram Business account.",
    httpMethod: "GET",
    pathTemplate: "/{igUserId}/media",
    inputs: {
      type: "object",
      properties: {
        igUserId: { type: "string", description: "Instagram Business account ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (caption,media_type,media_url,permalink,timestamp,like_count,comments_count)",
        },
        limit: { type: "integer", description: "Number of results" },
        after: { type: "string", description: "Pagination cursor" },
      },
      required: ["igUserId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of media objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_instagram_media_insights",
    title: "Get Instagram Media Insights",
    description:
      "Get insights for a specific Instagram post including reach, impressions, and engagement.",
    httpMethod: "GET",
    pathTemplate: "/{mediaId}/insights",
    inputs: {
      type: "object",
      properties: {
        mediaId: { type: "string", description: "The media ID" },
        metric: {
          type: "string",
          description: "Comma-separated metrics (impressions,reach,engagement,saved,video_views)",
        },
      },
      required: ["mediaId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of insight metric objects" },
      },
    },
  },
  {
    name: "get_instagram_insights",
    title: "Get Instagram Account Insights",
    description:
      "Get account-level insights for Instagram Business including reach, impressions, and follower demographics.",
    httpMethod: "GET",
    pathTemplate: "/{igUserId}/insights",
    inputs: {
      type: "object",
      properties: {
        igUserId: { type: "string", description: "Instagram Business account ID" },
        metric: {
          type: "string",
          description: "Account metrics (impressions,reach,follower_count,profile_views,website_clicks)",
        },
        period: {
          type: "string",
          enum: ["day", "week", "days_28", "lifetime"],
          description: "Aggregation period",
        },
        since: { type: "string", description: "Start date (Unix timestamp)" },
        until: { type: "string", description: "End date (Unix timestamp)" },
      },
      required: ["igUserId", "metric", "period"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of insight objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "create_instagram_media",
    title: "Create Instagram Media Container",
    description:
      "Create a media container for publishing a photo or video to Instagram. Step 1 of the publishing flow.",
    httpMethod: "POST",
    pathTemplate: "/{igUserId}/media",
    inputs: {
      type: "object",
      properties: {
        igUserId: { type: "string", description: "Instagram Business account ID" },
        image_url: { type: "string", description: "Public URL of the image" },
        video_url: { type: "string", description: "Public URL of the video" },
        caption: { type: "string", description: "Post caption (max 2200 characters)" },
        location_id: { type: "string", description: "Facebook Place ID for location tag" },
        user_tags: { type: "array", description: "Array of user tags" },
        media_type: {
          type: "string",
          enum: ["IMAGE", "VIDEO", "CAROUSEL_ALBUM", "REELS"],
          description: "Type of media",
        },
      },
      required: ["igUserId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Media container ID" },
      },
    },
  },
  {
    name: "publish_instagram_media",
    title: "Publish Instagram Media",
    description:
      "Publish a previously created media container to Instagram. Step 2 of the publishing flow.",
    httpMethod: "POST",
    pathTemplate: "/{igUserId}/media_publish",
    inputs: {
      type: "object",
      properties: {
        igUserId: { type: "string", description: "Instagram Business account ID" },
        creation_id: { type: "string", description: "Media container ID from create step" },
      },
      required: ["igUserId", "creation_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Published media ID" },
      },
    },
  },
  {
    name: "get_instagram_stories",
    title: "Get Instagram Stories",
    description:
      "Get active stories for an Instagram Business account.",
    httpMethod: "GET",
    pathTemplate: "/{igUserId}/stories",
    inputs: {
      type: "object",
      properties: {
        igUserId: { type: "string", description: "Instagram Business account ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (caption,media_type,media_url,permalink,timestamp)",
        },
      },
      required: ["igUserId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of story objects" },
      },
    },
  },
  {
    name: "get_instagram_hashtag_search",
    title: "Search Instagram Hashtag",
    description:
      "Search for a hashtag ID to use with the Hashtag endpoints.",
    httpMethod: "GET",
    pathTemplate: "/ig_hashtag_search",
    inputs: {
      type: "object",
      properties: {
        q: { type: "string", description: "Hashtag name (without # symbol)" },
        user_id: { type: "string", description: "Instagram Business account ID (required for auth)" },
      },
      required: ["q", "user_id"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of hashtag objects with IDs" },
      },
    },
  },
  // ============================================
  // AUDIENCES MODULE
  // ============================================
  {
    name: "list_custom_audiences",
    title: "List Custom Audiences",
    description:
      "Get all custom audiences for an ad account.",
    httpMethod: "GET",
    pathTemplate: "/act_{adAccountId}/customaudiences",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        fields: {
          type: "string",
          description: "Comma-separated fields (name,approximate_count,data_source,delivery_status,operation_status)",
        },
        limit: { type: "integer", description: "Number of results" },
      },
      required: ["adAccountId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of custom audience objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "create_custom_audience",
    title: "Create Custom Audience",
    description:
      "Create a new custom audience from customer data, website traffic, or app activity.",
    httpMethod: "POST",
    pathTemplate: "/act_{adAccountId}/customaudiences",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        name: { type: "string", description: "Audience name" },
        description: { type: "string", description: "Audience description" },
        subtype: {
          type: "string",
          enum: ["CUSTOM", "WEBSITE", "APP", "OFFLINE_CONVERSION", "CLAIM", "ENGAGEMENT", "VIDEO", "LOOKALIKE"],
          description: "Audience subtype",
        },
        customer_file_source: {
          type: "string",
          enum: ["USER_PROVIDED_ONLY", "PARTNER_PROVIDED_ONLY", "BOTH_USER_AND_PARTNER_PROVIDED"],
          description: "Data source for customer list audiences",
        },
      },
      required: ["adAccountId", "name", "subtype"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    },
  },
  {
    name: "create_lookalike_audience",
    title: "Create Lookalike Audience",
    description:
      "Create a lookalike audience based on an existing custom audience source.",
    httpMethod: "POST",
    pathTemplate: "/act_{adAccountId}/customaudiences",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        name: { type: "string", description: "Audience name" },
        origin_audience_id: { type: "string", description: "Source audience ID" },
        subtype: { type: "string", description: "Must be LOOKALIKE" },
        lookalike_spec: {
          type: "object",
          description: "Lookalike configuration (country, ratio 0.01-0.20)",
          properties: {
            country: { type: "string", description: "Two-letter country code" },
            ratio: { type: "number", description: "Audience size ratio (0.01-0.20)" },
          },
        },
      },
      required: ["adAccountId", "name", "origin_audience_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
      },
    },
  },
  {
    name: "get_audience_estimate",
    title: "Get Audience Size Estimate",
    description:
      "Get an estimated audience size for targeting specifications.",
    httpMethod: "GET",
    pathTemplate: "/act_{adAccountId}/delivery_estimate",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        targeting_spec: {
          type: "object",
          description: "Targeting specification (geo_locations, age_min, age_max, genders, interests)",
        },
        optimization_goal: {
          type: "string",
          description: "Optimization goal for estimate",
        },
      },
      required: ["adAccountId", "targeting_spec"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of estimate objects with daily_outcomes_curve" },
      },
    },
  },
  {
    name: "delete_custom_audience",
    title: "Delete Custom Audience",
    description:
      "Delete a custom audience from the ad account.",
    httpMethod: "DELETE",
    pathTemplate: "/{audienceId}",
    inputs: {
      type: "object",
      properties: {
        audienceId: { type: "string", description: "The audience ID" },
      },
      required: ["audienceId"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "get_ad_account_insights",
    title: "Get Ad Account Insights",
    description:
      "Get aggregated performance insights across all campaigns in an ad account.",
    httpMethod: "GET",
    pathTemplate: "/act_{adAccountId}/insights",
    inputs: {
      type: "object",
      properties: {
        adAccountId: { type: "string", description: "The ad account ID" },
        fields: {
          type: "string",
          description: "Comma-separated metrics (impressions,clicks,spend,cpc,cpm,ctr,reach,conversions,cost_per_action_type)",
        },
        date_preset: {
          type: "string",
          enum: ["today", "yesterday", "last_7d", "last_14d", "last_30d", "this_month", "last_month"],
          description: "Predefined date range",
        },
        breakdowns: {
          type: "string",
          description: "Comma-separated breakdowns (age,gender,country,placement,device_platform)",
        },
        level: {
          type: "string",
          enum: ["account", "campaign", "adset", "ad"],
          description: "Aggregation level",
        },
      },
      required: ["adAccountId"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "Array of insight objects" },
        paging: { type: "object" },
      },
    },
  },
];
