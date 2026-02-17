// Canva Tool Definitions for SierraMCP seed.ts

export const canvaTools = [
  // ============================================
  // DESIGNS MODULE
  // ============================================
  {
    name: "list_designs",
    title: "List Designs",
    description:
      "Retrieve a paginated list of designs in the user's Canva account. Returns design metadata including title, type, and thumbnail.",
    httpMethod: "GET",
    pathTemplate: "/designs",
    inputs: {
      type: "object",
      properties: {
        ownership: {
          type: "string",
          enum: ["owned", "shared", "any"],
          description: "Filter by ownership type",
        },
        sort_by: {
          type: "string",
          enum: ["relevance", "modified_descending", "modified_ascending", "title_descending", "title_ascending"],
          description: "Sort order for results",
        },
        continuation: { type: "string", description: "Pagination continuation token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of design objects" },
        continuation: { type: "string", description: "Token for next page" },
      },
    },
  },
  {
    name: "get_design",
    title: "Get Design Details",
    description:
      "Get detailed information about a specific design including dimensions, page count, and thumbnail URLs.",
    httpMethod: "GET",
    pathTemplate: "/designs/{designId}",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        design: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            owner: { type: "object" },
            thumbnail: { type: "object" },
            urls: { type: "object" },
            created_at: { type: "string" },
            updated_at: { type: "string" },
            page_count: { type: "integer" },
          },
        },
      },
    },
  },
  {
    name: "create_design",
    title: "Create Design",
    description:
      "Create a new blank design with specified dimensions and title.",
    httpMethod: "POST",
    pathTemplate: "/designs",
    inputs: {
      type: "object",
      properties: {
        design_type: {
          type: "object",
          description: "Design type configuration",
          properties: {
            type: {
              type: "string",
              enum: ["preset", "custom"],
              description: "Whether to use a preset or custom dimensions",
            },
            name: { type: "string", description: "Preset name (e.g., 'Instagram Post', 'Presentation')" },
            width: { type: "integer", description: "Custom width in pixels" },
            height: { type: "integer", description: "Custom height in pixels" },
          },
        },
        title: { type: "string", description: "Design title" },
        asset_id: { type: "string", description: "Optional template asset ID to start from" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        design: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            urls: { type: "object" },
          },
        },
      },
    },
  },
  {
    name: "update_design",
    title: "Update Design",
    description:
      "Update a design's title or other metadata.",
    httpMethod: "PATCH",
    pathTemplate: "/designs/{designId}",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
        title: { type: "string", description: "New design title" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        design: { type: "object" },
      },
    },
  },
  {
    name: "delete_design",
    title: "Delete Design",
    description:
      "Move a design to the trash. Trashed designs can be recovered within 30 days.",
    httpMethod: "DELETE",
    pathTemplate: "/designs/{designId}",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "search_designs",
    title: "Search Designs",
    description:
      "Search for designs by title or keyword.",
    httpMethod: "GET",
    pathTemplate: "/designs",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        ownership: {
          type: "string",
          enum: ["owned", "shared", "any"],
          description: "Filter by ownership",
        },
        continuation: { type: "string", description: "Pagination token" },
      },
      required: ["query"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of matching design objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "duplicate_design",
    title: "Duplicate Design",
    description:
      "Create a copy of an existing design.",
    httpMethod: "POST",
    pathTemplate: "/designs/{designId}/duplicate",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID to duplicate" },
        title: { type: "string", description: "Title for the duplicated design" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        design: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            urls: { type: "object" },
          },
        },
      },
    },
  },
  {
    name: "get_design_pages",
    title: "Get Design Pages",
    description:
      "Get all pages within a multi-page design.",
    httpMethod: "GET",
    pathTemplate: "/designs/{designId}/pages",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of page objects with dimensions and thumbnails" },
      },
    },
  },
  {
    name: "add_page_to_design",
    title: "Add Page to Design",
    description:
      "Add a new blank page to a multi-page design.",
    httpMethod: "POST",
    pathTemplate: "/designs/{designId}/pages",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
        after_page_id: { type: "string", description: "Insert after this page ID" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        page: {
          type: "object",
          properties: {
            id: { type: "string" },
            index: { type: "integer" },
          },
        },
      },
    },
  },
  {
    name: "get_design_comments",
    title: "Get Design Comments",
    description:
      "Get all comments and replies on a design for collaboration workflows.",
    httpMethod: "GET",
    pathTemplate: "/designs/{designId}/comments",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
        continuation: { type: "string", description: "Pagination token" },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of comment objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "add_design_comment",
    title: "Add Design Comment",
    description:
      "Add a comment to a design for team collaboration.",
    httpMethod: "POST",
    pathTemplate: "/designs/{designId}/comments",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
        message: { type: "string", description: "Comment text" },
        assignee_id: { type: "string", description: "User ID to assign the comment to" },
      },
      required: ["designId", "message"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        message: { type: "string" },
        created_at: { type: "string" },
      },
    },
  },
  // ============================================
  // TEMPLATES MODULE
  // ============================================
  {
    name: "list_templates",
    title: "List Templates",
    description:
      "Get available design templates from the Canva template library.",
    httpMethod: "GET",
    pathTemplate: "/templates",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query for templates" },
        design_type: { type: "string", description: "Filter by design type (e.g., 'Instagram Post', 'Logo')" },
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of template objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "get_template",
    title: "Get Template Details",
    description:
      "Get detailed information about a specific template including preview images and dimensions.",
    httpMethod: "GET",
    pathTemplate: "/templates/{templateId}",
    inputs: {
      type: "object",
      properties: {
        templateId: { type: "string", description: "The template ID" },
      },
      required: ["templateId"],
    },
    outputs: {
      type: "object",
      properties: {
        template: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            thumbnail: { type: "object" },
            width: { type: "integer" },
            height: { type: "integer" },
            page_count: { type: "integer" },
          },
        },
      },
    },
  },
  {
    name: "create_design_from_template",
    title: "Create Design from Template",
    description:
      "Create a new design based on a template. The design will have all the template's elements pre-populated.",
    httpMethod: "POST",
    pathTemplate: "/designs",
    inputs: {
      type: "object",
      properties: {
        asset_id: { type: "string", description: "Template asset ID" },
        title: { type: "string", description: "Title for the new design" },
      },
      required: ["asset_id"],
    },
    outputs: {
      type: "object",
      properties: {
        design: {
          type: "object",
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            urls: { type: "object" },
          },
        },
      },
    },
  },
  {
    name: "list_brand_templates",
    title: "List Brand Templates",
    description:
      "Get templates specific to the team's brand kit.",
    httpMethod: "GET",
    pathTemplate: "/brand-templates",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of brand template objects" },
        continuation: { type: "string" },
      },
    },
  },
  // ============================================
  // BRAND KIT MODULE
  // ============================================
  {
    name: "get_brand_kit",
    title: "Get Brand Kit",
    description:
      "Get the team's brand kit including logos, colors, fonts, and brand guidelines.",
    httpMethod: "GET",
    pathTemplate: "/brand-templates/brand",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        brand: {
          type: "object",
          properties: {
            logos: { type: "array" },
            colors: { type: "array" },
            fonts: { type: "array" },
            icons: { type: "array" },
            images: { type: "array" },
          },
        },
      },
    },
  },
  {
    name: "list_brand_colors",
    title: "List Brand Colors",
    description:
      "Get the brand color palettes defined in the brand kit.",
    httpMethod: "GET",
    pathTemplate: "/brand-templates/brand/colors",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of color palette objects" },
      },
    },
  },
  {
    name: "list_brand_fonts",
    title: "List Brand Fonts",
    description:
      "Get the brand fonts configured in the brand kit.",
    httpMethod: "GET",
    pathTemplate: "/brand-templates/brand/fonts",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of font objects with styles" },
      },
    },
  },
  {
    name: "list_brand_logos",
    title: "List Brand Logos",
    description:
      "Get all logos uploaded to the brand kit.",
    httpMethod: "GET",
    pathTemplate: "/brand-templates/brand/logos",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of logo asset objects" },
      },
    },
  },
  {
    name: "list_brand_images",
    title: "List Brand Images",
    description:
      "Get all images uploaded to the brand kit for use in designs.",
    httpMethod: "GET",
    pathTemplate: "/brand-templates/brand/images",
    inputs: {
      type: "object",
      properties: {
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of brand image objects" },
        continuation: { type: "string" },
      },
    },
  },
  // ============================================
  // FOLDERS MODULE
  // ============================================
  {
    name: "list_folders",
    title: "List Folders",
    description:
      "Get all folders in the user's Canva account for organizing designs.",
    httpMethod: "GET",
    pathTemplate: "/folders",
    inputs: {
      type: "object",
      properties: {
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of folder objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "get_folder",
    title: "Get Folder Details",
    description:
      "Get details of a specific folder including its contents.",
    httpMethod: "GET",
    pathTemplate: "/folders/{folderId}",
    inputs: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "The folder ID" },
      },
      required: ["folderId"],
    },
    outputs: {
      type: "object",
      properties: {
        folder: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            created_at: { type: "string" },
            updated_at: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "create_folder",
    title: "Create Folder",
    description:
      "Create a new folder to organize designs.",
    httpMethod: "POST",
    pathTemplate: "/folders",
    inputs: {
      type: "object",
      properties: {
        name: { type: "string", description: "Folder name" },
        parent_folder_id: { type: "string", description: "Parent folder ID for nesting" },
      },
      required: ["name"],
    },
    outputs: {
      type: "object",
      properties: {
        folder: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "update_folder",
    title: "Update Folder",
    description:
      "Update a folder's name.",
    httpMethod: "PATCH",
    pathTemplate: "/folders/{folderId}",
    inputs: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "The folder ID" },
        name: { type: "string", description: "New folder name" },
      },
      required: ["folderId", "name"],
    },
    outputs: {
      type: "object",
      properties: {
        folder: { type: "object" },
      },
    },
  },
  {
    name: "delete_folder",
    title: "Delete Folder",
    description:
      "Delete a folder. Designs inside are moved to the root level, not deleted.",
    httpMethod: "DELETE",
    pathTemplate: "/folders/{folderId}",
    inputs: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "The folder ID" },
      },
      required: ["folderId"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "get_folder_items",
    title: "Get Folder Items",
    description:
      "Get all items (designs and sub-folders) within a folder.",
    httpMethod: "GET",
    pathTemplate: "/folders/{folderId}/items",
    inputs: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "The folder ID" },
        item_type: {
          type: "string",
          enum: ["design", "folder", "any"],
          description: "Filter by item type",
        },
        continuation: { type: "string", description: "Pagination token" },
      },
      required: ["folderId"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of item objects (designs and folders)" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "move_design_to_folder",
    title: "Move Design to Folder",
    description:
      "Move a design into a specific folder.",
    httpMethod: "POST",
    pathTemplate: "/folders/{folderId}/items",
    inputs: {
      type: "object",
      properties: {
        folderId: { type: "string", description: "Target folder ID" },
        item_id: { type: "string", description: "Design ID to move" },
        item_type: { type: "string", description: "Must be 'design'" },
      },
      required: ["folderId", "item_id"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  // ============================================
  // EXPORT MODULE
  // ============================================
  {
    name: "create_export",
    title: "Create Export Job",
    description:
      "Start an export job to render a design to a file format (PNG, JPG, PDF, MP4, GIF, PPTX).",
    httpMethod: "POST",
    pathTemplate: "/exports",
    inputs: {
      type: "object",
      properties: {
        design_id: { type: "string", description: "The design ID to export" },
        format: {
          type: "object",
          description: "Export format configuration",
          properties: {
            type: {
              type: "string",
              enum: ["png", "jpg", "pdf", "mp4", "gif", "pptx"],
              description: "Export format type",
            },
            quality: {
              type: "string",
              enum: ["low", "medium", "high"],
              description: "Export quality (for image formats)",
            },
            size: {
              type: "string",
              enum: ["small", "medium", "large", "original"],
              description: "Export size",
            },
            lossless: { type: "boolean", description: "Use lossless compression (PNG)" },
          },
        },
        pages: {
          type: "array",
          items: { type: "integer" },
          description: "Page indices to export (0-based, empty = all pages)",
        },
      },
      required: ["design_id", "format"],
    },
    outputs: {
      type: "object",
      properties: {
        job: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "get_export",
    title: "Get Export Status",
    description:
      "Check the status of an export job and get the download URL when complete.",
    httpMethod: "GET",
    pathTemplate: "/exports/{exportId}",
    inputs: {
      type: "object",
      properties: {
        exportId: { type: "string", description: "The export job ID" },
      },
      required: ["exportId"],
    },
    outputs: {
      type: "object",
      properties: {
        job: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: { type: "string", description: "in_progress, success, or failed" },
            urls: { type: "array", description: "Download URLs when status is success" },
            error: { type: "object", description: "Error details if status is failed" },
          },
        },
      },
    },
  },
  {
    name: "list_exports",
    title: "List Exports",
    description:
      "Get a list of recent export jobs with their statuses.",
    httpMethod: "GET",
    pathTemplate: "/exports",
    inputs: {
      type: "object",
      properties: {
        design_id: { type: "string", description: "Filter by design ID" },
        status: {
          type: "string",
          enum: ["in_progress", "success", "failed"],
          description: "Filter by export status",
        },
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of export job objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "upload_asset",
    title: "Upload Asset",
    description:
      "Upload an image or video asset to use in Canva designs.",
    httpMethod: "POST",
    pathTemplate: "/assets/upload",
    inputs: {
      type: "object",
      properties: {
        url: { type: "string", description: "Public URL of the asset to upload" },
        name: { type: "string", description: "Asset name" },
        folder_id: { type: "string", description: "Folder to upload to" },
      },
      required: ["url"],
    },
    outputs: {
      type: "object",
      properties: {
        asset: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            type: { type: "string" },
            thumbnail_url: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "list_assets",
    title: "List Assets",
    description:
      "Get all uploaded assets in the user's media library.",
    httpMethod: "GET",
    pathTemplate: "/assets",
    inputs: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["image", "video"],
          description: "Filter by asset type",
        },
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of asset objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "delete_asset",
    title: "Delete Asset",
    description:
      "Delete an uploaded asset from the media library.",
    httpMethod: "DELETE",
    pathTemplate: "/assets/{assetId}",
    inputs: {
      type: "object",
      properties: {
        assetId: { type: "string", description: "The asset ID" },
      },
      required: ["assetId"],
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean" },
      },
    },
  },
  {
    name: "get_user_profile",
    title: "Get User Profile",
    description:
      "Get the authenticated user's Canva profile information.",
    httpMethod: "GET",
    pathTemplate: "/users/me",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        profile: {
          type: "object",
          properties: {
            id: { type: "string" },
            display_name: { type: "string" },
            email: { type: "string" },
            team_id: { type: "string" },
          },
        },
      },
    },
  },
  {
    name: "list_team_members",
    title: "List Team Members",
    description:
      "Get all members of the user's Canva team.",
    httpMethod: "GET",
    pathTemplate: "/teams/members",
    inputs: {
      type: "object",
      properties: {
        continuation: { type: "string", description: "Pagination token" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of team member objects" },
        continuation: { type: "string" },
      },
    },
  },
  {
    name: "share_design",
    title: "Share Design",
    description:
      "Share a design with team members or external collaborators.",
    httpMethod: "POST",
    pathTemplate: "/designs/{designId}/share",
    inputs: {
      type: "object",
      properties: {
        designId: { type: "string", description: "The design ID" },
        users: {
          type: "array",
          items: {
            type: "object",
            properties: {
              user_id: { type: "string", description: "User ID or email" },
              role: {
                type: "string",
                enum: ["viewer", "editor", "template_user"],
                description: "Permission level",
              },
            },
          },
          description: "Users to share with",
        },
        link_role: {
          type: "string",
          enum: ["viewer", "editor", "template_user"],
          description: "Default role for link sharing",
        },
      },
      required: ["designId"],
    },
    outputs: {
      type: "object",
      properties: {
        share_link: { type: "string", description: "Shareable link" },
      },
    },
  },
];
