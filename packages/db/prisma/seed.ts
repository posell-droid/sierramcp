import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

// ============================================
// APPLICATION TEMPLATES
// ============================================

const shopifyDefaultTools = [
  {
    name: "list_products",
    title: "List Products",
    description: "Retrieve a list of products from the Shopify store",
    httpMethod: "GET",
    pathTemplate: "/products.json",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max products to return (default 50, max 250)" },
        since_id: { type: "string", description: "Return products after this ID" },
        status: { type: "string", enum: ["active", "archived", "draft"], description: "Filter by product status" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        products: { type: "array", description: "Array of product objects" }
      }
    }
  },
  {
    name: "get_product",
    title: "Get Product",
    description: "Retrieve a single product by ID",
    httpMethod: "GET",
    pathTemplate: "/products/{product_id}.json",
    inputs: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The product ID" }
      },
      required: ["product_id"]
    },
    outputs: {
      type: "object",
      properties: {
        product: { type: "object", description: "Product object" }
      }
    }
  },
  {
    name: "create_product",
    title: "Create Product",
    description: "Create a new product in the Shopify store",
    httpMethod: "POST",
    pathTemplate: "/products.json",
    inputs: {
      type: "object",
      properties: {
        product: {
          type: "object",
          properties: {
            title: { type: "string", description: "Product title" },
            body_html: { type: "string", description: "Product description (HTML)" },
            vendor: { type: "string", description: "Product vendor" },
            product_type: { type: "string", description: "Product type" },
            status: { type: "string", enum: ["active", "archived", "draft"] }
          },
          required: ["title"]
        }
      },
      required: ["product"]
    },
    outputs: {
      type: "object",
      properties: {
        product: { type: "object", description: "Created product object" }
      }
    }
  },
  {
    name: "update_product",
    title: "Update Product",
    description: "Update an existing product",
    httpMethod: "PUT",
    pathTemplate: "/products/{product_id}.json",
    inputs: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The product ID" },
        product: {
          type: "object",
          properties: {
            title: { type: "string", description: "Product title" },
            body_html: { type: "string", description: "Product description (HTML)" },
            vendor: { type: "string", description: "Product vendor" },
            status: { type: "string", enum: ["active", "archived", "draft"] }
          }
        }
      },
      required: ["product_id", "product"]
    },
    outputs: {
      type: "object",
      properties: {
        product: { type: "object", description: "Updated product object" }
      }
    }
  },
  {
    name: "delete_product",
    title: "Delete Product",
    description: "Delete a product from the store",
    httpMethod: "DELETE",
    pathTemplate: "/products/{product_id}.json",
    inputs: {
      type: "object",
      properties: {
        product_id: { type: "string", description: "The product ID to delete" }
      },
      required: ["product_id"]
    },
    outputs: {
      type: "object",
      properties: {
        success: { type: "boolean", description: "Whether deletion was successful" }
      }
    }
  },
  {
    name: "list_orders",
    title: "List Orders",
    description: "Retrieve a list of orders from the store",
    httpMethod: "GET",
    pathTemplate: "/orders.json",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max orders to return (default 50, max 250)" },
        status: { type: "string", enum: ["open", "closed", "cancelled", "any"], description: "Filter by order status" },
        financial_status: { type: "string", enum: ["pending", "authorized", "paid", "refunded", "voided"], description: "Filter by financial status" },
        created_at_min: { type: "string", description: "Show orders created after date (ISO 8601)" },
        created_at_max: { type: "string", description: "Show orders created before date (ISO 8601)" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        orders: { type: "array", description: "Array of order objects" }
      }
    }
  },
  {
    name: "get_order",
    title: "Get Order",
    description: "Retrieve a single order by ID",
    httpMethod: "GET",
    pathTemplate: "/orders/{order_id}.json",
    inputs: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID" }
      },
      required: ["order_id"]
    },
    outputs: {
      type: "object",
      properties: {
        order: { type: "object", description: "Order object with full details" }
      }
    }
  },
  {
    name: "create_order",
    title: "Create Order",
    description: "Create a new order",
    httpMethod: "POST",
    pathTemplate: "/orders.json",
    inputs: {
      type: "object",
      properties: {
        order: {
          type: "object",
          properties: {
            line_items: { type: "array", description: "Array of line items" },
            customer: { type: "object", description: "Customer info" },
            billing_address: { type: "object", description: "Billing address" },
            shipping_address: { type: "object", description: "Shipping address" },
            financial_status: { type: "string", enum: ["pending", "authorized", "paid"] }
          },
          required: ["line_items"]
        }
      },
      required: ["order"]
    },
    outputs: {
      type: "object",
      properties: {
        order: { type: "object", description: "Created order object" }
      }
    }
  },
  {
    name: "update_order",
    title: "Update Order",
    description: "Update an existing order",
    httpMethod: "PUT",
    pathTemplate: "/orders/{order_id}.json",
    inputs: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID" },
        order: {
          type: "object",
          properties: {
            note: { type: "string", description: "Order note" },
            tags: { type: "string", description: "Comma-separated tags" },
            shipping_address: { type: "object", description: "Updated shipping address" }
          }
        }
      },
      required: ["order_id", "order"]
    },
    outputs: {
      type: "object",
      properties: {
        order: { type: "object", description: "Updated order object" }
      }
    }
  },
  {
    name: "close_order",
    title: "Close Order",
    description: "Close an order (mark as completed)",
    httpMethod: "POST",
    pathTemplate: "/orders/{order_id}/close.json",
    inputs: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID to close" }
      },
      required: ["order_id"]
    },
    outputs: {
      type: "object",
      properties: {
        order: { type: "object", description: "Closed order object" }
      }
    }
  },
  {
    name: "list_customers",
    title: "List Customers",
    description: "Retrieve a list of customers",
    httpMethod: "GET",
    pathTemplate: "/customers.json",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max customers to return (default 50, max 250)" },
        since_id: { type: "string", description: "Return customers after this ID" },
        created_at_min: { type: "string", description: "Show customers created after date" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        customers: { type: "array", description: "Array of customer objects" }
      }
    }
  },
  {
    name: "get_customer",
    title: "Get Customer",
    description: "Retrieve a single customer by ID",
    httpMethod: "GET",
    pathTemplate: "/customers/{customer_id}.json",
    inputs: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer ID" }
      },
      required: ["customer_id"]
    },
    outputs: {
      type: "object",
      properties: {
        customer: { type: "object", description: "Customer object" }
      }
    }
  },
  {
    name: "create_customer",
    title: "Create Customer",
    description: "Create a new customer",
    httpMethod: "POST",
    pathTemplate: "/customers.json",
    inputs: {
      type: "object",
      properties: {
        customer: {
          type: "object",
          properties: {
            first_name: { type: "string", description: "Customer first name" },
            last_name: { type: "string", description: "Customer last name" },
            email: { type: "string", description: "Customer email" },
            phone: { type: "string", description: "Customer phone" },
            tags: { type: "string", description: "Comma-separated tags" }
          },
          required: ["email"]
        }
      },
      required: ["customer"]
    },
    outputs: {
      type: "object",
      properties: {
        customer: { type: "object", description: "Created customer object" }
      }
    }
  },
  {
    name: "update_customer",
    title: "Update Customer",
    description: "Update an existing customer",
    httpMethod: "PUT",
    pathTemplate: "/customers/{customer_id}.json",
    inputs: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer ID" },
        customer: {
          type: "object",
          properties: {
            first_name: { type: "string" },
            last_name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            tags: { type: "string" }
          }
        }
      },
      required: ["customer_id", "customer"]
    },
    outputs: {
      type: "object",
      properties: {
        customer: { type: "object", description: "Updated customer object" }
      }
    }
  },
  {
    name: "list_inventory_levels",
    title: "List Inventory Levels",
    description: "Retrieve inventory levels for products",
    httpMethod: "GET",
    pathTemplate: "/inventory_levels.json",
    inputs: {
      type: "object",
      properties: {
        location_ids: { type: "string", description: "Comma-separated location IDs" },
        inventory_item_ids: { type: "string", description: "Comma-separated inventory item IDs" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        inventory_levels: { type: "array", description: "Array of inventory level objects" }
      }
    }
  },
  {
    name: "adjust_inventory_level",
    title: "Adjust Inventory Level",
    description: "Adjust the inventory level for an item at a location",
    httpMethod: "POST",
    pathTemplate: "/inventory_levels/adjust.json",
    inputs: {
      type: "object",
      properties: {
        location_id: { type: "integer", description: "Location ID" },
        inventory_item_id: { type: "integer", description: "Inventory item ID" },
        available_adjustment: { type: "integer", description: "Quantity to adjust (positive or negative)" }
      },
      required: ["location_id", "inventory_item_id", "available_adjustment"]
    },
    outputs: {
      type: "object",
      properties: {
        inventory_level: { type: "object", description: "Updated inventory level" }
      }
    }
  },
  {
    name: "list_collections",
    title: "List Collections",
    description: "Retrieve all collections (custom and smart)",
    httpMethod: "GET",
    pathTemplate: "/collections.json",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max collections to return" },
        since_id: { type: "string", description: "Return collections after this ID" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        collections: { type: "array", description: "Array of collection objects" }
      }
    }
  },
  {
    name: "get_collection",
    title: "Get Collection",
    description: "Retrieve a single collection by ID",
    httpMethod: "GET",
    pathTemplate: "/collections/{collection_id}.json",
    inputs: {
      type: "object",
      properties: {
        collection_id: { type: "string", description: "The collection ID" }
      },
      required: ["collection_id"]
    },
    outputs: {
      type: "object",
      properties: {
        collection: { type: "object", description: "Collection object" }
      }
    }
  },
  {
    name: "list_fulfillments",
    title: "List Fulfillments",
    description: "Retrieve fulfillments for an order",
    httpMethod: "GET",
    pathTemplate: "/orders/{order_id}/fulfillments.json",
    inputs: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "The order ID" }
      },
      required: ["order_id"]
    },
    outputs: {
      type: "object",
      properties: {
        fulfillments: { type: "array", description: "Array of fulfillment objects" }
      }
    }
  },
  {
    name: "create_fulfillment",
    title: "Create Fulfillment",
    description: "Create a fulfillment for an order",
    httpMethod: "POST",
    pathTemplate: "/fulfillments.json",
    inputs: {
      type: "object",
      properties: {
        fulfillment: {
          type: "object",
          properties: {
            order_id: { type: "integer", description: "Order ID" },
            location_id: { type: "integer", description: "Location ID to fulfill from" },
            tracking_number: { type: "string", description: "Tracking number" },
            tracking_company: { type: "string", description: "Shipping carrier" },
            line_items: { type: "array", description: "Line items to fulfill" }
          },
          required: ["order_id"]
        }
      },
      required: ["fulfillment"]
    },
    outputs: {
      type: "object",
      properties: {
        fulfillment: { type: "object", description: "Created fulfillment object" }
      }
    }
  },
  {
    name: "list_locations",
    title: "List Locations",
    description: "Retrieve all locations for the store",
    httpMethod: "GET",
    pathTemplate: "/locations.json",
    inputs: {
      type: "object",
      properties: {}
    },
    outputs: {
      type: "object",
      properties: {
        locations: { type: "array", description: "Array of location objects" }
      }
    }
  },
  {
    name: "get_shop",
    title: "Get Shop Info",
    description: "Retrieve shop configuration and details",
    httpMethod: "GET",
    pathTemplate: "/shop.json",
    inputs: {
      type: "object",
      properties: {}
    },
    outputs: {
      type: "object",
      properties: {
        shop: { type: "object", description: "Shop configuration object" }
      }
    }
  },
  {
    name: "list_draft_orders",
    title: "List Draft Orders",
    description: "Retrieve all draft orders",
    httpMethod: "GET",
    pathTemplate: "/draft_orders.json",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Max draft orders to return" },
        status: { type: "string", enum: ["open", "invoice_sent", "completed"], description: "Filter by status" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        draft_orders: { type: "array", description: "Array of draft order objects" }
      }
    }
  },
  {
    name: "create_draft_order",
    title: "Create Draft Order",
    description: "Create a new draft order",
    httpMethod: "POST",
    pathTemplate: "/draft_orders.json",
    inputs: {
      type: "object",
      properties: {
        draft_order: {
          type: "object",
          properties: {
            line_items: { type: "array", description: "Array of line items" },
            customer: { type: "object", description: "Customer info" },
            note: { type: "string", description: "Order note" },
            shipping_address: { type: "object", description: "Shipping address" }
          },
          required: ["line_items"]
        }
      },
      required: ["draft_order"]
    },
    outputs: {
      type: "object",
      properties: {
        draft_order: { type: "object", description: "Created draft order object" }
      }
    }
  },
  {
    name: "list_webhooks",
    title: "List Webhooks",
    description: "Retrieve all registered webhooks",
    httpMethod: "GET",
    pathTemplate: "/webhooks.json",
    inputs: {
      type: "object",
      properties: {}
    },
    outputs: {
      type: "object",
      properties: {
        webhooks: { type: "array", description: "Array of webhook objects" }
      }
    }
  }
];

const amazonFbaDefaultTools = [
  {
    name: "get_inventory_summaries",
    title: "Get Inventory Summaries",
    description: "Returns a list of inventory summaries for FBA inventory. Use this to check stock levels, available inventory, and inbound quantities.",
    httpMethod: "GET",
    pathTemplate: "/fba/inventory/v1/summaries",
    inputs: {
      type: "object",
      properties: {
        details: { type: "boolean", description: "Return granular inventory details (default false)" },
        granularityType: { type: "string", enum: ["Marketplace"], description: "Granularity type for the inventory aggregation level" },
        granularityId: { type: "string", description: "Marketplace ID for the inventory" },
        startDateTime: { type: "string", description: "Start date/time for inventory data (ISO 8601)" },
        sellerSkus: { type: "array", items: { type: "string" }, description: "List of seller SKUs to filter by (max 50)" },
        nextToken: { type: "string", description: "Pagination token from previous response" },
        marketplaceIds: { type: "array", items: { type: "string" }, description: "List of marketplace IDs (required)" }
      },
      required: ["marketplaceIds", "granularityType", "granularityId"]
    },
    outputs: {
      type: "object",
      properties: {
        inventorySummaries: { type: "array", description: "List of inventory summary objects" },
        nextToken: { type: "string", description: "Token for next page of results" }
      }
    }
  },
  {
    name: "get_orders",
    title: "Get Orders",
    description: "Returns orders created or updated during the time frame indicated by the specified parameters. Use this to list recent orders with filters.",
    httpMethod: "GET",
    pathTemplate: "/orders/v0/orders",
    inputs: {
      type: "object",
      properties: {
        marketplaceIds: { type: "array", items: { type: "string" }, description: "List of marketplace IDs (required)" },
        createdAfter: { type: "string", description: "Return orders created after this date (ISO 8601)" },
        createdBefore: { type: "string", description: "Return orders created before this date (ISO 8601)" },
        lastUpdatedAfter: { type: "string", description: "Return orders updated after this date (ISO 8601)" },
        lastUpdatedBefore: { type: "string", description: "Return orders updated before this date (ISO 8601)" },
        orderStatuses: { type: "array", items: { type: "string" }, description: "Filter by order status (Pending, Unshipped, PartiallyShipped, Shipped, Canceled, etc.)" },
        fulfillmentChannels: { type: "array", items: { type: "string" }, description: "Filter by fulfillment channel (AFN for FBA, MFN for merchant)" },
        paymentMethods: { type: "array", items: { type: "string" }, description: "Filter by payment method" },
        maxResultsPerPage: { type: "integer", description: "Max results per page (1-100, default 100)" },
        nextToken: { type: "string", description: "Pagination token from previous response" }
      },
      required: ["marketplaceIds"]
    },
    outputs: {
      type: "object",
      properties: {
        orders: { type: "array", description: "List of order objects" },
        nextToken: { type: "string", description: "Token for next page of results" }
      }
    }
  },
  {
    name: "get_order",
    title: "Get Order",
    description: "Returns the order that you specify by order ID",
    httpMethod: "GET",
    pathTemplate: "/orders/v0/orders/{orderId}",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Amazon order ID (e.g., 123-1234567-1234567)" }
      },
      required: ["orderId"]
    },
    outputs: {
      type: "object",
      properties: {
        order: { type: "object", description: "Order details including status, shipping info, and totals" }
      }
    }
  },
  {
    name: "get_order_items",
    title: "Get Order Items",
    description: "Returns detailed order item information for the order that you specify",
    httpMethod: "GET",
    pathTemplate: "/orders/v0/orders/{orderId}/orderItems",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "Amazon order ID" },
        nextToken: { type: "string", description: "Pagination token from previous response" }
      },
      required: ["orderId"]
    },
    outputs: {
      type: "object",
      properties: {
        orderItems: { type: "array", description: "List of order item objects with ASIN, quantity, price, etc." },
        nextToken: { type: "string", description: "Token for next page of results" }
      }
    }
  },
  {
    name: "get_fulfillment_order",
    title: "Get Fulfillment Order",
    description: "Returns a fulfillment order with the specified fulfillment order ID. Use this for Multi-Channel Fulfillment (MCF) orders.",
    httpMethod: "GET",
    pathTemplate: "/fba/outbound/2020-07-01/fulfillmentOrders/{sellerFulfillmentOrderId}",
    inputs: {
      type: "object",
      properties: {
        sellerFulfillmentOrderId: { type: "string", description: "The fulfillment order identifier that you created" }
      },
      required: ["sellerFulfillmentOrderId"]
    },
    outputs: {
      type: "object",
      properties: {
        fulfillmentOrder: { type: "object", description: "Fulfillment order details" },
        fulfillmentOrderItems: { type: "array", description: "Items in the fulfillment order" },
        fulfillmentShipments: { type: "array", description: "Shipment information" }
      }
    }
  },
  {
    name: "get_package_tracking",
    title: "Get Package Tracking",
    description: "Returns delivery tracking information for a package in an outbound shipment for MCF orders",
    httpMethod: "GET",
    pathTemplate: "/fba/outbound/2020-07-01/tracking",
    inputs: {
      type: "object",
      properties: {
        packageNumber: { type: "integer", description: "The unencrypted package identifier returned by the getFulfillmentOrder operation" }
      },
      required: ["packageNumber"]
    },
    outputs: {
      type: "object",
      properties: {
        packageNumber: { type: "integer", description: "Package number" },
        trackingNumber: { type: "string", description: "Carrier tracking number" },
        carrierCode: { type: "string", description: "Shipping carrier code" },
        trackingEvents: { type: "array", description: "List of tracking events" }
      }
    }
  },
  {
    name: "get_listings_item",
    title: "Get Listings Item",
    description: "Returns details about a listings item for a selling partner",
    httpMethod: "GET",
    pathTemplate: "/listings/2021-08-01/items/{sellerId}/{sku}",
    inputs: {
      type: "object",
      properties: {
        sellerId: { type: "string", description: "Selling partner identifier" },
        sku: { type: "string", description: "Seller SKU of the listings item" },
        marketplaceIds: { type: "array", items: { type: "string" }, description: "List of marketplace IDs (required)" },
        includedData: { type: "array", items: { type: "string" }, description: "Data sets to include (summaries, attributes, issues, offers, fulfillmentAvailability, procurement)" }
      },
      required: ["sellerId", "sku", "marketplaceIds"]
    },
    outputs: {
      type: "object",
      properties: {
        sku: { type: "string", description: "Seller SKU" },
        summaries: { type: "array", description: "Listing summaries by marketplace" },
        attributes: { type: "object", description: "Listing attributes" },
        issues: { type: "array", description: "Issues affecting the listing" },
        offers: { type: "array", description: "Offers for the listing" }
      }
    }
  },
  {
    name: "search_catalog_items",
    title: "Search Catalog Items",
    description: "Search for Amazon catalog items by ASIN, keyword, or other identifiers",
    httpMethod: "GET",
    pathTemplate: "/catalog/2022-04-01/items",
    inputs: {
      type: "object",
      properties: {
        keywords: { type: "array", items: { type: "string" }, description: "Keywords to search (use with keywordsLocale)" },
        keywordsLocale: { type: "string", description: "Locale of the keywords (e.g., en_US)" },
        marketplaceIds: { type: "array", items: { type: "string" }, description: "List of marketplace IDs (required)" },
        includedData: { type: "array", items: { type: "string" }, description: "Data sets to include (identifiers, images, productTypes, salesRanks, summaries, variations, vendorDetails)" },
        brandNames: { type: "array", items: { type: "string" }, description: "Filter by brand names" },
        classificationIds: { type: "array", items: { type: "string" }, description: "Filter by classification IDs" },
        pageSize: { type: "integer", description: "Results per page (1-20, default 10)" },
        pageToken: { type: "string", description: "Pagination token" },
        identifiers: { type: "array", items: { type: "string" }, description: "Product identifiers (ASINs, UPCs, etc.)" },
        identifiersType: { type: "string", enum: ["ASIN", "EAN", "GTIN", "ISBN", "JAN", "MINSAN", "SKU", "UPC"], description: "Type of identifiers provided" }
      },
      required: ["marketplaceIds"]
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "List of catalog items matching search criteria" },
        pagination: { type: "object", description: "Pagination info with nextToken" }
      }
    }
  }
];

const quickbooksDefaultTools = [
  {
    name: "get_company_info",
    title: "Get Company Info",
    description: "Retrieve company information and settings",
    httpMethod: "GET",
    pathTemplate: "/companyinfo/{companyId}",
    inputs: {
      type: "object",
      properties: {
        companyId: { type: "string", description: "The company (realm) ID" }
      },
      required: ["companyId"]
    },
    outputs: {
      type: "object",
      properties: {
        CompanyInfo: { type: "object", description: "Company information object" }
      }
    }
  },
  {
    name: "list_customers",
    title: "List Customers",
    description: "Query all customers from QuickBooks",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Customer" },
        maxResults: { type: "integer", description: "Maximum results to return" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Customer array" }
      }
    }
  },
  {
    name: "get_customer",
    title: "Get Customer",
    description: "Retrieve a single customer by ID",
    httpMethod: "GET",
    pathTemplate: "/customer/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Customer ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Customer: { type: "object", description: "Customer object" }
      }
    }
  },
  {
    name: "create_customer",
    title: "Create Customer",
    description: "Create a new customer in QuickBooks",
    httpMethod: "POST",
    pathTemplate: "/customer",
    inputs: {
      type: "object",
      properties: {
        DisplayName: { type: "string", description: "Customer display name (required)" },
        PrimaryEmailAddr: { type: "object", properties: { Address: { type: "string" } } },
        PrimaryPhone: { type: "object", properties: { FreeFormNumber: { type: "string" } } },
        BillAddr: { type: "object", description: "Billing address" },
        CompanyName: { type: "string", description: "Company name" }
      },
      required: ["DisplayName"]
    },
    outputs: {
      type: "object",
      properties: {
        Customer: { type: "object", description: "Created customer object" }
      }
    }
  },
  {
    name: "update_customer",
    title: "Update Customer",
    description: "Update an existing customer (requires Id and SyncToken)",
    httpMethod: "POST",
    pathTemplate: "/customer",
    inputs: {
      type: "object",
      properties: {
        Id: { type: "string", description: "Customer ID" },
        SyncToken: { type: "string", description: "Sync token for optimistic locking" },
        DisplayName: { type: "string" },
        PrimaryEmailAddr: { type: "object" },
        PrimaryPhone: { type: "object" },
        sparse: { type: "boolean", description: "If true, only update provided fields" }
      },
      required: ["Id", "SyncToken"]
    },
    outputs: {
      type: "object",
      properties: {
        Customer: { type: "object", description: "Updated customer object" }
      }
    }
  },
  {
    name: "list_invoices",
    title: "List Invoices",
    description: "Query all invoices from QuickBooks",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Invoice" },
        maxResults: { type: "integer", description: "Maximum results to return" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Invoice array" }
      }
    }
  },
  {
    name: "get_invoice",
    title: "Get Invoice",
    description: "Retrieve a single invoice by ID",
    httpMethod: "GET",
    pathTemplate: "/invoice/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Invoice ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Invoice: { type: "object", description: "Invoice object" }
      }
    }
  },
  {
    name: "create_invoice",
    title: "Create Invoice",
    description: "Create a new invoice",
    httpMethod: "POST",
    pathTemplate: "/invoice",
    inputs: {
      type: "object",
      properties: {
        CustomerRef: { type: "object", properties: { value: { type: "string" } }, description: "Customer reference" },
        Line: { type: "array", description: "Invoice line items" },
        DueDate: { type: "string", description: "Due date (YYYY-MM-DD)" },
        DocNumber: { type: "string", description: "Invoice number" }
      },
      required: ["CustomerRef", "Line"]
    },
    outputs: {
      type: "object",
      properties: {
        Invoice: { type: "object", description: "Created invoice object" }
      }
    }
  },
  {
    name: "update_invoice",
    title: "Update Invoice",
    description: "Update an existing invoice (requires Id and SyncToken)",
    httpMethod: "POST",
    pathTemplate: "/invoice",
    inputs: {
      type: "object",
      properties: {
        Id: { type: "string", description: "Invoice ID" },
        SyncToken: { type: "string", description: "Sync token" },
        Line: { type: "array", description: "Updated line items" },
        sparse: { type: "boolean", description: "If true, only update provided fields" }
      },
      required: ["Id", "SyncToken"]
    },
    outputs: {
      type: "object",
      properties: {
        Invoice: { type: "object", description: "Updated invoice object" }
      }
    }
  },
  {
    name: "send_invoice",
    title: "Send Invoice",
    description: "Send an invoice via email",
    httpMethod: "POST",
    pathTemplate: "/invoice/{id}/send",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Invoice ID" },
        sendTo: { type: "string", description: "Email address to send to (optional, uses customer email by default)" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Invoice: { type: "object", description: "Sent invoice object" }
      }
    }
  },
  {
    name: "list_payments",
    title: "List Payments",
    description: "Query all payments from QuickBooks",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Payment" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Payment array" }
      }
    }
  },
  {
    name: "get_payment",
    title: "Get Payment",
    description: "Retrieve a single payment by ID",
    httpMethod: "GET",
    pathTemplate: "/payment/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Payment ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Payment: { type: "object", description: "Payment object" }
      }
    }
  },
  {
    name: "create_payment",
    title: "Create Payment",
    description: "Record a new payment",
    httpMethod: "POST",
    pathTemplate: "/payment",
    inputs: {
      type: "object",
      properties: {
        CustomerRef: { type: "object", properties: { value: { type: "string" } } },
        TotalAmt: { type: "number", description: "Payment amount" },
        Line: { type: "array", description: "Payment application lines (link to invoices)" }
      },
      required: ["CustomerRef", "TotalAmt"]
    },
    outputs: {
      type: "object",
      properties: {
        Payment: { type: "object", description: "Created payment object" }
      }
    }
  },
  {
    name: "list_vendors",
    title: "List Vendors",
    description: "Query all vendors from QuickBooks",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Vendor" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Vendor array" }
      }
    }
  },
  {
    name: "get_vendor",
    title: "Get Vendor",
    description: "Retrieve a single vendor by ID",
    httpMethod: "GET",
    pathTemplate: "/vendor/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Vendor ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Vendor: { type: "object", description: "Vendor object" }
      }
    }
  },
  {
    name: "create_vendor",
    title: "Create Vendor",
    description: "Create a new vendor",
    httpMethod: "POST",
    pathTemplate: "/vendor",
    inputs: {
      type: "object",
      properties: {
        DisplayName: { type: "string", description: "Vendor display name" },
        PrimaryEmailAddr: { type: "object" },
        PrimaryPhone: { type: "object" },
        CompanyName: { type: "string" }
      },
      required: ["DisplayName"]
    },
    outputs: {
      type: "object",
      properties: {
        Vendor: { type: "object", description: "Created vendor object" }
      }
    }
  },
  {
    name: "list_bills",
    title: "List Bills",
    description: "Query all bills from QuickBooks",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Bill" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Bill array" }
      }
    }
  },
  {
    name: "get_bill",
    title: "Get Bill",
    description: "Retrieve a single bill by ID",
    httpMethod: "GET",
    pathTemplate: "/bill/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Bill ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Bill: { type: "object", description: "Bill object" }
      }
    }
  },
  {
    name: "create_bill",
    title: "Create Bill",
    description: "Create a new bill (accounts payable)",
    httpMethod: "POST",
    pathTemplate: "/bill",
    inputs: {
      type: "object",
      properties: {
        VendorRef: { type: "object", properties: { value: { type: "string" } } },
        Line: { type: "array", description: "Bill line items" },
        DueDate: { type: "string", description: "Due date (YYYY-MM-DD)" }
      },
      required: ["VendorRef", "Line"]
    },
    outputs: {
      type: "object",
      properties: {
        Bill: { type: "object", description: "Created bill object" }
      }
    }
  },
  {
    name: "list_items",
    title: "List Items",
    description: "Query all items (products/services) from QuickBooks",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Item" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Item array" }
      }
    }
  },
  {
    name: "get_item",
    title: "Get Item",
    description: "Retrieve a single item by ID",
    httpMethod: "GET",
    pathTemplate: "/item/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Item ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Item: { type: "object", description: "Item object" }
      }
    }
  },
  {
    name: "create_item",
    title: "Create Item",
    description: "Create a new item (product or service)",
    httpMethod: "POST",
    pathTemplate: "/item",
    inputs: {
      type: "object",
      properties: {
        Name: { type: "string", description: "Item name" },
        Type: { type: "string", enum: ["Service", "Inventory", "NonInventory"], description: "Item type" },
        IncomeAccountRef: { type: "object", description: "Income account reference" },
        ExpenseAccountRef: { type: "object", description: "Expense account reference (for inventory)" },
        UnitPrice: { type: "number", description: "Sales price" }
      },
      required: ["Name", "Type"]
    },
    outputs: {
      type: "object",
      properties: {
        Item: { type: "object", description: "Created item object" }
      }
    }
  },
  {
    name: "list_accounts",
    title: "List Accounts",
    description: "Query all accounts (chart of accounts)",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Account" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Account array" }
      }
    }
  },
  {
    name: "get_account",
    title: "Get Account",
    description: "Retrieve a single account by ID",
    httpMethod: "GET",
    pathTemplate: "/account/{id}",
    inputs: {
      type: "object",
      properties: {
        id: { type: "string", description: "Account ID" }
      },
      required: ["id"]
    },
    outputs: {
      type: "object",
      properties: {
        Account: { type: "object", description: "Account object" }
      }
    }
  },
  {
    name: "list_estimates",
    title: "List Estimates",
    description: "Query all estimates/quotes",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Estimate" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Estimate array" }
      }
    }
  },
  {
    name: "create_estimate",
    title: "Create Estimate",
    description: "Create a new estimate/quote",
    httpMethod: "POST",
    pathTemplate: "/estimate",
    inputs: {
      type: "object",
      properties: {
        CustomerRef: { type: "object", properties: { value: { type: "string" } } },
        Line: { type: "array", description: "Estimate line items" },
        ExpirationDate: { type: "string", description: "Expiration date (YYYY-MM-DD)" }
      },
      required: ["CustomerRef", "Line"]
    },
    outputs: {
      type: "object",
      properties: {
        Estimate: { type: "object", description: "Created estimate object" }
      }
    }
  },
  {
    name: "list_purchases",
    title: "List Purchases",
    description: "Query all purchases (checks, credit card charges, etc.)",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Purchase" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Purchase array" }
      }
    }
  },
  {
    name: "create_purchase",
    title: "Create Purchase",
    description: "Create a new purchase transaction",
    httpMethod: "POST",
    pathTemplate: "/purchase",
    inputs: {
      type: "object",
      properties: {
        PaymentType: { type: "string", enum: ["Cash", "Check", "CreditCard"], description: "Payment type" },
        AccountRef: { type: "object", description: "Payment account reference" },
        Line: { type: "array", description: "Purchase line items" },
        EntityRef: { type: "object", description: "Vendor reference (optional)" }
      },
      required: ["PaymentType", "AccountRef", "Line"]
    },
    outputs: {
      type: "object",
      properties: {
        Purchase: { type: "object", description: "Created purchase object" }
      }
    }
  },
  {
    name: "list_employees",
    title: "List Employees",
    description: "Query all employees",
    httpMethod: "GET",
    pathTemplate: "/query",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "SQL-like query string", default: "select * from Employee" }
      }
    },
    outputs: {
      type: "object",
      properties: {
        QueryResponse: { type: "object", description: "Query response with Employee array" }
      }
    }
  },
  {
    name: "get_preferences",
    title: "Get Preferences",
    description: "Retrieve company preferences and settings",
    httpMethod: "GET",
    pathTemplate: "/preferences",
    inputs: {
      type: "object",
      properties: {}
    },
    outputs: {
      type: "object",
      properties: {
        Preferences: { type: "object", description: "Company preferences object" }
      }
    }
  }
];

const hubspotDefaultTools = [
  // CONTACTS
  {
    name: "list_contacts",
    title: "List Contacts",
    description:
      "Retrieve a paginated list of contacts from the CRM. Returns up to 100 contacts per request with optional property selection.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/contacts",
    inputs: {
      type: "object",
      properties: {
        limit: {
          type: "integer",
          description: "Number of results to return (max 100)",
        },
        after: {
          type: "string",
          description: "Pagination cursor from previous response",
        },
        properties: {
          type: "array",
          items: { type: "string" },
          description:
            "Properties to return (e.g., firstname, lastname, email, phone)",
        },
        archived: {
          type: "boolean",
          description: "Include archived contacts",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array", description: "Array of contact objects" },
        paging: { type: "object", description: "Pagination info with next cursor" },
      },
    },
  },
  {
    name: "get_contact",
    title: "Get Contact",
    description:
      "Retrieve a single contact by ID with all specified properties and optional associations.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/contacts/{contactId}",
    inputs: {
      type: "object",
      properties: {
        contactId: {
          type: "string",
          description: "The contact ID or email address",
        },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to return",
        },
        associations: {
          type: "array",
          items: { type: "string" },
          description: "Associated objects to include (companies, deals, tickets)",
        },
      },
      required: ["contactId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
        associations: { type: "object" },
      },
    },
  },
  {
    name: "create_contact",
    title: "Create Contact",
    description:
      "Create a new contact in the CRM with specified properties. Can optionally associate with companies or deals.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/contacts",
    inputs: {
      type: "object",
      properties: {
        properties: {
          type: "object",
          description:
            "Contact properties (email, firstname, lastname, phone, company, etc.)",
          properties: {
            email: { type: "string" },
            firstname: { type: "string" },
            lastname: { type: "string" },
            phone: { type: "string" },
            company: { type: "string" },
            website: { type: "string" },
            lifecyclestage: { type: "string" },
          },
        },
        associations: {
          type: "array",
          description: "Associations to create with other objects",
        },
      },
      required: ["properties"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
      },
    },
  },
  {
    name: "search_contacts",
    title: "Search Contacts",
    description:
      "Search contacts using filters, query strings, and sorting. Supports complex filter groups with AND/OR logic.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/contacts/search",
    inputs: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query string",
        },
        filterGroups: {
          type: "array",
          description:
            "Filter groups with AND/OR logic. Each group contains filters array.",
        },
        sorts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              propertyName: { type: "string" },
              direction: { type: "string", enum: ["ASCENDING", "DESCENDING"] },
            },
          },
          description: "Sort order for results",
        },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to return",
        },
        limit: { type: "integer", description: "Max results (up to 100)" },
        after: { type: "string", description: "Pagination cursor" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        total: { type: "integer" },
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "batch_read_contacts",
    title: "Batch Read Contacts",
    description:
      "Read multiple contacts by ID in a single request. More efficient than individual requests. Max 100 per batch.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/contacts/batch/read",
    inputs: {
      type: "object",
      properties: {
        inputs: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Contact ID" },
            },
          },
          description: "Array of contact IDs to read (max 100)",
        },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to return for each contact",
        },
      },
      required: ["inputs"],
    },
    outputs: {
      type: "object",
      properties: {
        status: { type: "string" },
        results: { type: "array" },
      },
    },
  },
  // COMPANIES
  {
    name: "list_companies",
    title: "List Companies",
    description:
      "Retrieve a paginated list of companies from the CRM with optional property selection.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/companies",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Results per page (max 100)" },
        after: { type: "string", description: "Pagination cursor" },
        properties: {
          type: "array",
          items: { type: "string" },
          description: "Properties to return (name, domain, industry, etc.)",
        },
        archived: { type: "boolean" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_company",
    title: "Get Company",
    description: "Retrieve a single company by ID with properties and associations.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/companies/{companyId}",
    inputs: {
      type: "object",
      properties: {
        companyId: { type: "string", description: "The company ID" },
        properties: { type: "array", items: { type: "string" } },
        associations: {
          type: "array",
          items: { type: "string" },
          description: "Include contacts, deals associations",
        },
      },
      required: ["companyId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
        associations: { type: "object" },
      },
    },
  },
  {
    name: "create_company",
    title: "Create Company",
    description: "Create a new company record with specified properties.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/companies",
    inputs: {
      type: "object",
      properties: {
        properties: {
          type: "object",
          description: "Company properties",
          properties: {
            name: { type: "string" },
            domain: { type: "string" },
            industry: { type: "string" },
            phone: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            country: { type: "string" },
            numberofemployees: { type: "string" },
            annualrevenue: { type: "string" },
          },
        },
        associations: { type: "array" },
      },
      required: ["properties"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
      },
    },
  },
  {
    name: "search_companies",
    title: "Search Companies",
    description: "Search companies using filters and query strings.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/companies/search",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        filterGroups: { type: "array", description: "Filter groups" },
        sorts: { type: "array" },
        properties: { type: "array", items: { type: "string" } },
        limit: { type: "integer" },
        after: { type: "string" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        total: { type: "integer" },
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  // DEALS
  {
    name: "list_deals",
    title: "List Deals",
    description:
      "Retrieve a paginated list of deals with pipeline and stage information.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/deals",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer" },
        after: { type: "string" },
        properties: {
          type: "array",
          items: { type: "string" },
          description:
            "Properties (dealname, amount, dealstage, pipeline, closedate, etc.)",
        },
        archived: { type: "boolean" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_deal",
    title: "Get Deal",
    description: "Retrieve a single deal with full details and associations.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/deals/{dealId}",
    inputs: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "The deal ID" },
        properties: { type: "array", items: { type: "string" } },
        associations: {
          type: "array",
          items: { type: "string" },
          description: "Include contacts, companies associations",
        },
      },
      required: ["dealId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
        associations: { type: "object" },
      },
    },
  },
  {
    name: "create_deal",
    title: "Create Deal",
    description:
      "Create a new deal in a specified pipeline and stage. Can associate with contacts and companies.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/deals",
    inputs: {
      type: "object",
      properties: {
        properties: {
          type: "object",
          description: "Deal properties",
          properties: {
            dealname: { type: "string" },
            amount: { type: "string" },
            pipeline: { type: "string", description: "Pipeline ID" },
            dealstage: { type: "string", description: "Stage ID" },
            closedate: { type: "string", description: "Expected close date" },
            hubspot_owner_id: { type: "string" },
          },
        },
        associations: { type: "array" },
      },
      required: ["properties"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
      },
    },
  },
  {
    name: "update_deal",
    title: "Update Deal",
    description:
      "Update deal properties including moving through pipeline stages.",
    httpMethod: "PATCH",
    pathTemplate: "/crm/v3/objects/deals/{dealId}",
    inputs: {
      type: "object",
      properties: {
        dealId: { type: "string", description: "The deal ID to update" },
        properties: {
          type: "object",
          description: "Properties to update",
          properties: {
            dealname: { type: "string" },
            amount: { type: "string" },
            dealstage: { type: "string", description: "Move to new stage" },
            closedate: { type: "string" },
          },
        },
      },
      required: ["dealId", "properties"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
      },
    },
  },
  {
    name: "search_deals",
    title: "Search Deals",
    description:
      "Search deals with filters for pipeline, stage, amount, and more.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/deals/search",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string" },
        filterGroups: { type: "array" },
        sorts: { type: "array" },
        properties: { type: "array", items: { type: "string" } },
        limit: { type: "integer" },
        after: { type: "string" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        total: { type: "integer" },
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  // TICKETS
  {
    name: "list_tickets",
    title: "List Tickets",
    description: "Retrieve support tickets with pipeline and priority info.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/objects/tickets",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer" },
        after: { type: "string" },
        properties: {
          type: "array",
          items: { type: "string" },
          description:
            "Properties (subject, content, hs_pipeline, hs_pipeline_stage, hs_ticket_priority)",
        },
        archived: { type: "boolean" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "create_ticket",
    title: "Create Ticket",
    description: "Create a new support ticket with subject, content, and priority.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/tickets",
    inputs: {
      type: "object",
      properties: {
        properties: {
          type: "object",
          properties: {
            subject: { type: "string" },
            content: { type: "string", description: "Ticket description" },
            hs_pipeline: { type: "string", description: "Pipeline ID" },
            hs_pipeline_stage: { type: "string", description: "Stage ID" },
            hs_ticket_priority: {
              type: "string",
              enum: ["LOW", "MEDIUM", "HIGH"],
            },
          },
        },
        associations: { type: "array" },
      },
      required: ["properties"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        properties: { type: "object" },
      },
    },
  },
  {
    name: "search_tickets",
    title: "Search Tickets",
    description: "Search tickets by status, priority, or custom filters.",
    httpMethod: "POST",
    pathTemplate: "/crm/v3/objects/tickets/search",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string" },
        filterGroups: { type: "array" },
        sorts: { type: "array" },
        properties: { type: "array", items: { type: "string" } },
        limit: { type: "integer" },
        after: { type: "string" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        total: { type: "integer" },
        results: { type: "array" },
        paging: { type: "object" },
      },
    },
  },
  // MARKETING EMAIL
  {
    name: "list_marketing_emails",
    title: "List Marketing Emails",
    description: "Retrieve marketing email campaigns with performance metrics.",
    httpMethod: "GET",
    pathTemplate: "/marketing/v3/emails",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Results per page" },
        after: { type: "string", description: "Pagination cursor" },
        isPublished: { type: "boolean", description: "Filter by published status" },
        type: {
          type: "string",
          enum: ["REGULAR", "BLOG_EMAIL", "AUTOMATED", "RSS_EMAIL"],
          description: "Email type filter",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array", description: "Array of email objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_email_statistics",
    title: "Get Email Statistics",
    description:
      "Get aggregated email performance statistics including opens, clicks, bounces for a date range.",
    httpMethod: "GET",
    pathTemplate: "/marketing/v3/emails/statistics/list",
    inputs: {
      type: "object",
      properties: {
        startTimestamp: {
          type: "string",
          description: "Start date (ISO 8601 or Unix ms)",
        },
        endTimestamp: {
          type: "string",
          description: "End date (ISO 8601 or Unix ms)",
        },
        emailIds: {
          type: "array",
          items: { type: "string" },
          description: "Filter to specific email IDs",
        },
      },
      required: ["startTimestamp", "endTimestamp"],
    },
    outputs: {
      type: "object",
      properties: {
        results: {
          type: "array",
          description:
            "Stats per email (sent, delivered, opens, clicks, bounces, unsubscribes)",
        },
      },
    },
  },
  // CAMPAIGNS
  {
    name: "list_campaigns",
    title: "List Campaigns",
    description: "Retrieve marketing campaigns with associated assets and metrics.",
    httpMethod: "GET",
    pathTemplate: "/marketing/v3/campaigns",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer" },
        after: { type: "string" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array", description: "Array of campaign objects" },
        paging: { type: "object" },
      },
    },
  },
  {
    name: "get_campaign",
    title: "Get Campaign",
    description: "Get campaign details with associated assets and performance data.",
    httpMethod: "GET",
    pathTemplate: "/marketing/v3/campaigns/{campaignId}",
    inputs: {
      type: "object",
      properties: {
        campaignId: { type: "string", description: "Campaign GUID" },
      },
      required: ["campaignId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        assets: { type: "object" },
        metrics: { type: "object" },
      },
    },
  },
  // PIPELINES & ANALYTICS
  {
    name: "list_pipelines",
    title: "List Pipelines",
    description:
      "Get all pipelines for an object type (deals or tickets) with their stages.",
    httpMethod: "GET",
    pathTemplate: "/crm/v3/pipelines/{objectType}",
    inputs: {
      type: "object",
      properties: {
        objectType: {
          type: "string",
          enum: ["deals", "tickets"],
          description: "Object type to get pipelines for",
        },
      },
      required: ["objectType"],
    },
    outputs: {
      type: "object",
      properties: {
        results: {
          type: "array",
          description: "Array of pipelines with stages",
        },
      },
    },
  },
  {
    name: "get_associations",
    title: "Get Associations",
    description:
      "Get all associations between an object and another object type (e.g., contact to deals).",
    httpMethod: "GET",
    pathTemplate: "/crm/v4/objects/{fromObjectType}/{objectId}/associations/{toObjectType}",
    inputs: {
      type: "object",
      properties: {
        fromObjectType: {
          type: "string",
          enum: ["contacts", "companies", "deals", "tickets"],
          description: "Source object type",
        },
        objectId: { type: "string", description: "Source object ID" },
        toObjectType: {
          type: "string",
          enum: ["contacts", "companies", "deals", "tickets", "notes", "tasks"],
          description: "Target object type",
        },
      },
      required: ["fromObjectType", "objectId", "toObjectType"],
    },
    outputs: {
      type: "object",
      properties: {
        results: {
          type: "array",
          description: "Array of association objects with IDs and types",
        },
      },
    },
  },
  {
    name: "create_association",
    title: "Create Association",
    description: "Associate two objects (e.g., link a contact to a deal).",
    httpMethod: "PUT",
    pathTemplate: "/crm/v4/objects/{fromObjectType}/{fromObjectId}/associations/{toObjectType}/{toObjectId}",
    inputs: {
      type: "object",
      properties: {
        fromObjectType: {
          type: "string",
          enum: ["contacts", "companies", "deals", "tickets"],
        },
        fromObjectId: { type: "string" },
        toObjectType: {
          type: "string",
          enum: ["contacts", "companies", "deals", "tickets"],
        },
        toObjectId: { type: "string" },
        associationSpec: {
          type: "array",
          items: {
            type: "object",
            properties: {
              associationCategory: {
                type: "string",
                enum: ["HUBSPOT_DEFINED", "USER_DEFINED"],
              },
              associationTypeId: { type: "integer" },
            },
          },
          description: "Association type specification",
        },
      },
      required: ["fromObjectType", "fromObjectId", "toObjectType", "toObjectId"],
    },
    outputs: {
      type: "object",
      properties: {
        fromObjectTypeId: { type: "string" },
        toObjectTypeId: { type: "string" },
        labels: { type: "array" },
      },
    },
  },
];

const stripeDefaultTools = [
  // Charges API
  {
    name: "list_charges",
    title: "List Charges",
    description: "Returns a list of charges you've previously created. Charges are returned in sorted order, with the most recent appearing first.",
    httpMethod: "GET",
    pathTemplate: "/charges",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number of charges to return (1-100, default 10)" },
        starting_after: { type: "string", description: "Cursor for pagination (charge ID)" },
        ending_before: { type: "string", description: "Cursor for pagination (charge ID)" },
        customer: { type: "string", description: "Filter by customer ID" },
        created: { type: "object", description: "Filter by created date (gt, gte, lt, lte)" },
        payment_intent: { type: "string", description: "Filter by PaymentIntent ID" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of charge objects" },
        has_more: { type: "boolean", description: "Whether more results exist" },
      },
    },
  },
  {
    name: "get_charge",
    title: "Get Charge",
    description: "Retrieves the details of a charge that has previously been created.",
    httpMethod: "GET",
    pathTemplate: "/charges/{charge_id}",
    inputs: {
      type: "object",
      properties: {
        charge_id: { type: "string", description: "The charge ID (ch_*)" },
      },
      required: ["charge_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        amount: { type: "integer" },
        currency: { type: "string" },
        status: { type: "string" },
        customer: { type: "string" },
      },
    },
  },
  // Customers API
  {
    name: "list_customers",
    title: "List Customers",
    description: "Returns a list of your customers with their payment methods and metadata.",
    httpMethod: "GET",
    pathTemplate: "/customers",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number of customers to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        ending_before: { type: "string", description: "Cursor for pagination" },
        email: { type: "string", description: "Filter by email address" },
        created: { type: "object", description: "Filter by created date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of customer objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  {
    name: "get_customer",
    title: "Get Customer",
    description: "Retrieves a customer with their payment methods, subscriptions, and balance.",
    httpMethod: "GET",
    pathTemplate: "/customers/{customer_id}",
    inputs: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer ID (cus_*)" },
        expand: { type: "array", items: { type: "string" }, description: "Fields to expand (e.g., ['subscriptions', 'sources'])" },
      },
      required: ["customer_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        email: { type: "string" },
        name: { type: "string" },
        balance: { type: "integer" },
        default_source: { type: "string" },
      },
    },
  },
  {
    name: "list_customer_payment_methods",
    title: "List Customer Payment Methods",
    description: "Returns a list of PaymentMethods for a given Customer.",
    httpMethod: "GET",
    pathTemplate: "/customers/{customer_id}/payment_methods",
    inputs: {
      type: "object",
      properties: {
        customer_id: { type: "string", description: "The customer ID" },
        type: { type: "string", enum: ["card", "us_bank_account", "sepa_debit", "link"], description: "Filter by payment method type" },
        limit: { type: "integer", description: "Number to return (1-100)" },
      },
      required: ["customer_id"],
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of payment method objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  // Subscriptions API
  {
    name: "list_subscriptions",
    title: "List Subscriptions",
    description: "Returns a list of subscriptions, both active and canceled.",
    httpMethod: "GET",
    pathTemplate: "/subscriptions",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        customer: { type: "string", description: "Filter by customer ID" },
        price: { type: "string", description: "Filter by price ID" },
        status: {
          type: "string",
          enum: ["active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired", "trialing", "paused", "all"],
          description: "Filter by status",
        },
        created: { type: "object", description: "Filter by created date" },
        current_period_start: { type: "object", description: "Filter by current period start" },
        current_period_end: { type: "object", description: "Filter by current period end" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of subscription objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  {
    name: "get_subscription",
    title: "Get Subscription",
    description: "Retrieves the subscription with the given ID.",
    httpMethod: "GET",
    pathTemplate: "/subscriptions/{subscription_id}",
    inputs: {
      type: "object",
      properties: {
        subscription_id: { type: "string", description: "The subscription ID (sub_*)" },
        expand: { type: "array", items: { type: "string" }, description: "Fields to expand" },
      },
      required: ["subscription_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        customer: { type: "string" },
        current_period_start: { type: "integer" },
        current_period_end: { type: "integer" },
        items: { type: "object" },
      },
    },
  },
  // Balance & Payouts
  {
    name: "get_balance",
    title: "Get Balance",
    description: "Retrieves the current account balance, showing available and pending amounts by currency.",
    httpMethod: "GET",
    pathTemplate: "/balance",
    inputs: {
      type: "object",
      properties: {},
    },
    outputs: {
      type: "object",
      properties: {
        available: { type: "array", description: "Available balance by currency" },
        pending: { type: "array", description: "Pending balance by currency" },
        livemode: { type: "boolean" },
      },
    },
  },
  {
    name: "list_balance_transactions",
    title: "List Balance Transactions",
    description: "Returns a list of transactions that have contributed to the Stripe account balance.",
    httpMethod: "GET",
    pathTemplate: "/balance_transactions",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        type: { type: "string", description: "Filter by transaction type (charge, refund, payout, etc.)" },
        payout: { type: "string", description: "Filter by payout ID" },
        created: { type: "object", description: "Filter by created date" },
        available_on: { type: "object", description: "Filter by available date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of balance transaction objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  {
    name: "list_payouts",
    title: "List Payouts",
    description: "Returns a list of existing payouts to your bank account or debit card.",
    httpMethod: "GET",
    pathTemplate: "/payouts",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        status: { type: "string", enum: ["pending", "paid", "failed", "canceled"], description: "Filter by status" },
        arrival_date: { type: "object", description: "Filter by arrival date" },
        created: { type: "object", description: "Filter by created date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of payout objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  {
    name: "get_payout",
    title: "Get Payout",
    description: "Retrieves the details of an existing payout.",
    httpMethod: "GET",
    pathTemplate: "/payouts/{payout_id}",
    inputs: {
      type: "object",
      properties: {
        payout_id: { type: "string", description: "The payout ID (po_*)" },
      },
      required: ["payout_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        amount: { type: "integer" },
        currency: { type: "string" },
        status: { type: "string" },
        arrival_date: { type: "integer" },
      },
    },
  },
  // Disputes API
  {
    name: "list_disputes",
    title: "List Disputes",
    description: "Returns a list of your disputes (chargebacks).",
    httpMethod: "GET",
    pathTemplate: "/disputes",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        charge: { type: "string", description: "Filter by charge ID" },
        payment_intent: { type: "string", description: "Filter by PaymentIntent ID" },
        created: { type: "object", description: "Filter by created date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of dispute objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  {
    name: "get_dispute",
    title: "Get Dispute",
    description: "Retrieves the dispute with the given ID.",
    httpMethod: "GET",
    pathTemplate: "/disputes/{dispute_id}",
    inputs: {
      type: "object",
      properties: {
        dispute_id: { type: "string", description: "The dispute ID (dp_*)" },
      },
      required: ["dispute_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        amount: { type: "integer" },
        charge: { type: "string" },
        reason: { type: "string" },
        status: { type: "string" },
        evidence_details: { type: "object" },
      },
    },
  },
  // Refunds API
  {
    name: "list_refunds",
    title: "List Refunds",
    description: "Returns a list of all refunds you've previously created.",
    httpMethod: "GET",
    pathTemplate: "/refunds",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        charge: { type: "string", description: "Filter by charge ID" },
        payment_intent: { type: "string", description: "Filter by PaymentIntent ID" },
        created: { type: "object", description: "Filter by created date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of refund objects" },
        has_more: { type: "boolean" },
      },
    },
  },
  {
    name: "create_refund",
    title: "Create Refund",
    description: "Creates a refund for a charge. Supports full or partial refunds with idempotency.",
    httpMethod: "POST",
    pathTemplate: "/refunds",
    inputs: {
      type: "object",
      properties: {
        charge: { type: "string", description: "The charge ID to refund (required if no payment_intent)" },
        payment_intent: { type: "string", description: "The PaymentIntent ID to refund" },
        amount: { type: "integer", description: "Amount to refund in cents (omit for full refund)" },
        reason: { type: "string", enum: ["duplicate", "fraudulent", "requested_by_customer"], description: "Reason for refund" },
        metadata: { type: "object", description: "Metadata to attach to the refund" },
        refund_application_fee: { type: "boolean", description: "Whether to refund application fee (Connect only)" },
        reverse_transfer: { type: "boolean", description: "Whether to reverse transfer (Connect only)" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        amount: { type: "integer" },
        charge: { type: "string" },
        status: { type: "string" },
        reason: { type: "string" },
      },
    },
  },
  {
    name: "get_refund",
    title: "Get Refund",
    description: "Retrieves the details of an existing refund.",
    httpMethod: "GET",
    pathTemplate: "/refunds/{refund_id}",
    inputs: {
      type: "object",
      properties: {
        refund_id: { type: "string", description: "The refund ID (re_*)" },
      },
      required: ["refund_id"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        amount: { type: "integer" },
        charge: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  // Invoices API
  {
    name: "list_invoices",
    title: "List Invoices",
    description: "Returns a list of invoices for subscriptions and one-time payments.",
    httpMethod: "GET",
    pathTemplate: "/invoices",
    inputs: {
      type: "object",
      properties: {
        limit: { type: "integer", description: "Number to return (1-100)" },
        starting_after: { type: "string", description: "Cursor for pagination" },
        customer: { type: "string", description: "Filter by customer ID" },
        subscription: { type: "string", description: "Filter by subscription ID" },
        status: { type: "string", enum: ["draft", "open", "paid", "uncollectible", "void"], description: "Filter by status" },
        created: { type: "object", description: "Filter by created date" },
        due_date: { type: "object", description: "Filter by due date" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        data: { type: "array", description: "List of invoice objects" },
        has_more: { type: "boolean" },
      },
    },
  },
];

const jungleScoutDefaultTools = [
  // Product Database
  {
    name: "product_database_query",
    title: "Product Database Query",
    description:
      "Search Amazon's product catalog using sophisticated filtering. Returns up to 30 data points per product including sales estimates, revenue, rank, reviews, and more. Use for product research and opportunity identification.",
    httpMethod: "POST",
    pathTemplate: "/api/product_database_query",
    inputs: {
      type: "object",
      properties: {
        marketplace: {
          type: "string",
          enum: ["us", "uk", "de", "ca", "fr", "it", "es", "mx", "jp", "in"],
          description: "Amazon marketplace (required)",
        },
        include_keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to include in search (OR logic within array)",
        },
        exclude_keywords: {
          type: "array",
          items: { type: "string" },
          description: "Keywords to exclude from search",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Category IDs to filter by",
        },
        product_tiers: {
          type: "array",
          items: { type: "string", enum: ["standard", "oversize"] },
          description: "Filter by product size tier",
        },
        seller_types: {
          type: "array",
          items: { type: "string", enum: ["amz", "fba", "fbm"] },
          description:
            "Filter by seller type (amz=Amazon, fba=FBA, fbm=Merchant)",
        },
        min_price: { type: "number", description: "Minimum price filter" },
        max_price: { type: "number", description: "Maximum price filter" },
        min_sales: {
          type: "integer",
          description: "Minimum monthly sales estimate",
        },
        max_sales: {
          type: "integer",
          description: "Maximum monthly sales estimate",
        },
        min_revenue: {
          type: "number",
          description: "Minimum monthly revenue",
        },
        max_revenue: {
          type: "number",
          description: "Maximum monthly revenue",
        },
        min_rank: { type: "integer", description: "Minimum BSR rank" },
        max_rank: { type: "integer", description: "Maximum BSR rank" },
        min_reviews: {
          type: "integer",
          description: "Minimum number of reviews",
        },
        max_reviews: {
          type: "integer",
          description: "Maximum number of reviews",
        },
        min_rating: { type: "number", description: "Minimum star rating" },
        max_rating: { type: "number", description: "Maximum star rating" },
        min_lqs: {
          type: "integer",
          description: "Minimum Listing Quality Score",
        },
        max_lqs: {
          type: "integer",
          description: "Maximum Listing Quality Score",
        },
        exclude_top_brands: {
          type: "boolean",
          description: "Exclude products from top brands",
        },
        exclude_unavailable_products: {
          type: "boolean",
          description: "Exclude out-of-stock products",
        },
        page_size: {
          type: "integer",
          description: "Results per page (1-100, default 10)",
        },
        page: { type: "string", description: "Pagination cursor" },
      },
      required: ["marketplace"],
    },
    outputs: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "Array of product objects with ASIN, title, sales, revenue, rank, etc.",
        },
        links: {
          type: "object",
          description: "Pagination links (next, self)",
        },
      },
    },
  },
  // Keywords by ASIN
  {
    name: "keywords_by_asin",
    title: "Keywords by ASIN",
    description:
      "Get keywords that an ASIN ranks for, including search volume, PPC bid estimates, relevancy scores, and organic ranking data. Useful for keyword research and PPC campaign optimization.",
    httpMethod: "POST",
    pathTemplate: "/api/keywords/keywords_by_asin_query",
    inputs: {
      type: "object",
      properties: {
        marketplace: {
          type: "string",
          enum: ["us", "uk", "de", "ca", "fr", "it", "es", "mx", "jp", "in"],
          description: "Amazon marketplace (required)",
        },
        asin: {
          type: "array",
          items: { type: "string" },
          description: "ASINs to query (up to 10)",
          maxItems: 10,
        },
        include_variants: {
          type: "boolean",
          description: "Include variant ASINs in the query (default: true)",
        },
        min_monthly_search_volume_exact: {
          type: "integer",
          description: "Minimum exact match search volume",
        },
        max_monthly_search_volume_exact: {
          type: "integer",
          description: "Maximum exact match search volume",
        },
        min_monthly_search_volume_broad: {
          type: "integer",
          description: "Minimum broad match search volume",
        },
        max_monthly_search_volume_broad: {
          type: "integer",
          description: "Maximum broad match search volume",
        },
        min_word_count: {
          type: "integer",
          description: "Minimum keyword word count",
        },
        max_word_count: {
          type: "integer",
          description: "Maximum keyword word count",
        },
        min_organic_product_count: {
          type: "integer",
          description: "Minimum organic product count",
        },
        max_organic_product_count: {
          type: "integer",
          description: "Maximum organic product count",
        },
        page_size: {
          type: "integer",
          description: "Results per page (1-100)",
        },
        page: { type: "string", description: "Pagination cursor" },
      },
      required: ["marketplace", "asin"],
    },
    outputs: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description:
            "Array of keyword objects with search volume, PPC bids, relevancy, ranking data",
        },
        links: { type: "object", description: "Pagination links" },
      },
    },
  },
  // Keywords by Keyword
  {
    name: "keywords_by_keyword",
    title: "Keywords by Keyword",
    description:
      "Discover related keywords from a seed keyword. Returns search volume, PPC data, competition metrics, and trending information. Ideal for expanding keyword lists.",
    httpMethod: "POST",
    pathTemplate: "/api/keywords/keywords_by_keyword_query",
    inputs: {
      type: "object",
      properties: {
        marketplace: {
          type: "string",
          enum: ["us", "uk", "de", "ca", "fr", "it", "es", "mx", "jp", "in"],
          description: "Amazon marketplace (required)",
        },
        search_terms: {
          type: "string",
          description: "Seed keyword to find related keywords for (required)",
        },
        categories: {
          type: "array",
          items: { type: "string" },
          description: "Category IDs to filter results",
        },
        min_monthly_search_volume_exact: {
          type: "integer",
          description: "Minimum exact match search volume",
        },
        max_monthly_search_volume_exact: {
          type: "integer",
          description: "Maximum exact match search volume",
        },
        min_monthly_search_volume_broad: {
          type: "integer",
          description: "Minimum broad match search volume",
        },
        max_monthly_search_volume_broad: {
          type: "integer",
          description: "Maximum broad match search volume",
        },
        min_word_count: {
          type: "integer",
          description: "Minimum keyword word count",
        },
        max_word_count: {
          type: "integer",
          description: "Maximum keyword word count",
        },
        min_organic_product_count: {
          type: "integer",
          description: "Minimum organic product count",
        },
        max_organic_product_count: {
          type: "integer",
          description: "Maximum organic product count",
        },
        page_size: {
          type: "integer",
          description: "Results per page (1-100)",
        },
        page: { type: "string", description: "Pagination cursor" },
      },
      required: ["marketplace", "search_terms"],
    },
    outputs: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description: "Array of related keyword objects with metrics",
        },
        links: { type: "object", description: "Pagination links" },
      },
    },
  },
  // Historical Search Volume
  {
    name: "historical_search_volume",
    title: "Historical Search Volume",
    description:
      "Get weekly historical search volume data for a keyword over a date range. Use for seasonality analysis and trend identification.",
    httpMethod: "POST",
    pathTemplate: "/api/keywords/historical_search_volume",
    inputs: {
      type: "object",
      properties: {
        marketplace: {
          type: "string",
          enum: ["us", "uk", "de", "ca", "fr", "it", "es", "mx", "jp", "in"],
          description: "Amazon marketplace (required)",
        },
        keyword: {
          type: "string",
          description: "Keyword to get historical data for (required)",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (required)",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (required)",
        },
      },
      required: ["marketplace", "keyword", "start_date", "end_date"],
    },
    outputs: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description:
            "Array of weekly search volume data points with date and volume",
        },
      },
    },
  },
  // Sales Estimates
  {
    name: "sales_estimates",
    title: "Sales Estimates",
    description:
      "Get daily historical sales estimates and price data for an ASIN over a date range. Includes rank history and revenue calculations. Note: Variant ASINs return data for parent ASIN.",
    httpMethod: "POST",
    pathTemplate: "/api/sales_estimates_query",
    inputs: {
      type: "object",
      properties: {
        marketplace: {
          type: "string",
          enum: ["us", "uk", "de", "ca", "fr", "it", "es", "mx", "jp", "in"],
          description: "Amazon marketplace (required)",
        },
        asin: {
          type: "string",
          description: "ASIN to get sales estimates for (required)",
        },
        start_date: {
          type: "string",
          description: "Start date in YYYY-MM-DD format (required)",
        },
        end_date: {
          type: "string",
          description: "End date in YYYY-MM-DD format (required)",
        },
      },
      required: ["marketplace", "asin", "start_date", "end_date"],
    },
    outputs: {
      type: "object",
      properties: {
        data: {
          type: "array",
          description:
            "Array of daily data points with date, sales estimate, price, rank",
        },
      },
    },
  },
  // Share of Voice
  {
    name: "share_of_voice",
    title: "Share of Voice",
    description:
      "Get brand share of voice data for a keyword search. Returns organic, sponsored, and combined SOV for all brands appearing in the first 3 pages of search results. Also includes PPC bid and conversion rate data.",
    httpMethod: "GET",
    pathTemplate: "/api/share_of_voice",
    inputs: {
      type: "object",
      properties: {
        marketplace: {
          type: "string",
          enum: ["us", "uk", "de", "ca", "fr", "it", "es", "mx", "jp", "in"],
          description: "Amazon marketplace (required)",
        },
        keyword: {
          type: "string",
          description: "Keyword to analyze share of voice for (required)",
        },
      },
      required: ["marketplace", "keyword"],
    },
    outputs: {
      type: "object",
      properties: {
        data: {
          type: "object",
          properties: {
            keyword_data: {
              type: "object",
              description: "Keyword metrics (search volume, PPC bid)",
            },
            brands: {
              type: "array",
              description:
                "Array of brand objects with basic_sov, weighted_sov, organic_sov, sponsored_sov",
            },
            top_asins: {
              type: "array",
              description: "Top 3 ASINs with conversion rate data",
            },
          },
        },
      },
    },
  },
];

const googleAdsDefaultTools = [
  { name: "list_campaigns", title: "List Campaigns", description: "Get all campaigns with status, type, budget, and performance metrics. Supports filtering by status and campaign type.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { status: { type: "string", enum: ["ENABLED", "PAUSED", "REMOVED"], description: "Filter by campaign status" }, campaignType: { type: "string", enum: ["SEARCH", "DISPLAY", "SHOPPING", "VIDEO", "PERFORMANCE_MAX", "SMART", "LOCAL"], description: "Filter by campaign type" }, dateRange: { type: "string", enum: ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"], description: "Date range for metrics" } } }, outputs: { type: "object", properties: { results: { type: "array", description: "Array of campaign objects with metrics" } } } },
  { name: "get_campaign_details", title: "Get Campaign Details", description: "Get detailed metrics and settings for a specific campaign including bidding strategy, targeting, and performance data.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Campaign ID" }, dateRange: { type: "string", description: "Date range for metrics" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { campaign: { type: "object", description: "Campaign details with full metrics" } } } },
  { name: "create_campaign", title: "Create Campaign", description: "Launch a new campaign (Search, Display, Shopping, Video, or Performance Max) with budget and bidding settings.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaigns:mutate", inputs: { type: "object", properties: { name: { type: "string", description: "Campaign name" }, advertisingChannelType: { type: "string", enum: ["SEARCH", "DISPLAY", "SHOPPING", "VIDEO", "PERFORMANCE_MAX"], description: "Campaign type" }, status: { type: "string", enum: ["ENABLED", "PAUSED"], description: "Initial status" }, budgetAmountMicros: { type: "integer", description: "Daily budget in micros (1,000,000 micros = 1 currency unit)" }, biddingStrategyType: { type: "string", enum: ["MANUAL_CPC", "TARGET_CPA", "TARGET_ROAS", "MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS"], description: "Bidding strategy" }, targetCpaMicros: { type: "integer", description: "Target CPA in micros (for TARGET_CPA)" }, targetRoas: { type: "number", description: "Target ROAS (for TARGET_ROAS, e.g., 3.5 = 350%)" }, startDate: { type: "string", description: "Start date (YYYY-MM-DD)" }, endDate: { type: "string", description: "End date (YYYY-MM-DD)" } }, required: ["name", "advertisingChannelType", "budgetAmountMicros"] }, outputs: { type: "object", properties: { resourceName: { type: "string", description: "Created campaign resource name" }, campaignId: { type: "string" } } } },
  { name: "update_campaign", title: "Update Campaign", description: "Modify campaign settings including name, status, bidding strategy, and dates.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaigns:mutate", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Campaign ID to update" }, name: { type: "string" }, status: { type: "string", enum: ["ENABLED", "PAUSED"] }, endDate: { type: "string" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { resourceName: { type: "string" } } } },
  { name: "pause_campaign", title: "Pause Campaign", description: "Pause an active campaign to stop ad delivery.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaigns:mutate", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Campaign ID to pause" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { success: { type: "boolean" }, resourceName: { type: "string" } } } },
  { name: "resume_campaign", title: "Resume Campaign", description: "Resume a paused campaign to restart ad delivery.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaigns:mutate", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Campaign ID to resume" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { success: { type: "boolean" }, resourceName: { type: "string" } } } },
  { name: "update_campaign_budget", title: "Update Campaign Budget", description: "Modify the daily or total budget for a campaign.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaignBudgets:mutate", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Campaign ID" }, budgetAmountMicros: { type: "integer", description: "New daily budget in micros" }, totalBudgetMicros: { type: "integer", description: "Total budget in micros (for lifetime budgets)" } }, required: ["campaignId", "budgetAmountMicros"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "update_bidding_strategy", title: "Update Bidding Strategy", description: "Change campaign bidding strategy (Manual CPC, Target CPA, Maximize Conversions, etc.).", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaigns:mutate", inputs: { type: "object", properties: { campaignId: { type: "string" }, biddingStrategyType: { type: "string", enum: ["MANUAL_CPC", "MANUAL_CPM", "TARGET_CPA", "TARGET_ROAS", "MAXIMIZE_CONVERSIONS", "MAXIMIZE_CLICKS", "MAXIMIZE_CONVERSION_VALUE"] }, targetCpaMicros: { type: "integer" }, targetRoas: { type: "number" } }, required: ["campaignId", "biddingStrategyType"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "list_ad_groups", title: "List Ad Groups", description: "Get all ad groups with status, bids, and performance metrics. Filter by campaign.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Filter by campaign ID" }, status: { type: "string", enum: ["ENABLED", "PAUSED"] }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_ad_group_details", title: "Get Ad Group Details", description: "Get detailed metrics for a specific ad group.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { adGroupId: { type: "string", description: "Ad group ID" }, dateRange: { type: "string" } }, required: ["adGroupId"] }, outputs: { type: "object", properties: { adGroup: { type: "object" } } } },
  { name: "create_ad_group", title: "Create Ad Group", description: "Add a new ad group to a campaign with bid settings.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroups:mutate", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Parent campaign ID" }, name: { type: "string", description: "Ad group name" }, status: { type: "string", enum: ["ENABLED", "PAUSED"] }, cpcBidMicros: { type: "integer", description: "Default CPC bid in micros" }, type: { type: "string", enum: ["SEARCH_STANDARD", "DISPLAY_STANDARD", "SHOPPING_PRODUCT_ADS", "VIDEO_TRUE_VIEW_IN_STREAM"] } }, required: ["campaignId", "name"] }, outputs: { type: "object", properties: { resourceName: { type: "string" }, adGroupId: { type: "string" } } } },
  { name: "update_ad_group", title: "Update Ad Group", description: "Modify ad group settings and bids.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroups:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, name: { type: "string" }, status: { type: "string", enum: ["ENABLED", "PAUSED"] }, cpcBidMicros: { type: "integer" } }, required: ["adGroupId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "pause_ad_group", title: "Pause Ad Group", description: "Pause an ad group to stop its ads from showing.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroups:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" } }, required: ["adGroupId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "list_ads", title: "List Ads", description: "Get all ads with creative content and performance metrics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" }, status: { type: "string", enum: ["ENABLED", "PAUSED"] }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_ad_performance", title: "Get Ad Performance", description: "Get detailed performance metrics for a specific ad including CTR, conversions, and cost per conversion.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { adId: { type: "string", description: "Ad ID" }, adGroupId: { type: "string", description: "Ad group ID" }, dateRange: { type: "string" } }, required: ["adId", "adGroupId"] }, outputs: { type: "object", properties: { ad: { type: "object" }, metrics: { type: "object" } } } },
  { name: "create_responsive_search_ad", title: "Create Responsive Search Ad", description: "Create a responsive search ad with multiple headlines and descriptions that Google optimizes.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupAds:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, headlines: { type: "array", items: { type: "string" }, description: "Up to 15 headlines (max 30 chars each)" }, descriptions: { type: "array", items: { type: "string" }, description: "Up to 4 descriptions (max 90 chars each)" }, finalUrls: { type: "array", items: { type: "string" }, description: "Landing page URLs" }, path1: { type: "string", description: "Display URL path 1 (max 15 chars)" }, path2: { type: "string", description: "Display URL path 2 (max 15 chars)" } }, required: ["adGroupId", "headlines", "descriptions", "finalUrls"] }, outputs: { type: "object", properties: { resourceName: { type: "string" }, adId: { type: "string" } } } },
  { name: "create_responsive_display_ad", title: "Create Responsive Display Ad", description: "Create a responsive display ad with images, headlines, and descriptions.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupAds:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, headlines: { type: "array", items: { type: "string" } }, longHeadline: { type: "string", description: "Long headline (max 90 chars)" }, descriptions: { type: "array", items: { type: "string" } }, businessName: { type: "string" }, finalUrls: { type: "array", items: { type: "string" } }, marketingImages: { type: "array", description: "Asset resource names for images" }, squareMarketingImages: { type: "array", description: "Asset resource names for square images" }, logoImages: { type: "array", description: "Asset resource names for logos" } }, required: ["adGroupId", "headlines", "longHeadline", "descriptions", "businessName", "finalUrls"] }, outputs: { type: "object", properties: { resourceName: { type: "string" } } } },
  { name: "pause_ad", title: "Pause Ad", description: "Pause an underperforming ad.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupAds:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, adId: { type: "string" } }, required: ["adGroupId", "adId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "get_ad_strength", title: "Get Ad Strength", description: "Get ad strength ratings and improvement recommendations.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { adGroupId: { type: "string" }, adId: { type: "string" } }, required: ["adGroupId", "adId"] }, outputs: { type: "object", properties: { adStrength: { type: "string", enum: ["PENDING", "NO_ADS", "POOR", "AVERAGE", "GOOD", "EXCELLENT"] }, recommendations: { type: "array" } } } },
  { name: "list_keywords", title: "List Keywords", description: "Get all keywords with match types, bids, quality scores, and performance metrics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" }, matchType: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_keyword_performance", title: "Get Keyword Performance", description: "Get detailed performance analytics for a specific keyword.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { adGroupId: { type: "string" }, criterionId: { type: "string", description: "Keyword criterion ID" }, dateRange: { type: "string" } }, required: ["adGroupId", "criterionId"] }, outputs: { type: "object", properties: { keyword: { type: "object" }, metrics: { type: "object" } } } },
  { name: "add_keywords", title: "Add Keywords", description: "Add new keywords to an ad group with match types and bids.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupCriteria:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, keywords: { type: "array", items: { type: "object", properties: { text: { type: "string" }, matchType: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] }, cpcBidMicros: { type: "integer" } }, required: ["text", "matchType"] }, description: "Keywords to add" } }, required: ["adGroupId", "keywords"] }, outputs: { type: "object", properties: { results: { type: "array", description: "Created keyword resource names" } } } },
  { name: "update_keyword_bid", title: "Update Keyword Bid", description: "Modify the CPC bid for a specific keyword.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupCriteria:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, criterionId: { type: "string" }, cpcBidMicros: { type: "integer", description: "New CPC bid in micros" } }, required: ["adGroupId", "criterionId", "cpcBidMicros"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "pause_keyword", title: "Pause Keyword", description: "Pause a keyword to stop triggering ads.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupCriteria:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, criterionId: { type: "string" } }, required: ["adGroupId", "criterionId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "get_negative_keywords", title: "Get Negative Keywords", description: "Get negative keyword lists for campaigns and ad groups.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "add_negative_keywords", title: "Add Negative Keywords", description: "Add negative keywords to block irrelevant searches.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaignCriteria:mutate", inputs: { type: "object", properties: { campaignId: { type: "string", description: "Campaign ID for campaign-level negatives" }, adGroupId: { type: "string", description: "Ad group ID for ad group-level negatives" }, keywords: { type: "array", items: { type: "object", properties: { text: { type: "string" }, matchType: { type: "string", enum: ["EXACT", "PHRASE", "BROAD"] } } } } }, required: ["keywords"] }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_search_terms", title: "Get Search Terms Report", description: "Get actual search queries that triggered your ads with performance metrics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" }, dateRange: { type: "string" }, limit: { type: "integer", description: "Max results (default 100)" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_quality_scores", title: "Get Quality Scores", description: "Get quality score breakdown for keywords (expected CTR, ad relevance, landing page experience).", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" }, minQualityScore: { type: "integer", description: "Filter by minimum quality score (1-10)" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "list_audiences", title: "List Audiences", description: "Get remarketing lists, custom audiences, and in-market segments.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { type: { type: "string", enum: ["REMARKETING", "CUSTOM_INTENT", "CUSTOM_AFFINITY", "IN_MARKET", "SIMILAR"] } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_audience_performance", title: "Get Audience Performance", description: "Get performance metrics for audience segments.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "add_audience_to_ad_group", title: "Add Audience to Ad Group", description: "Apply audience targeting to an ad group.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupCriteria:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, audienceResourceName: { type: "string" }, bidModifier: { type: "number", description: "Bid adjustment (e.g., 1.2 = +20%)" } }, required: ["adGroupId", "audienceResourceName"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "get_location_targeting", title: "Get Location Targeting", description: "Get geographic targeting settings for campaigns.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { locations: { type: "array" } } } },
  { name: "update_location_targeting", title: "Update Location Targeting", description: "Add or remove location targets for a campaign.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaignCriteria:mutate", inputs: { type: "object", properties: { campaignId: { type: "string" }, locationsToAdd: { type: "array", items: { type: "object", properties: { geoTargetConstant: { type: "string", description: "Geo target resource name" }, bidModifier: { type: "number" } } } }, locationsToRemove: { type: "array", items: { type: "string" } } }, required: ["campaignId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "get_device_targeting", title: "Get Device Targeting", description: "Get device bid adjustments (desktop, mobile, tablet).", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { devices: { type: "array" } } } },
  { name: "update_device_targeting", title: "Update Device Targeting", description: "Set device bid modifiers for campaigns.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaignCriteria:mutate", inputs: { type: "object", properties: { campaignId: { type: "string" }, desktopBidModifier: { type: "number", description: "e.g., 1.0 = no change, 0 = exclude" }, mobileBidModifier: { type: "number" }, tabletBidModifier: { type: "number" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "get_campaign_report", title: "Get Campaign Report", description: "Comprehensive campaign performance report with all key metrics over time.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string", enum: ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_30_DAYS", "THIS_MONTH", "LAST_MONTH"] }, startDate: { type: "string", description: "Custom start date YYYY-MM-DD" }, endDate: { type: "string", description: "Custom end date YYYY-MM-DD" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_geographic_report", title: "Get Geographic Report", description: "Performance breakdown by geographic location.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_device_report", title: "Get Device Report", description: "Performance breakdown by device type.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_hour_of_day_report", title: "Get Hour of Day Report", description: "Performance by hour of day for dayparting optimization.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_age_gender_report", title: "Get Age & Gender Report", description: "Performance breakdown by age group and gender demographics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_auction_insights", title: "Get Auction Insights", description: "Competitive metrics showing how you compare to other advertisers.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { auctionInsights: { type: "array", description: "Competitors with impression share, overlap rate, outranking share" } } } },
  { name: "get_impression_share", title: "Get Impression Share Report", description: "Search and display impression share with lost impression share reasons.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "list_conversion_actions", title: "List Conversion Actions", description: "Get all conversion tracking actions with settings and attribution models.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { status: { type: "string", enum: ["ENABLED", "REMOVED", "HIDDEN"] } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "create_conversion_action", title: "Create Conversion Action", description: "Set up new conversion tracking (website, app, phone calls, imports).", httpMethod: "POST", pathTemplate: "/customers/{customerId}/conversionActions:mutate", inputs: { type: "object", properties: { name: { type: "string", description: "Conversion action name" }, type: { type: "string", enum: ["WEBPAGE", "APP_INSTALL", "PHONE_CALL_LEAD", "OFFLINE_IMPORT", "SALESFORCE"] }, category: { type: "string", enum: ["PURCHASE", "SIGNUP", "LEAD", "PAGE_VIEW", "DEFAULT"] }, countingType: { type: "string", enum: ["ONE_PER_CLICK", "MANY_PER_CLICK"] }, defaultValue: { type: "number", description: "Default conversion value" }, attributionModel: { type: "string", enum: ["LAST_CLICK", "FIRST_CLICK", "LINEAR", "TIME_DECAY", "POSITION_BASED", "DATA_DRIVEN"] } }, required: ["name", "type", "category"] }, outputs: { type: "object", properties: { resourceName: { type: "string" }, conversionActionId: { type: "string" } } } },
  { name: "get_conversions_by_action", title: "Get Conversions by Action", description: "Performance breakdown by conversion action type.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "upload_offline_conversions", title: "Upload Offline Conversions", description: "Import offline or CRM conversion data to Google Ads.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/offlineUserDataJobs:create", inputs: { type: "object", properties: { conversionActionId: { type: "string" }, conversions: { type: "array", items: { type: "object", properties: { gclid: { type: "string", description: "Google Click ID" }, conversionDateTime: { type: "string", description: "ISO 8601 format" }, conversionValue: { type: "number" }, currencyCode: { type: "string" } }, required: ["gclid", "conversionDateTime"] } } }, required: ["conversionActionId", "conversions"] }, outputs: { type: "object", properties: { successCount: { type: "integer" }, failureCount: { type: "integer" }, errors: { type: "array" } } } },
  { name: "get_account_budget", title: "Get Account Budget", description: "Get account-level budget information and spend limits.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: {} }, outputs: { type: "object", properties: { budgets: { type: "array" }, totalSpendLimit: { type: "number" } } } },
  { name: "get_spend_by_day", title: "Get Daily Spend", description: "Get daily spend tracking for budget monitoring.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_budget_recommendations", title: "Get Budget Recommendations", description: "Get AI-powered budget increase recommendations.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" } } }, outputs: { type: "object", properties: { recommendations: { type: "array" }, estimatedImpact: { type: "object" } } } },
  { name: "get_recommendations", title: "Get Recommendations", description: "Get Google's optimization recommendations for the account.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { types: { type: "array", items: { type: "string", enum: ["KEYWORD", "TEXT_AD", "CAMPAIGN_BUDGET", "ENHANCED_CPC", "TARGET_CPA", "RESPONSIVE_SEARCH_AD"] }, description: "Filter by recommendation types" } } }, outputs: { type: "object", properties: { recommendations: { type: "array" } } } },
  { name: "apply_recommendation", title: "Apply Recommendation", description: "Implement a Google optimization recommendation.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/recommendations:apply", inputs: { type: "object", properties: { recommendationResourceName: { type: "string", description: "Recommendation resource name" } }, required: ["recommendationResourceName"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "dismiss_recommendation", title: "Dismiss Recommendation", description: "Dismiss a recommendation you don't want to apply.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/recommendations:dismiss", inputs: { type: "object", properties: { recommendationResourceName: { type: "string" } }, required: ["recommendationResourceName"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "get_optimization_score", title: "Get Optimization Score", description: "Get the account's overall optimization score and category breakdown.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: {} }, outputs: { type: "object", properties: { overallScore: { type: "number" }, categoryScores: { type: "object" }, potentialUplift: { type: "number" } } } },
  { name: "list_shopping_campaigns", title: "List Shopping Campaigns", description: "Get all Shopping campaigns with performance metrics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_product_groups", title: "Get Product Groups", description: "Get product group structure and bids for Shopping campaigns.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, adGroupId: { type: "string" } } }, outputs: { type: "object", properties: { productGroups: { type: "array" } } } },
  { name: "get_shopping_performance", title: "Get Shopping Performance", description: "Get product-level performance metrics for Shopping campaigns.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" }, limit: { type: "integer" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "update_product_group_bid", title: "Update Product Group Bid", description: "Modify bids for specific product groups.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/adGroupCriteria:mutate", inputs: { type: "object", properties: { adGroupId: { type: "string" }, criterionId: { type: "string" }, cpcBidMicros: { type: "integer" } }, required: ["adGroupId", "criterionId", "cpcBidMicros"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
  { name: "list_performance_max_campaigns", title: "List Performance Max Campaigns", description: "Get all Performance Max campaigns with asset groups and metrics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "create_performance_max_campaign", title: "Create Performance Max Campaign", description: "Create a new Performance Max campaign with budget and goals.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/campaigns:mutate", inputs: { type: "object", properties: { name: { type: "string" }, budgetAmountMicros: { type: "integer" }, targetCpaMicros: { type: "integer" }, targetRoas: { type: "number" }, finalUrls: { type: "array", items: { type: "string" } } }, required: ["name", "budgetAmountMicros", "finalUrls"] }, outputs: { type: "object", properties: { resourceName: { type: "string" } } } },
  { name: "get_asset_groups", title: "Get Asset Groups", description: "Get asset groups for Performance Max campaigns.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" } }, required: ["campaignId"] }, outputs: { type: "object", properties: { assetGroups: { type: "array" } } } },
  { name: "get_asset_performance", title: "Get Asset Performance", description: "Get individual asset performance ratings.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, assetGroupId: { type: "string" } } }, outputs: { type: "object", properties: { assets: { type: "array" } } } },
  { name: "list_video_campaigns", title: "List Video Campaigns", description: "Get all YouTube/video campaigns with view metrics.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "get_video_metrics", title: "Get Video Metrics", description: "Get video-specific metrics (view rate, watch time, engagement).", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { campaignId: { type: "string" }, dateRange: { type: "string" } } }, outputs: { type: "object", properties: { results: { type: "array" } } } },
  { name: "bulk_update_bids", title: "Bulk Update Bids", description: "Update bids for multiple keywords or ad groups in a single request.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:mutate", inputs: { type: "object", properties: { operations: { type: "array", items: { type: "object", properties: { adGroupId: { type: "string" }, criterionId: { type: "string", description: "For keyword bids" }, cpcBidMicros: { type: "integer" } } }, description: "Bid update operations (max 10,000)" }, partialFailure: { type: "boolean", description: "Continue on individual failures" } }, required: ["operations"] }, outputs: { type: "object", properties: { successCount: { type: "integer" }, failureCount: { type: "integer" }, errors: { type: "array" } } } },
  { name: "bulk_pause_entities", title: "Bulk Pause Entities", description: "Pause multiple campaigns, ad groups, or ads at once.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:mutate", inputs: { type: "object", properties: { entityType: { type: "string", enum: ["campaigns", "ad_groups", "ads", "keywords"] }, resourceNames: { type: "array", items: { type: "string" } }, partialFailure: { type: "boolean" } }, required: ["entityType", "resourceNames"] }, outputs: { type: "object", properties: { successCount: { type: "integer" }, failureCount: { type: "integer" } } } },
  { name: "export_to_csv", title: "Export to CSV", description: "Export campaign, ad group, or keyword data to CSV format.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { entityType: { type: "string", enum: ["campaigns", "ad_groups", "ads", "keywords"] }, fields: { type: "array", items: { type: "string" }, description: "Fields to include" }, dateRange: { type: "string" }, filters: { type: "object" } }, required: ["entityType"] }, outputs: { type: "object", properties: { csvData: { type: "string" }, rowCount: { type: "integer" } } } },
  { name: "list_accessible_accounts", title: "List Accessible Accounts", description: "Get all accounts accessible with the current credentials (for MCC users).", httpMethod: "GET", pathTemplate: "/customers:listAccessibleCustomers", inputs: { type: "object", properties: {} }, outputs: { type: "object", properties: { accounts: { type: "array", description: "Array of customer IDs and names" } } } },
  { name: "get_account_info", title: "Get Account Info", description: "Get account details including currency, timezone, and status.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: {} }, outputs: { type: "object", properties: { customer: { type: "object" } } } },
  { name: "get_account_hierarchy", title: "Get Account Hierarchy", description: "Get the MCC account structure (for manager accounts).", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: {} }, outputs: { type: "object", properties: { hierarchy: { type: "array" } } } },
  { name: "list_experiments", title: "List Experiments", description: "Get all A/B test experiments and their status.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { status: { type: "string", enum: ["ENABLED", "REMOVED", "HALTED", "PROMOTED", "SETUP", "INITIATED", "GRADUATED"] } } }, outputs: { type: "object", properties: { experiments: { type: "array" } } } },
  { name: "create_experiment", title: "Create Experiment", description: "Set up an A/B test for campaign settings.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/experiments:mutate", inputs: { type: "object", properties: { name: { type: "string" }, baseCampaignId: { type: "string", description: "Campaign to experiment on" }, trafficSplitPercent: { type: "integer", description: "Percentage of traffic for experiment (e.g., 50)" }, startDate: { type: "string" }, endDate: { type: "string" } }, required: ["name", "baseCampaignId", "trafficSplitPercent"] }, outputs: { type: "object", properties: { resourceName: { type: "string" } } } },
  { name: "get_experiment_results", title: "Get Experiment Results", description: "Get A/B test performance comparison data.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/googleAds:search", inputs: { type: "object", properties: { experimentId: { type: "string" } }, required: ["experimentId"] }, outputs: { type: "object", properties: { baseResults: { type: "object" }, experimentResults: { type: "object" }, statisticalSignificance: { type: "boolean" }, winner: { type: "string" } } } },
  { name: "end_experiment", title: "End Experiment", description: "Conclude an experiment and optionally promote the winner.", httpMethod: "POST", pathTemplate: "/customers/{customerId}/experiments:mutate", inputs: { type: "object", properties: { experimentId: { type: "string" }, promoteWinner: { type: "boolean", description: "Apply winning variation to base campaign" } }, required: ["experimentId"] }, outputs: { type: "object", properties: { success: { type: "boolean" } } } },
];

const serviceTitanDefaultTools = [
  // Module 1: Job Management (14 tools)
  { name: "list_jobs", title: "List Jobs", description: "Get all jobs with filtering by status, technician, date range, job type, business unit, and customer.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs", inputs: { type: "object", properties: { status: { type: "string", enum: ["Pending", "Scheduled", "InProgress", "Completed", "Canceled", "Hold"] }, technicianId: { type: "integer", description: "Filter by assigned technician ID" }, jobTypeId: { type: "integer", description: "Filter by job type ID" }, businessUnitId: { type: "integer", description: "Filter by business unit ID" }, customerId: { type: "integer", description: "Filter by customer ID" }, locationId: { type: "integer", description: "Filter by location ID" }, campaignId: { type: "integer", description: "Filter by marketing campaign ID" }, startsOnOrAfter: { type: "string", format: "date-time" }, startsOnOrBefore: { type: "string", format: "date-time" }, modifiedOnOrAfter: { type: "string", format: "date-time" }, createdOnOrAfter: { type: "string", format: "date-time" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string" }, orderByDirection: { type: "string", enum: ["asc", "desc"] } } }, outputs: { type: "object", properties: { page: { type: "integer" }, pageSize: { type: "integer" }, totalCount: { type: "integer" }, hasMore: { type: "boolean" }, data: { type: "array", items: { type: "object" } } } } },
  { name: "get_job_details", title: "Get Job Details", description: "Get complete job information including customer, location, equipment, appointments, invoices, and service history.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}", inputs: { type: "object", properties: { jobId: { type: "integer", description: "The job ID" } }, required: ["jobId"] }, outputs: { type: "object" } },
  { name: "create_job", title: "Create Job", description: "Schedule a new service call. Requires customer, location, business unit, and job type.", httpMethod: "POST", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs", inputs: { type: "object", properties: { customerId: { type: "integer" }, locationId: { type: "integer" }, businessUnitId: { type: "integer" }, jobTypeId: { type: "integer" }, priority: { type: "string", enum: ["Normal", "High", "Urgent"] }, summary: { type: "string" }, campaignId: { type: "integer" }, tagTypeIds: { type: "array", items: { type: "integer" } }, noCharge: { type: "boolean" }, notificationsEnabled: { type: "boolean" }, externalId: { type: "string" } }, required: ["customerId", "locationId", "businessUnitId", "jobTypeId"] }, outputs: { type: "object" } },
  { name: "update_job", title: "Update Job", description: "Modify job details such as type, priority, summary, and tags.", httpMethod: "PATCH", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}", inputs: { type: "object", properties: { jobId: { type: "integer", description: "The job ID" }, jobTypeId: { type: "integer" }, priority: { type: "string" }, summary: { type: "string" }, noCharge: { type: "boolean" }, notificationsEnabled: { type: "boolean" }, tagTypeIds: { type: "array", items: { type: "integer" } } }, required: ["jobId"] }, outputs: { type: "object" } },
  { name: "assign_technician", title: "Assign Technician", description: "Assign or reassign a technician to a job appointment. Updates the dispatch board.", httpMethod: "PUT", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments/{appointmentId}/assign", inputs: { type: "object", properties: { appointmentId: { type: "integer" }, technicianIds: { type: "array", items: { type: "integer" }, description: "Technician IDs to assign" } }, required: ["appointmentId", "technicianIds"] }, outputs: { type: "object" } },
  { name: "get_job_status", title: "Get Job Status", description: "Get the current status of a job (Pending, Scheduled, InProgress, Completed, Canceled).", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}", inputs: { type: "object", properties: { jobId: { type: "integer" } }, required: ["jobId"] }, outputs: { type: "object", properties: { id: { type: "integer" }, status: { type: "string" }, modifiedOn: { type: "string" } } } },
  { name: "complete_job", title: "Complete Job", description: "Mark a job as finished. Updates job status to Completed.", httpMethod: "PATCH", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}/complete", inputs: { type: "object", properties: { jobId: { type: "integer" } }, required: ["jobId"] }, outputs: { type: "object" } },
  { name: "cancel_job", title: "Cancel Job", description: "Cancel a scheduled job. Frees up technician availability.", httpMethod: "PATCH", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}/cancel", inputs: { type: "object", properties: { jobId: { type: "integer" }, reasonId: { type: "integer", description: "Cancellation reason ID" }, memo: { type: "string", description: "Cancellation notes" } }, required: ["jobId"] }, outputs: { type: "object" } },
  { name: "reschedule_job", title: "Reschedule Job", description: "Change appointment times for a scheduled job. Can update start/end times and arrival window.", httpMethod: "PUT", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments/{appointmentId}/reschedule", inputs: { type: "object", properties: { appointmentId: { type: "integer" }, start: { type: "string", format: "date-time" }, end: { type: "string", format: "date-time" }, arrivalWindowStart: { type: "string", format: "date-time" }, arrivalWindowEnd: { type: "string", format: "date-time" } }, required: ["appointmentId", "start", "end"] }, outputs: { type: "object" } },
  { name: "get_job_history", title: "Get Job History", description: "Get historical jobs for a customer or location. Useful for reviewing service patterns.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs", inputs: { type: "object", properties: { customerId: { type: "integer" }, locationId: { type: "integer" }, status: { type: "string" }, startsOnOrAfter: { type: "string", format: "date-time" }, startsOnOrBefore: { type: "string", format: "date-time" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string", default: "createdOn" }, orderByDirection: { type: "string", default: "desc" } } }, outputs: { type: "object" } },
  { name: "add_job_notes", title: "Add Job Notes", description: "Add internal notes to a job visible to technicians and office staff.", httpMethod: "POST", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}/notes", inputs: { type: "object", properties: { jobId: { type: "integer" }, text: { type: "string", description: "Note content" }, isPinned: { type: "boolean", default: false } }, required: ["jobId", "text"] }, outputs: { type: "object" } },
  { name: "get_job_photos", title: "Get Job Photos", description: "Retrieve before/after photos attached to a job, including CompanyCam integration photos.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs/{jobId}/attachments", inputs: { type: "object", properties: { jobId: { type: "integer" } }, required: ["jobId"] }, outputs: { type: "object", properties: { data: { type: "array", items: { type: "object" } } } } },
  { name: "get_job_location", title: "Get Job Location", description: "Get GPS coordinates and address details for a job's service location.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/locations/{locationId}", inputs: { type: "object", properties: { locationId: { type: "integer" } }, required: ["locationId"] }, outputs: { type: "object" } },
  { name: "estimated_arrival_time", title: "Estimated Arrival Time", description: "Get ETA for a technician arriving at a job site. Uses current GPS position and appointment data.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments/{appointmentId}", inputs: { type: "object", properties: { appointmentId: { type: "integer" } }, required: ["appointmentId"] }, outputs: { type: "object", properties: { id: { type: "integer" }, start: { type: "string" }, end: { type: "string" }, arrivalWindowStart: { type: "string" }, arrivalWindowEnd: { type: "string" }, status: { type: "string" } } } },
  // Module 2: Customer Management (15 tools)
  { name: "list_customers", title: "List Customers", description: "Search and list customers with filtering by name, phone, email, type, active membership status, and date ranges.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers", inputs: { type: "object", properties: { name: { type: "string" }, phoneNumber: { type: "string" }, email: { type: "string" }, type: { type: "string", enum: ["Residential", "Commercial"] }, hasActiveMembership: { type: "boolean" }, createdOnOrAfter: { type: "string", format: "date-time" }, modifiedOnOrAfter: { type: "string", format: "date-time" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string" }, orderByDirection: { type: "string", enum: ["asc", "desc"] } } }, outputs: { type: "object" } },
  { name: "get_customer_details", title: "Get Customer Details", description: "Full customer profile including contact info, properties, equipment, job history, memberships, and balance.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}", inputs: { type: "object", properties: { customerId: { type: "integer" } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "create_customer", title: "Create Customer", description: "Add a new customer to the database with contact information and address.", httpMethod: "POST", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers", inputs: { type: "object", properties: { name: { type: "string" }, type: { type: "string", enum: ["Residential", "Commercial"] }, address: { type: "object", properties: { street: { type: "string" }, unit: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip: { type: "string" }, country: { type: "string" } }, required: ["street", "city", "state", "zip"] }, email: { type: "string", format: "email" }, phoneNumber: { type: "string" }, doNotMail: { type: "boolean" }, tagTypeIds: { type: "array", items: { type: "integer" } } }, required: ["name", "type", "address"] }, outputs: { type: "object" } },
  { name: "update_customer", title: "Update Customer", description: "Modify customer information including contact details, address, and tags.", httpMethod: "PATCH", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}", inputs: { type: "object", properties: { customerId: { type: "integer" }, name: { type: "string" }, type: { type: "string", enum: ["Residential", "Commercial"] }, address: { type: "object" }, email: { type: "string", format: "email" }, phoneNumber: { type: "string" }, doNotMail: { type: "boolean" }, doNotService: { type: "boolean" }, tagTypeIds: { type: "array", items: { type: "integer" } } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "merge_customers", title: "Merge Customers", description: "Consolidate duplicate customer records. Merges job history, equipment, and invoices into primary record.", httpMethod: "POST", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}/merge", inputs: { type: "object", properties: { customerId: { type: "integer", description: "Primary customer ID (survives)" }, mergeFromCustomerId: { type: "integer", description: "Duplicate customer ID (will be merged)" } }, required: ["customerId", "mergeFromCustomerId"] }, outputs: { type: "object" } },
  { name: "get_customer_properties", title: "Get Customer Properties", description: "Get all service locations/properties associated with a customer.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}/locations", inputs: { type: "object", properties: { customerId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "add_property", title: "Add Property", description: "Add a new service location/property to a customer.", httpMethod: "POST", pathTemplate: "/crm/v2/tenant/{tenant_id}/locations", inputs: { type: "object", properties: { customerId: { type: "integer" }, name: { type: "string" }, address: { type: "object", properties: { street: { type: "string" }, unit: { type: "string" }, city: { type: "string" }, state: { type: "string" }, zip: { type: "string" } }, required: ["street", "city", "state", "zip"] }, taxZoneId: { type: "integer" } }, required: ["customerId", "address"] }, outputs: { type: "object" } },
  { name: "get_customer_equipment", title: "Get Customer Equipment", description: "List all equipment (HVAC units, water heaters, etc.) registered to a customer across all locations.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}/equipment", inputs: { type: "object", properties: { customerId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "add_equipment", title: "Add Equipment", description: "Register new equipment (HVAC unit, water heater, etc.) at a customer location.", httpMethod: "POST", pathTemplate: "/crm/v2/tenant/{tenant_id}/equipment", inputs: { type: "object", properties: { customerId: { type: "integer" }, locationId: { type: "integer" }, name: { type: "string" }, manufacturer: { type: "string" }, model: { type: "string" }, serialNumber: { type: "string" }, installDate: { type: "string", format: "date" }, warrantyExpiration: { type: "string", format: "date" }, equipmentType: { type: "string" }, notes: { type: "string" } }, required: ["customerId", "locationId", "name", "equipmentType"] }, outputs: { type: "object" } },
  { name: "get_customer_invoices", title: "Get Customer Invoices", description: "Get billing history for a customer. All invoices with status and balance.", httpMethod: "GET", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices", inputs: { type: "object", properties: { customerId: { type: "integer" }, status: { type: "string", enum: ["Pending", "Open", "Paid", "PartiallyPaid", "Void"] }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string", default: "createdOn" }, orderByDirection: { type: "string", default: "desc" } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "get_customer_job_history", title: "Get Customer Job History", description: "All past service calls for a customer, sorted by date.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/jobs", inputs: { type: "object", properties: { customerId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string", default: "createdOn" }, orderByDirection: { type: "string", default: "desc" } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "get_customer_memberships", title: "Get Customer Memberships", description: "Get all maintenance plans and subscriptions for a customer.", httpMethod: "GET", pathTemplate: "/memberships/v2/tenant/{tenant_id}/memberships", inputs: { type: "object", properties: { customerId: { type: "integer" }, status: { type: "string", enum: ["Active", "Expired", "Canceled", "Suspended"] }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } }, required: ["customerId"] }, outputs: { type: "object" } },
  { name: "get_customer_balance", title: "Get Customer Balance", description: "Get outstanding balance for a customer across all invoices.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}", inputs: { type: "object", properties: { customerId: { type: "integer" } }, required: ["customerId"] }, outputs: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" }, balance: { type: "number" } } } },
  { name: "tag_customer", title: "Tag Customer", description: "Add tags to a customer (VIP, commercial, rental property, priority, etc.).", httpMethod: "PATCH", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}", inputs: { type: "object", properties: { customerId: { type: "integer" }, tagTypeIds: { type: "array", items: { type: "integer" }, description: "Tag type IDs to apply" } }, required: ["customerId", "tagTypeIds"] }, outputs: { type: "object" } },
  { name: "get_customer_communications", title: "Get Customer Communications", description: "Get communication history: call logs, emails, and text messages for a customer.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/customers/{customerId}/contacts", inputs: { type: "object", properties: { customerId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } }, required: ["customerId"] }, outputs: { type: "object" } },
  // Module 3: Scheduling & Dispatch (13 tools)
  { name: "get_schedule", title: "Get Schedule", description: "Get daily or weekly technician schedules. Shows all appointments, shifts, and availability for a date range.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments", inputs: { type: "object", properties: { startsOnOrAfter: { type: "string", format: "date-time" }, startsOnOrBefore: { type: "string", format: "date-time" }, technicianId: { type: "integer" }, businessUnitId: { type: "integer" }, status: { type: "string", enum: ["Scheduled", "Dispatched", "Working", "Done", "Canceled"] }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 200 } }, required: ["startsOnOrAfter"] }, outputs: { type: "object" } },
  { name: "get_technician_availability", title: "Get Technician Availability", description: "Check open time slots for a technician on a given date range.", httpMethod: "GET", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/capacity", inputs: { type: "object", properties: { technicianId: { type: "integer" }, startsOnOrAfter: { type: "string", format: "date-time" }, startsOnOrBefore: { type: "string", format: "date-time" }, businessUnitId: { type: "integer" } }, required: ["startsOnOrAfter"] }, outputs: { type: "object" } },
  { name: "schedule_appointment", title: "Schedule Appointment", description: "Book a service call appointment for a job. Assigns time slot and optionally technician.", httpMethod: "POST", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments", inputs: { type: "object", properties: { jobId: { type: "integer" }, start: { type: "string", format: "date-time" }, end: { type: "string", format: "date-time" }, arrivalWindowStart: { type: "string", format: "date-time" }, arrivalWindowEnd: { type: "string", format: "date-time" }, technicianIds: { type: "array", items: { type: "integer" } } }, required: ["jobId", "start", "end"] }, outputs: { type: "object" } },
  { name: "optimize_routes", title: "Optimize Routes", description: "Run AI-powered route optimization for technician schedules on a given date.", httpMethod: "POST", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/routes/optimize", inputs: { type: "object", properties: { date: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, technicianIds: { type: "array", items: { type: "integer" } } }, required: ["date"] }, outputs: { type: "object" } },
  { name: "get_dispatch_board", title: "Get Dispatch Board", description: "Real-time dispatch board view showing all technicians, their current jobs, and unassigned appointments.", httpMethod: "GET", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/board", inputs: { type: "object", properties: { date: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, zoneId: { type: "integer" } }, required: ["date"] }, outputs: { type: "object" } },
  { name: "send_to_technician", title: "Send to Technician", description: "Push a job/appointment to a technician's mobile app for dispatch.", httpMethod: "POST", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments/{appointmentId}/dispatch", inputs: { type: "object", properties: { appointmentId: { type: "integer" } }, required: ["appointmentId"] }, outputs: { type: "object" } },
  { name: "get_technician_location", title: "Get Technician Location", description: "Get real-time GPS location of a technician from their mobile device.", httpMethod: "GET", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/technicians/{technicianId}/location", inputs: { type: "object", properties: { technicianId: { type: "integer" } }, required: ["technicianId"] }, outputs: { type: "object", properties: { technicianId: { type: "integer" }, latitude: { type: "number" }, longitude: { type: "number" }, lastUpdated: { type: "string" }, heading: { type: "number" }, speed: { type: "number" } } } },
  { name: "get_time_slot_availability", title: "Get Time Slot Availability", description: "Get available appointment windows for booking, considering technician schedules and capacity.", httpMethod: "GET", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/availability", inputs: { type: "object", properties: { date: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, jobTypeId: { type: "integer" }, zoneId: { type: "integer" } }, required: ["date", "businessUnitId"] }, outputs: { type: "object" } },
  { name: "create_recurring_job", title: "Create Recurring Job", description: "Set up recurring maintenance schedules (weekly, monthly, quarterly, annual).", httpMethod: "POST", pathTemplate: "/jpm/v2/tenant/{tenant_id}/recurring-services", inputs: { type: "object", properties: { customerId: { type: "integer" }, locationId: { type: "integer" }, jobTypeId: { type: "integer" }, businessUnitId: { type: "integer" }, frequency: { type: "string", enum: ["Weekly", "BiWeekly", "Monthly", "Quarterly", "SemiAnnual", "Annual"] }, startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" }, memo: { type: "string" } }, required: ["customerId", "locationId", "jobTypeId", "businessUnitId", "frequency", "startDate"] }, outputs: { type: "object" } },
  { name: "get_recurring_jobs", title: "Get Recurring Jobs", description: "List all recurring service appointments with schedules and frequencies.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/recurring-services", inputs: { type: "object", properties: { customerId: { type: "integer" }, active: { type: "boolean" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "bulk_schedule", title: "Bulk Schedule", description: "Schedule multiple jobs at once. Batch operation for efficient dispatching.", httpMethod: "POST", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments/batch", inputs: { type: "object", properties: { appointments: { type: "array", items: { type: "object", properties: { jobId: { type: "integer" }, start: { type: "string", format: "date-time" }, end: { type: "string", format: "date-time" }, technicianIds: { type: "array", items: { type: "integer" } } }, required: ["jobId", "start", "end"] } } }, required: ["appointments"] }, outputs: { type: "object" } },
  { name: "get_schedule_conflicts", title: "Get Schedule Conflicts", description: "Identify double-bookings and scheduling conflicts for technicians on a given date.", httpMethod: "GET", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/conflicts", inputs: { type: "object", properties: { date: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, technicianId: { type: "integer" } }, required: ["date"] }, outputs: { type: "object" } },
  { name: "get_capacity_forecast", title: "Get Capacity Forecast", description: "Predict scheduling capacity for upcoming days/weeks based on technician availability and existing bookings.", httpMethod: "GET", pathTemplate: "/dispatch/v2/tenant/{tenant_id}/capacity/forecast", inputs: { type: "object", properties: { startsOnOrAfter: { type: "string", format: "date" }, startsOnOrBefore: { type: "string", format: "date" }, businessUnitId: { type: "integer" } }, required: ["startsOnOrAfter", "startsOnOrBefore"] }, outputs: { type: "object" } },
  // Module 4: Estimates & Quotes (12 tools)
  { name: "create_estimate", title: "Create Estimate", description: "Build a service quote/estimate for a job with line items from the pricebook.", httpMethod: "POST", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates", inputs: { type: "object", properties: { jobId: { type: "integer" }, name: { type: "string" }, summary: { type: "string" }, items: { type: "array", items: { type: "object", properties: { skuId: { type: "integer" }, qty: { type: "number" }, unitPrice: { type: "number" }, description: { type: "string" } }, required: ["skuId", "qty"] } }, externalId: { type: "string" } }, required: ["jobId", "name", "items"] }, outputs: { type: "object" } },
  { name: "get_estimate", title: "Get Estimate", description: "Retrieve full estimate details including line items, totals, and status.", httpMethod: "GET", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/{estimateId}", inputs: { type: "object", properties: { estimateId: { type: "integer" } }, required: ["estimateId"] }, outputs: { type: "object" } },
  { name: "update_estimate", title: "Update Estimate", description: "Modify a quote - change items, pricing, or description.", httpMethod: "PATCH", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/{estimateId}", inputs: { type: "object", properties: { estimateId: { type: "integer" }, name: { type: "string" }, summary: { type: "string" }, items: { type: "array", items: { type: "object" } } }, required: ["estimateId"] }, outputs: { type: "object" } },
  { name: "send_estimate_to_customer", title: "Send Estimate to Customer", description: "Email or text the estimate to the customer for review and approval.", httpMethod: "POST", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/{estimateId}/send", inputs: { type: "object", properties: { estimateId: { type: "integer" }, method: { type: "string", enum: ["email", "sms", "both"] }, email: { type: "string", format: "email" }, phoneNumber: { type: "string" }, message: { type: "string" } }, required: ["estimateId"] }, outputs: { type: "object" } },
  { name: "convert_estimate_to_job", title: "Convert Estimate to Job", description: "Accept an estimate and convert it to a scheduled job with invoicing.", httpMethod: "POST", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/{estimateId}/convert", inputs: { type: "object", properties: { estimateId: { type: "integer" } }, required: ["estimateId"] }, outputs: { type: "object" } },
  { name: "get_estimate_status", title: "Get Estimate Status", description: "Check current status of an estimate: Open, Sold, Dismissed, or Expired.", httpMethod: "GET", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/{estimateId}", inputs: { type: "object", properties: { estimateId: { type: "integer" } }, required: ["estimateId"] }, outputs: { type: "object", properties: { id: { type: "integer" }, status: { type: "string" }, total: { type: "number" }, sentOn: { type: "string" }, approvedOn: { type: "string" } } } },
  { name: "get_pricebook", title: "Get Pricebook", description: "Get the full pricebook of services, materials, and equipment with pricing.", httpMethod: "GET", pathTemplate: "/pricebook/v2/tenant/{tenant_id}/materials", inputs: { type: "object", properties: { type: { type: "string", enum: ["Service", "Material", "Equipment"] }, categoryId: { type: "integer" }, active: { type: "boolean", default: true }, search: { type: "string" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 100 } } }, outputs: { type: "object" } },
  { name: "add_pricebook_item", title: "Add Pricebook Item", description: "Create a new service, material, or equipment entry in the pricebook.", httpMethod: "POST", pathTemplate: "/pricebook/v2/tenant/{tenant_id}/materials", inputs: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, description: { type: "string" }, price: { type: "number" }, cost: { type: "number" }, type: { type: "string", enum: ["Service", "Material", "Equipment"] }, categoryId: { type: "integer" }, active: { type: "boolean", default: true }, taxable: { type: "boolean", default: true } }, required: ["code", "name", "price", "type"] }, outputs: { type: "object" } },
  { name: "update_pricing", title: "Update Pricing", description: "Modify pricing for a pricebook item. Update retail price, cost, or active status.", httpMethod: "PATCH", pathTemplate: "/pricebook/v2/tenant/{tenant_id}/materials/{materialId}", inputs: { type: "object", properties: { materialId: { type: "integer" }, price: { type: "number" }, cost: { type: "number" }, name: { type: "string" }, description: { type: "string" }, active: { type: "boolean" } }, required: ["materialId"] }, outputs: { type: "object" } },
  { name: "get_estimate_templates", title: "Get Estimate Templates", description: "Get pre-built quote templates for common service scenarios.", httpMethod: "GET", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/templates", inputs: { type: "object", properties: { search: { type: "string" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "calculate_materials", title: "Calculate Materials", description: "Calculate parts and materials needed for a specific job type or estimate.", httpMethod: "GET", pathTemplate: "/pricebook/v2/tenant/{tenant_id}/materials/calculate", inputs: { type: "object", properties: { jobTypeId: { type: "integer" }, estimateId: { type: "integer" } } }, outputs: { type: "object" } },
  { name: "get_margin_analysis", title: "Get Margin Analysis", description: "Analyze profit margins on estimates - compare retail price vs cost for each line item.", httpMethod: "GET", pathTemplate: "/sales/v2/tenant/{tenant_id}/estimates/{estimateId}/margins", inputs: { type: "object", properties: { estimateId: { type: "integer" } }, required: ["estimateId"] }, outputs: { type: "object" } },
  // Module 5: Invoicing & Payments (14 tools)
  { name: "create_invoice", title: "Create Invoice", description: "Generate an invoice for a completed job with line items from pricebook.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices", inputs: { type: "object", properties: { jobId: { type: "integer" }, items: { type: "array", items: { type: "object", properties: { skuId: { type: "integer" }, qty: { type: "number" }, unitPrice: { type: "number" }, description: { type: "string" } }, required: ["skuId", "qty"] } }, dueDate: { type: "string", format: "date" } }, required: ["jobId", "items"] }, outputs: { type: "object" } },
  { name: "get_invoice", title: "Get Invoice", description: "Retrieve full invoice details including items, payments, and balance.", httpMethod: "GET", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices/{invoiceId}", inputs: { type: "object", properties: { invoiceId: { type: "integer" } }, required: ["invoiceId"] }, outputs: { type: "object" } },
  { name: "send_invoice", title: "Send Invoice", description: "Email or text an invoice to the customer.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices/{invoiceId}/send", inputs: { type: "object", properties: { invoiceId: { type: "integer" }, method: { type: "string", enum: ["email", "sms", "both"] }, email: { type: "string", format: "email" }, message: { type: "string" } }, required: ["invoiceId"] }, outputs: { type: "object" } },
  { name: "record_payment", title: "Record Payment", description: "Log a payment against an invoice (cash, check, ACH, financing).", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/payments", inputs: { type: "object", properties: { invoiceId: { type: "integer" }, amount: { type: "number" }, type: { type: "string", enum: ["Cash", "Check", "CreditCard", "ACH", "Financing", "Other"] }, reference: { type: "string" }, memo: { type: "string" }, paidOn: { type: "string", format: "date" } }, required: ["invoiceId", "amount", "type"] }, outputs: { type: "object" } },
  { name: "void_invoice", title: "Void Invoice", description: "Cancel/void an invoice. Cannot void invoices with payments applied.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices/{invoiceId}/void", inputs: { type: "object", properties: { invoiceId: { type: "integer" }, reason: { type: "string" } }, required: ["invoiceId"] }, outputs: { type: "object" } },
  { name: "get_payment_status", title: "Get Payment Status", description: "Check payment status of an invoice: Paid, Partial, Outstanding.", httpMethod: "GET", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices/{invoiceId}", inputs: { type: "object", properties: { invoiceId: { type: "integer" } }, required: ["invoiceId"] }, outputs: { type: "object", properties: { id: { type: "integer" }, status: { type: "string" }, total: { type: "number" }, balance: { type: "number" } } } },
  { name: "process_card_payment", title: "Process Card Payment", description: "Charge a credit card for an invoice. PCI-compliant tokenized processing.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/payments/card", inputs: { type: "object", properties: { invoiceId: { type: "integer" }, amount: { type: "number" }, paymentToken: { type: "string" } }, required: ["invoiceId", "amount", "paymentToken"] }, outputs: { type: "object" } },
  { name: "get_outstanding_invoices", title: "Get Outstanding Invoices", description: "List all unpaid or partially paid invoices (accounts receivable).", httpMethod: "GET", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices", inputs: { type: "object", properties: { status: { type: "string", enum: ["Open", "PartiallyPaid"] }, customerId: { type: "integer" }, dueDateOnOrBefore: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string", default: "dueDate" }, orderByDirection: { type: "string", default: "asc" } } }, outputs: { type: "object" } },
  { name: "send_payment_reminder", title: "Send Payment Reminder", description: "Send automated payment reminder to customer for outstanding invoice.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices/{invoiceId}/remind", inputs: { type: "object", properties: { invoiceId: { type: "integer" }, method: { type: "string", enum: ["email", "sms", "both"] }, message: { type: "string" } }, required: ["invoiceId"] }, outputs: { type: "object" } },
  { name: "apply_discount", title: "Apply Discount", description: "Add a discount to an invoice (percentage or flat amount).", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/invoices/{invoiceId}/discount", inputs: { type: "object", properties: { invoiceId: { type: "integer" }, type: { type: "string", enum: ["percentage", "flat"] }, value: { type: "number" }, reason: { type: "string" } }, required: ["invoiceId", "type", "value"] }, outputs: { type: "object" } },
  { name: "refund_payment", title: "Refund Payment", description: "Process a refund for a payment. Full or partial refund supported.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/payments/{paymentId}/refund", inputs: { type: "object", properties: { paymentId: { type: "integer" }, amount: { type: "number" }, reason: { type: "string" } }, required: ["paymentId"] }, outputs: { type: "object" } },
  { name: "get_payment_history", title: "Get Payment History", description: "Transaction history of all payments with filtering by date, type, and customer.", httpMethod: "GET", pathTemplate: "/accounting/v2/tenant/{tenant_id}/payments", inputs: { type: "object", properties: { customerId: { type: "integer" }, invoiceId: { type: "integer" }, type: { type: "string", enum: ["Cash", "Check", "CreditCard", "ACH", "Financing", "Other"] }, paidOnOrAfter: { type: "string", format: "date" }, paidOnOrBefore: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "export_invoices_to_accounting", title: "Export Invoices to Accounting", description: "Sync invoices to QuickBooks or other accounting software.", httpMethod: "POST", pathTemplate: "/accounting/v2/tenant/{tenant_id}/export/invoices", inputs: { type: "object", properties: { invoiceIds: { type: "array", items: { type: "integer" } }, target: { type: "string", enum: ["quickbooks", "xero", "sage"] }, dateRange: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" } } } } }, outputs: { type: "object" } },
  { name: "generate_financial_report", title: "Generate Financial Report", description: "Generate revenue, accounts receivable, and collections reports for a period.", httpMethod: "GET", pathTemplate: "/accounting/v2/tenant/{tenant_id}/reports/financial", inputs: { type: "object", properties: { reportType: { type: "string", enum: ["revenue", "ar", "collections", "summary"] }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" } }, required: ["reportType", "from", "to"] }, outputs: { type: "object" } },
  // Module 6: Inventory (12 tools)
  { name: "list_inventory", title: "List Inventory", description: "List all parts and materials in inventory across warehouses and trucks.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/items", inputs: { type: "object", properties: { search: { type: "string" }, warehouseId: { type: "integer" }, truckId: { type: "integer" }, lowStock: { type: "boolean" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "get_inventory_levels", title: "Get Inventory Levels", description: "Get current stock quantities for specific items or all inventory.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/levels", inputs: { type: "object", properties: { skuIds: { type: "string", description: "Comma-separated SKU IDs" }, warehouseId: { type: "integer" }, truckId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 100 } } }, outputs: { type: "object" } },
  { name: "update_inventory_count", title: "Update Inventory Count", description: "Adjust stock quantity for an item (physical count correction).", httpMethod: "PATCH", pathTemplate: "/inventory/v2/tenant/{tenant_id}/items/{itemId}/adjust", inputs: { type: "object", properties: { itemId: { type: "integer" }, quantity: { type: "number" }, reason: { type: "string", enum: ["PhysicalCount", "Damaged", "Returned", "Other"] }, notes: { type: "string" } }, required: ["itemId", "quantity", "reason"] }, outputs: { type: "object" } },
  { name: "add_inventory_item", title: "Add Inventory Item", description: "Create a new SKU/part in the inventory system.", httpMethod: "POST", pathTemplate: "/inventory/v2/tenant/{tenant_id}/items", inputs: { type: "object", properties: { skuId: { type: "integer" }, warehouseId: { type: "integer" }, quantity: { type: "number" }, minQuantity: { type: "number" }, maxQuantity: { type: "number" }, cost: { type: "number" } }, required: ["skuId", "quantity"] }, outputs: { type: "object" } },
  { name: "get_inventory_by_truck", title: "Get Inventory by Truck", description: "Get all parts and materials currently stocked on a specific technician's truck.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/trucks/{truckId}/items", inputs: { type: "object", properties: { truckId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 100 } }, required: ["truckId"] }, outputs: { type: "object" } },
  { name: "transfer_inventory", title: "Transfer Inventory", description: "Move parts between trucks and warehouses.", httpMethod: "POST", pathTemplate: "/inventory/v2/tenant/{tenant_id}/transfers", inputs: { type: "object", properties: { fromWarehouseId: { type: "integer" }, fromTruckId: { type: "integer" }, toWarehouseId: { type: "integer" }, toTruckId: { type: "integer" }, items: { type: "array", items: { type: "object", properties: { skuId: { type: "integer" }, quantity: { type: "number" } }, required: ["skuId", "quantity"] } } }, required: ["items"] }, outputs: { type: "object" } },
  { name: "get_purchase_orders", title: "Get Purchase Orders", description: "List all purchase orders from suppliers with status and items.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/purchase-orders", inputs: { type: "object", properties: { status: { type: "string", enum: ["Draft", "Submitted", "Received", "Canceled"] }, vendorId: { type: "integer" }, createdOnOrAfter: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "create_purchase_order", title: "Create Purchase Order", description: "Create a new purchase order for parts/materials from a vendor.", httpMethod: "POST", pathTemplate: "/inventory/v2/tenant/{tenant_id}/purchase-orders", inputs: { type: "object", properties: { vendorId: { type: "integer" }, items: { type: "array", items: { type: "object", properties: { skuId: { type: "integer" }, quantity: { type: "number" }, unitCost: { type: "number" } }, required: ["skuId", "quantity"] } }, notes: { type: "string" }, expectedDeliveryDate: { type: "string", format: "date" } }, required: ["vendorId", "items"] }, outputs: { type: "object" } },
  { name: "receive_purchase_order", title: "Receive Purchase Order", description: "Check in a delivery - update inventory levels and mark PO as received.", httpMethod: "POST", pathTemplate: "/inventory/v2/tenant/{tenant_id}/purchase-orders/{purchaseOrderId}/receive", inputs: { type: "object", properties: { purchaseOrderId: { type: "integer" }, items: { type: "array", items: { type: "object", properties: { skuId: { type: "integer" }, quantityReceived: { type: "number" } }, required: ["skuId", "quantityReceived"] } }, warehouseId: { type: "integer" }, notes: { type: "string" } }, required: ["purchaseOrderId", "items"] }, outputs: { type: "object" } },
  { name: "get_low_stock_alerts", title: "Get Low Stock Alerts", description: "Get items below minimum stock levels that need reordering.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/alerts/low-stock", inputs: { type: "object", properties: { warehouseId: { type: "integer" }, truckId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "get_inventory_value", title: "Get Inventory Value", description: "Get total monetary value of inventory across all warehouses and trucks.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/reports/value", inputs: { type: "object", properties: { warehouseId: { type: "integer" }, truckId: { type: "integer" } } }, outputs: { type: "object", properties: { totalValue: { type: "number" }, itemCount: { type: "integer" }, byLocation: { type: "array", items: { type: "object" } } } } },
  { name: "get_inventory_usage", title: "Get Inventory Usage", description: "Analyze parts usage by job type, technician, or period.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/reports/usage", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, jobTypeId: { type: "integer" }, technicianId: { type: "integer" }, skuId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } }, required: ["from", "to"] }, outputs: { type: "object" } },
  // Module 7: Technician Management (12 tools)
  { name: "list_technicians", title: "List Technicians", description: "Get all field technicians with filtering by business unit, active status, and skills.", httpMethod: "GET", pathTemplate: "/settings/v2/tenant/{tenant_id}/technicians", inputs: { type: "object", properties: { businessUnitId: { type: "integer" }, active: { type: "boolean" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "get_technician_profile", title: "Get Technician Profile", description: "Full technician profile: skills, certifications, pay rate, hire date, and contact info.", httpMethod: "GET", pathTemplate: "/settings/v2/tenant/{tenant_id}/technicians/{technicianId}", inputs: { type: "object", properties: { technicianId: { type: "integer" } }, required: ["technicianId"] }, outputs: { type: "object" } },
  { name: "get_technician_schedule", title: "Get Technician Schedule", description: "Get a specific technician's schedule for a date range, including shifts and appointments.", httpMethod: "GET", pathTemplate: "/jpm/v2/tenant/{tenant_id}/appointments", inputs: { type: "object", properties: { technicianId: { type: "integer" }, startsOnOrAfter: { type: "string", format: "date-time" }, startsOnOrBefore: { type: "string", format: "date-time" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 200 } }, required: ["technicianId", "startsOnOrAfter"] }, outputs: { type: "object" } },
  { name: "get_technician_performance", title: "Get Technician Performance", description: "Performance metrics: revenue generated, jobs completed, average ticket, customer ratings, conversion rate.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/technician-performance", inputs: { type: "object", properties: { technicianId: { type: "integer" }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "clock_in", title: "Clock In", description: "Record technician clock-in for time tracking.", httpMethod: "POST", pathTemplate: "/payroll/v2/tenant/{tenant_id}/timecards/clock-in", inputs: { type: "object", properties: { technicianId: { type: "integer" }, timestamp: { type: "string", format: "date-time" } }, required: ["technicianId"] }, outputs: { type: "object" } },
  { name: "clock_out", title: "Clock Out", description: "Record technician clock-out to end shift.", httpMethod: "POST", pathTemplate: "/payroll/v2/tenant/{tenant_id}/timecards/clock-out", inputs: { type: "object", properties: { technicianId: { type: "integer" }, timestamp: { type: "string", format: "date-time" } }, required: ["technicianId"] }, outputs: { type: "object" } },
  { name: "get_timecard", title: "Get Timecard", description: "Get hours worked, overtime, and PTO for a technician over a period.", httpMethod: "GET", pathTemplate: "/payroll/v2/tenant/{tenant_id}/timecards", inputs: { type: "object", properties: { technicianId: { type: "integer" }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } }, required: ["technicianId", "from", "to"] }, outputs: { type: "object" } },
  { name: "get_technician_commission", title: "Get Technician Commission", description: "Get earnings, commissions, and bonuses for a technician.", httpMethod: "GET", pathTemplate: "/payroll/v2/tenant/{tenant_id}/commissions", inputs: { type: "object", properties: { technicianId: { type: "integer" }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" } }, required: ["technicianId", "from", "to"] }, outputs: { type: "object" } },
  { name: "assign_technician_skills", title: "Assign Technician Skills", description: "Set specializations and skills for a technician (HVAC, plumbing, electrical, etc.).", httpMethod: "PUT", pathTemplate: "/settings/v2/tenant/{tenant_id}/technicians/{technicianId}/skills", inputs: { type: "object", properties: { technicianId: { type: "integer" }, skills: { type: "array", items: { type: "string" } }, certifications: { type: "array", items: { type: "string" } } }, required: ["technicianId", "skills"] }, outputs: { type: "object" } },
  { name: "get_technician_inventory", title: "Get Technician Inventory", description: "Get parts currently on a technician's truck.", httpMethod: "GET", pathTemplate: "/inventory/v2/tenant/{tenant_id}/technicians/{technicianId}/inventory", inputs: { type: "object", properties: { technicianId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 100 } }, required: ["technicianId"] }, outputs: { type: "object" } },
  { name: "submit_expense", title: "Submit Expense", description: "Submit a technician expense for reimbursement.", httpMethod: "POST", pathTemplate: "/payroll/v2/tenant/{tenant_id}/expenses", inputs: { type: "object", properties: { technicianId: { type: "integer" }, amount: { type: "number" }, category: { type: "string" }, description: { type: "string" }, date: { type: "string", format: "date" }, receipt: { type: "string" } }, required: ["technicianId", "amount", "category", "date"] }, outputs: { type: "object" } },
  { name: "get_expense_reports", title: "Get Expense Reports", description: "Get expense reports and reimbursement status for technicians.", httpMethod: "GET", pathTemplate: "/payroll/v2/tenant/{tenant_id}/expenses", inputs: { type: "object", properties: { technicianId: { type: "integer" }, status: { type: "string", enum: ["Pending", "Approved", "Denied", "Reimbursed"] }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  // Module 8: Marketing & Campaigns (11 tools)
  { name: "list_campaigns", title: "List Campaigns", description: "Get all marketing campaigns with performance metrics and status.", httpMethod: "GET", pathTemplate: "/marketing/v2/tenant/{tenant_id}/campaigns", inputs: { type: "object", properties: { active: { type: "boolean" }, category: { type: "string" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "create_campaign", title: "Create Campaign", description: "Create a new marketing campaign for tracking leads and ROI.", httpMethod: "POST", pathTemplate: "/marketing/v2/tenant/{tenant_id}/campaigns", inputs: { type: "object", properties: { name: { type: "string" }, category: { type: "string" }, source: { type: "string" }, medium: { type: "string" }, active: { type: "boolean", default: true } }, required: ["name", "category", "source"] }, outputs: { type: "object" } },
  { name: "get_leads", title: "Get Leads", description: "Get incoming leads with source, status, and contact information.", httpMethod: "GET", pathTemplate: "/crm/v2/tenant/{tenant_id}/leads", inputs: { type: "object", properties: { status: { type: "string", enum: ["New", "Contacted", "Qualified", "Converted", "Lost"] }, campaignId: { type: "integer" }, source: { type: "string" }, createdOnOrAfter: { type: "string", format: "date-time" }, createdOnOrBefore: { type: "string", format: "date-time" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "convert_lead", title: "Convert Lead", description: "Convert a qualified lead into a customer record and optionally schedule a job.", httpMethod: "POST", pathTemplate: "/crm/v2/tenant/{tenant_id}/leads/{leadId}/convert", inputs: { type: "object", properties: { leadId: { type: "integer" }, createJob: { type: "boolean" }, jobTypeId: { type: "integer" }, businessUnitId: { type: "integer" } }, required: ["leadId"] }, outputs: { type: "object" } },
  { name: "get_lead_source", title: "Get Lead Source", description: "Analyze where customers are coming from - marketing attribution by source and campaign.", httpMethod: "GET", pathTemplate: "/marketing/v2/tenant/{tenant_id}/lead-sources", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "send_marketing_email", title: "Send Marketing Email", description: "Send bulk marketing emails to a customer segment or list.", httpMethod: "POST", pathTemplate: "/marketing/v2/tenant/{tenant_id}/emails/send", inputs: { type: "object", properties: { campaignId: { type: "integer" }, templateId: { type: "integer" }, subject: { type: "string" }, body: { type: "string" }, customerIds: { type: "array", items: { type: "integer" } }, tagTypeIds: { type: "array", items: { type: "integer" } } }, required: ["campaignId", "subject"] }, outputs: { type: "object" } },
  { name: "send_marketing_sms", title: "Send Marketing SMS", description: "Send text message campaigns to customers. Requires opt-in compliance.", httpMethod: "POST", pathTemplate: "/marketing/v2/tenant/{tenant_id}/sms/send", inputs: { type: "object", properties: { campaignId: { type: "integer" }, message: { type: "string" }, customerIds: { type: "array", items: { type: "integer" } }, tagTypeIds: { type: "array", items: { type: "integer" } } }, required: ["campaignId", "message"] }, outputs: { type: "object" } },
  { name: "track_campaign_performance", title: "Track Campaign Performance", description: "Get ROI metrics for marketing campaigns: leads, conversions, revenue, cost per lead.", httpMethod: "GET", pathTemplate: "/marketing/v2/tenant/{tenant_id}/campaigns/{campaignId}/performance", inputs: { type: "object", properties: { campaignId: { type: "integer" }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" } }, required: ["campaignId"] }, outputs: { type: "object" } },
  { name: "get_customer_reviews", title: "Get Customer Reviews", description: "Get online reviews from customers across platforms (Google, Yelp, etc.).", httpMethod: "GET", pathTemplate: "/marketing/v2/tenant/{tenant_id}/reviews", inputs: { type: "object", properties: { customerId: { type: "integer" }, minRating: { type: "integer" }, maxRating: { type: "integer" }, platform: { type: "string" }, from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "request_review", title: "Request Review", description: "Send a review request to a customer after job completion.", httpMethod: "POST", pathTemplate: "/marketing/v2/tenant/{tenant_id}/reviews/request", inputs: { type: "object", properties: { customerId: { type: "integer" }, jobId: { type: "integer" }, method: { type: "string", enum: ["email", "sms", "both"] }, platform: { type: "string", enum: ["google", "yelp", "facebook"] } }, required: ["customerId", "jobId"] }, outputs: { type: "object" } },
  { name: "get_review_stats", title: "Get Review Stats", description: "Get aggregate review statistics: average rating, total count, distribution by platform.", httpMethod: "GET", pathTemplate: "/marketing/v2/tenant/{tenant_id}/reviews/stats", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, platform: { type: "string" } } }, outputs: { type: "object", properties: { averageRating: { type: "number" }, totalReviews: { type: "integer" }, byPlatform: { type: "array", items: { type: "object" } }, ratingDistribution: { type: "object" } } } },
  // Module 9: Reporting & Analytics (12 tools)
  { name: "get_revenue_report", title: "Get Revenue Report", description: "Revenue report by period with breakdowns by business unit and job type.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/revenue", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, groupBy: { type: "string", enum: ["day", "week", "month", "quarter"] } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_technician_revenue_report", title: "Get Technician Revenue Report", description: "Revenue generated per technician with job counts and average ticket.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/technician-revenue", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, technicianId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_job_type_report", title: "Get Job Type Report", description: "Revenue and job counts broken down by service type (HVAC install, plumbing repair, etc.).", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/job-type-revenue", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_average_ticket", title: "Get Average Ticket", description: "Average invoice amount across all jobs, with optional breakdowns.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/average-ticket", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, jobTypeId: { type: "integer" }, technicianId: { type: "integer" }, groupBy: { type: "string", enum: ["day", "week", "month"] } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_conversion_rate", title: "Get Conversion Rate", description: "Estimate-to-job conversion rate metrics by technician, job type, or period.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/conversion-rate", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, technicianId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_customer_retention", title: "Get Customer Retention", description: "Repeat customer rate and retention metrics over time.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/customer-retention", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_call_booking_rate", title: "Get Call Booking Rate", description: "Ratio of inbound calls that convert to scheduled jobs.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/call-booking-rate", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, campaignId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_outstanding_ar_report", title: "Get Outstanding AR Report", description: "Accounts receivable aging report: current, 30-day, 60-day, 90+ day buckets.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/accounts-receivable", inputs: { type: "object", properties: { asOfDate: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, minBalance: { type: "number" } } }, outputs: { type: "object", properties: { totalOutstanding: { type: "number" }, current: { type: "number" }, days30: { type: "number" }, days60: { type: "number" }, days90Plus: { type: "number" }, customers: { type: "array", items: { type: "object" } } } } },
  { name: "get_profitability_report", title: "Get Profitability Report", description: "Gross profit analysis by job, job type, or technician. Revenue vs cost of goods.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/profitability", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, groupBy: { type: "string", enum: ["jobType", "technician", "businessUnit"] } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_capacity_utilization", title: "Get Capacity Utilization", description: "Technician utilization rate - percentage of available hours that are booked.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/capacity-utilization", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, technicianId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_cancellation_report", title: "Get Cancellation Report", description: "Analysis of canceled jobs - reasons, frequency, revenue impact.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/cancellations", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, reasonId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_marketing_roi", title: "Get Marketing ROI", description: "Marketing spend vs revenue by campaign - cost per lead, cost per acquisition, ROAS.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/marketing-roi", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, campaignId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  // Module 10: Memberships (8 tools)
  { name: "list_membership_plans", title: "List Membership Plans", description: "Get all available maintenance plan types with pricing and benefits.", httpMethod: "GET", pathTemplate: "/memberships/v2/tenant/{tenant_id}/membership-types", inputs: { type: "object", properties: { active: { type: "boolean" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "create_membership", title: "Create Membership", description: "Create a new membership plan type with pricing, frequency, and benefits.", httpMethod: "POST", pathTemplate: "/memberships/v2/tenant/{tenant_id}/membership-types", inputs: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, price: { type: "number" }, billingFrequency: { type: "string", enum: ["Monthly", "Quarterly", "SemiAnnual", "Annual"] }, benefits: { type: "array", items: { type: "string" } }, discountPercentage: { type: "number" }, active: { type: "boolean", default: true } }, required: ["name", "price", "billingFrequency"] }, outputs: { type: "object" } },
  { name: "enroll_customer", title: "Enroll Customer", description: "Add a customer to a maintenance plan membership at a specific location.", httpMethod: "POST", pathTemplate: "/memberships/v2/tenant/{tenant_id}/memberships", inputs: { type: "object", properties: { membershipTypeId: { type: "integer" }, customerId: { type: "integer" }, locationId: { type: "integer" }, startDate: { type: "string", format: "date" }, billingAmount: { type: "number" } }, required: ["membershipTypeId", "customerId", "locationId"] }, outputs: { type: "object" } },
  { name: "get_membership_revenue", title: "Get Membership Revenue", description: "Monthly recurring revenue (MRR) from all active memberships.", httpMethod: "GET", pathTemplate: "/memberships/v2/tenant/{tenant_id}/reports/revenue", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, membershipTypeId: { type: "integer" }, groupBy: { type: "string", enum: ["month", "quarter", "year"] } } }, outputs: { type: "object", properties: { totalMRR: { type: "number" }, totalARR: { type: "number" }, activeMemberships: { type: "integer" }, byPlan: { type: "array", items: { type: "object" } } } } },
  { name: "schedule_membership_visits", title: "Schedule Membership Visits", description: "Auto-schedule upcoming maintenance visits for membership customers.", httpMethod: "POST", pathTemplate: "/memberships/v2/tenant/{tenant_id}/memberships/{membershipId}/schedule", inputs: { type: "object", properties: { membershipId: { type: "integer" }, startDate: { type: "string", format: "date" }, jobTypeId: { type: "integer" }, businessUnitId: { type: "integer" } }, required: ["membershipId"] }, outputs: { type: "object" } },
  { name: "cancel_membership", title: "Cancel Membership", description: "Cancel a customer's membership. Optionally set an end date or cancel immediately.", httpMethod: "POST", pathTemplate: "/memberships/v2/tenant/{tenant_id}/memberships/{membershipId}/cancel", inputs: { type: "object", properties: { membershipId: { type: "integer" }, reason: { type: "string" }, endDate: { type: "string", format: "date" } }, required: ["membershipId"] }, outputs: { type: "object" } },
  { name: "get_membership_renewal_rate", title: "Get Membership Renewal Rate", description: "Retention metrics - what percentage of memberships renew vs cancel.", httpMethod: "GET", pathTemplate: "/memberships/v2/tenant/{tenant_id}/reports/retention", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, membershipTypeId: { type: "integer" } } }, outputs: { type: "object", properties: { renewalRate: { type: "number" }, totalRenewals: { type: "integer" }, totalCancellations: { type: "integer" }, churnRate: { type: "number" } } } },
  { name: "bill_memberships", title: "Bill Memberships", description: "Process recurring payments for memberships due in a billing cycle.", httpMethod: "POST", pathTemplate: "/memberships/v2/tenant/{tenant_id}/billing/process", inputs: { type: "object", properties: { billingDate: { type: "string", format: "date" }, membershipTypeId: { type: "integer" }, dryRun: { type: "boolean", default: false } } }, outputs: { type: "object", properties: { processed: { type: "integer" }, succeeded: { type: "integer" }, failed: { type: "integer" }, totalAmount: { type: "number" }, failures: { type: "array", items: { type: "object" } } } } },
  // Module 11: Call Booking & CSR (7 tools)
  { name: "get_inbound_calls", title: "Get Inbound Calls", description: "List inbound calls with caller info, duration, outcome, and campaign attribution.", httpMethod: "GET", pathTemplate: "/telecom/v2/tenant/{tenant_id}/calls", inputs: { type: "object", properties: { from: { type: "string", format: "date-time" }, to: { type: "string", format: "date-time" }, outcome: { type: "string", enum: ["Booked", "NoBook", "Abandoned", "Voicemail"] }, campaignId: { type: "integer" }, agentId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "log_call_details", title: "Log Call Details", description: "Add notes and outcome details to a call record.", httpMethod: "PATCH", pathTemplate: "/telecom/v2/tenant/{tenant_id}/calls/{callId}", inputs: { type: "object", properties: { callId: { type: "integer" }, notes: { type: "string" }, outcome: { type: "string", enum: ["Booked", "NoBook", "Abandoned", "Voicemail"] }, customerId: { type: "integer" }, reasonId: { type: "integer" } }, required: ["callId"] }, outputs: { type: "object" } },
  { name: "get_call_recording", title: "Get Call Recording", description: "Get the audio recording URL for a specific call.", httpMethod: "GET", pathTemplate: "/telecom/v2/tenant/{tenant_id}/calls/{callId}/recording", inputs: { type: "object", properties: { callId: { type: "integer" } }, required: ["callId"] }, outputs: { type: "object", properties: { callId: { type: "integer" }, recordingUrl: { type: "string" }, duration: { type: "integer" } } } },
  { name: "get_booking_rate", title: "Get Booking Rate", description: "Percentage of inbound calls that convert to booked jobs.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/booking-rate", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, businessUnitId: { type: "integer" }, campaignId: { type: "integer" }, groupBy: { type: "string", enum: ["day", "week", "month"] } }, required: ["from", "to"] }, outputs: { type: "object", properties: { totalCalls: { type: "integer" }, booked: { type: "integer" }, bookingRate: { type: "number" }, byPeriod: { type: "array", items: { type: "object" } } } } },
  { name: "get_call_sources", title: "Get Call Sources", description: "Marketing attribution for inbound calls - which campaigns drive phone calls.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/call-sources", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_csr_performance", title: "Get CSR Performance", description: "Booking rates, call volume, and average duration per customer service representative.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/csr-performance", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, agentId: { type: "integer" } }, required: ["from", "to"] }, outputs: { type: "object" } },
  { name: "get_average_call_duration", title: "Get Average Call Duration", description: "Average call duration metrics with trends over time.", httpMethod: "GET", pathTemplate: "/reporting/v2/tenant/{tenant_id}/call-duration", inputs: { type: "object", properties: { from: { type: "string", format: "date" }, to: { type: "string", format: "date" }, outcome: { type: "string", enum: ["Booked", "NoBook", "Abandoned", "Voicemail"] }, groupBy: { type: "string", enum: ["day", "week", "month"] } }, required: ["from", "to"] }, outputs: { type: "object", properties: { averageDuration: { type: "number" }, totalCalls: { type: "integer" }, byPeriod: { type: "array", items: { type: "object" } } } } },
  // Module 12: Equipment & Maintenance (7 tools)
  { name: "list_equipment", title: "List Equipment", description: "List all customer equipment tracked in the system with filtering by type, location, and age.", httpMethod: "GET", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment", inputs: { type: "object", properties: { customerId: { type: "integer" }, locationId: { type: "integer" }, equipmentType: { type: "string" }, installedOnOrAfter: { type: "string", format: "date" }, installedOnOrBefore: { type: "string", format: "date" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 } } }, outputs: { type: "object" } },
  { name: "get_equipment_details", title: "Get Equipment Details", description: "Full equipment record: model, serial number, install date, age, warranty, and maintenance history.", httpMethod: "GET", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment/{equipmentId}", inputs: { type: "object", properties: { equipmentId: { type: "integer" } }, required: ["equipmentId"] }, outputs: { type: "object" } },
  { name: "add_equipment_record", title: "Add Equipment", description: "Register new equipment at a customer location with model, serial, and installation details.", httpMethod: "POST", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment", inputs: { type: "object", properties: { customerId: { type: "integer" }, locationId: { type: "integer" }, name: { type: "string" }, manufacturer: { type: "string" }, model: { type: "string" }, serialNumber: { type: "string" }, installDate: { type: "string", format: "date" }, warrantyExpiration: { type: "string", format: "date" }, warrantyType: { type: "string" }, equipmentType: { type: "string" }, notes: { type: "string" } }, required: ["customerId", "locationId", "name", "equipmentType"] }, outputs: { type: "object" } },
  { name: "get_maintenance_history", title: "Get Maintenance History", description: "Complete service history for a specific piece of equipment.", httpMethod: "GET", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment/{equipmentId}/history", inputs: { type: "object", properties: { equipmentId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderByDirection: { type: "string", default: "desc" } }, required: ["equipmentId"] }, outputs: { type: "object" } },
  { name: "schedule_maintenance_reminder", title: "Schedule Maintenance Reminder", description: "Set up preventive maintenance reminders for customer equipment (filter changes, tune-ups, etc.).", httpMethod: "POST", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment/{equipmentId}/reminders", inputs: { type: "object", properties: { equipmentId: { type: "integer" }, type: { type: "string" }, frequency: { type: "string", enum: ["Monthly", "Quarterly", "SemiAnnual", "Annual"] }, nextDueDate: { type: "string", format: "date" }, notifyCustomer: { type: "boolean", default: true }, notifyMethod: { type: "string", enum: ["email", "sms", "both"] } }, required: ["equipmentId", "type", "frequency", "nextDueDate"] }, outputs: { type: "object" } },
  { name: "get_warranty_status", title: "Get Warranty Status", description: "Check warranty status for equipment - active, expiring soon, or expired.", httpMethod: "GET", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment/{equipmentId}/warranty", inputs: { type: "object", properties: { equipmentId: { type: "integer" } }, required: ["equipmentId"] }, outputs: { type: "object", properties: { equipmentId: { type: "integer" }, hasWarranty: { type: "boolean" }, warrantyType: { type: "string" }, expirationDate: { type: "string" }, daysRemaining: { type: "integer" }, isExpired: { type: "boolean" } } } },
  { name: "get_equipment_age", title: "Get Equipment Age", description: "Identify aging equipment that may need replacement. Filter by age threshold and type.", httpMethod: "GET", pathTemplate: "/equipmentsystems/v2/tenant/{tenant_id}/installed-equipment/aging", inputs: { type: "object", properties: { minAgeYears: { type: "integer" }, equipmentType: { type: "string" }, customerId: { type: "integer" }, locationId: { type: "integer" }, page: { type: "integer", default: 1 }, pageSize: { type: "integer", default: 50 }, orderBy: { type: "string", default: "installDate" }, orderByDirection: { type: "string", default: "asc" } } }, outputs: { type: "object" } },
];

const applicationTemplates = [
  {
    slug: "shopify",
    name: "Shopify",
    category: "E-commerce",
    description: "Connect to Shopify stores for order management, product catalog, customers, and inventory",
    logoUrl: "/images/templates/shopify.svg",
    docsUrl: "https://shopify.dev/docs/api/admin-rest",
    authTypes: ["OAUTH2", "API_KEY"],
    isActive: true,
    sortOrder: 1,
    defaultBaseUrl: "https://{store}.myshopify.com/admin/api/2025-01",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://{store}.myshopify.com/admin/oauth/authorize",
      tokenUrl: "https://{store}.myshopify.com/admin/oauth/access_token",
      scopes: ["read_products", "write_products", "read_orders", "write_orders", "read_customers", "read_inventory"]
    },
    defaultTools: shopifyDefaultTools,
    documentationUrls: ["https://shopify.dev/docs/api/admin-rest"]
  },
  {
    slug: "amazon-fba",
    name: "Amazon FBA",
    category: "E-commerce",
    description: "Connect to Amazon Selling Partner API for FBA inventory, orders, fulfillment, and product listings",
    logoUrl: "/images/templates/amazon.svg",
    docsUrl: "https://developer-docs.amazon.com/sp-api/docs",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 2,
    defaultBaseUrl: "https://sellingpartnerapi-na.amazon.com",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://sellercentral.amazon.com/apps/authorize/consent",
      tokenUrl: "https://api.amazon.com/auth/o2/token",
      regions: {
        na: "sellingpartnerapi-na.amazon.com",
        eu: "sellingpartnerapi-eu.amazon.com",
        fe: "sellingpartnerapi-fe.amazon.com"
      }
    },
    defaultTools: amazonFbaDefaultTools,
    documentationUrls: ["https://developer-docs.amazon.com/sp-api/docs"]
  },
  {
    slug: "quickbooks",
    name: "QuickBooks Online",
    category: "Accounting",
    description: "Connect to QuickBooks Online for invoicing, customers, vendors, payments, and financial reporting",
    logoUrl: "/images/templates/quickbooks.svg",
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 3,
    defaultBaseUrl: "https://quickbooks.api.intuit.com/v3/company/{realmId}",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
      tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      scopes: ["com.intuit.quickbooks.accounting"]
    },
    defaultTools: quickbooksDefaultTools,
    documentationUrls: ["https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account"]
  },
  {
    slug: "hubspot",
    name: "HubSpot CRM",
    category: "CRM",
    description: "Connect to HubSpot for contacts, companies, deals, tickets, marketing emails, and campaigns",
    logoUrl: "/images/templates/hubspot.svg",
    docsUrl: "https://developers.hubspot.com/docs/api/crm/contacts",
    authTypes: ["BEARER"],
    isActive: true,
    sortOrder: 4,
    defaultBaseUrl: "https://api.hubapi.com",
    defaultAuthType: "BEARER" as const,
    authConfig: {},
    defaultTools: hubspotDefaultTools,
    documentationUrls: ["https://developers.hubspot.com/docs/api/crm/contacts"]
  },
  {
    slug: "stripe",
    name: "Stripe",
    category: "Payments",
    description: "Connect to Stripe for charges, customers, subscriptions, balance, payouts, disputes, and refunds",
    logoUrl: "/images/templates/stripe.svg",
    docsUrl: "https://stripe.com/docs/api",
    authTypes: ["BEARER"],
    isActive: true,
    sortOrder: 5,
    defaultBaseUrl: "https://api.stripe.com/v1",
    defaultAuthType: "BEARER" as const,
    authConfig: {},
    defaultTools: stripeDefaultTools,
    documentationUrls: ["https://stripe.com/docs/api"]
  },
  {
    slug: "jungle-scout",
    name: "Jungle Scout",
    category: "E-commerce Intelligence",
    description: "Connect to Jungle Scout for Amazon product research, keyword analysis, sales estimates, and competitive intelligence",
    logoUrl: "/images/templates/jungle-scout.svg",
    docsUrl: "https://developer.junglescout.com/docs",
    authTypes: ["API_KEY"],
    isActive: true,
    sortOrder: 6,
    defaultBaseUrl: "https://developer.junglescout.com/api/v1",
    defaultAuthType: "API_KEY" as const,
    authConfig: { headerName: "Authorization", headerPrefix: "Token" },
    defaultTools: jungleScoutDefaultTools,
    documentationUrls: ["https://developer.junglescout.com/docs"]
  },
  {
    slug: "google-ads",
    name: "Google Ads",
    category: "Advertising",
    description: "Connect to Google Ads API for campaign management, ad groups, keywords, bidding, analytics, and performance optimization",
    logoUrl: "/images/templates/google-ads.svg",
    docsUrl: "https://developers.google.com/google-ads/api/docs/start",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 7,
    defaultBaseUrl: "https://googleads.googleapis.com/v17",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scopes: ["https://www.googleapis.com/auth/adwords"]
    },
    defaultTools: googleAdsDefaultTools,
    documentationUrls: ["https://developers.google.com/google-ads/api/docs/start"]
  },
  {
    slug: "servicetitan",
    name: "ServiceTitan",
    category: "Field Service Management",
    description: "Connect to ServiceTitan for job management, scheduling, dispatch, invoicing, customer CRM, inventory, and reporting for home service businesses",
    logoUrl: "/images/templates/servicetitan.svg",
    docsUrl: "https://developer.servicetitan.io/docs",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 8,
    defaultBaseUrl: "https://api.servicetitan.io",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://auth.servicetitan.io/connect/authorize",
      tokenUrl: "https://auth.servicetitan.io/connect/token",
      scopes: ["accounting", "crm", "dispatch", "equipmentsystems", "inventory", "jpm", "marketing", "memberships", "payroll", "pricebook", "reporting", "sales", "settings", "telecom"]
    },
    defaultTools: serviceTitanDefaultTools,
    documentationUrls: ["https://developer.servicetitan.io/docs"]
  }
];

async function seedApplicationTemplates() {
  console.log("🔄 Clearing existing application templates...");

  // Delete all existing templates
  await prisma.applicationTemplate.deleteMany({});

  console.log("📦 Seeding application templates...");

  for (const template of applicationTemplates) {
    await prisma.applicationTemplate.create({
      data: template,
    });
    console.log(`  ✅ Created template: ${template.name} (${template.defaultTools.length} tools)`);
  }

  console.log(`✅ Created ${applicationTemplates.length} application templates`);
}

async function main() {
  console.log("🌱 Seeding database...");

  // Create a demo tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "demo-company" },
    update: {},
    create: {
      id: randomUUID(),
      name: "Demo Company",
      slug: "demo-company",
      plan: "PROFESSIONAL",
      settings: {
        theme: "light",
        timezone: "America/New_York",
      },
    },
  });

  console.log(`✅ Created tenant: ${tenant.name}`);

  // Create demo users
  const ownerUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "owner@demo.com",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "owner@demo.com",
      name: "Demo Owner",
      cognitoSub: `demo-owner-${randomUUID()}`, // Replace with real Cognito sub in production
      tenantId: tenant.id,
      role: "OWNER",
      status: "ACTIVE",
    },
  });

  const adminUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "admin@demo.com",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "admin@demo.com",
      name: "Demo Admin",
      cognitoSub: `demo-admin-${randomUUID()}`,
      tenantId: tenant.id,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  const memberUser = await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: "member@demo.com",
      },
    },
    update: {},
    create: {
      id: randomUUID(),
      email: "member@demo.com",
      name: "Demo Member",
      cognitoSub: `demo-member-${randomUUID()}`,
      tenantId: tenant.id,
      role: "MEMBER",
      status: "ACTIVE",
    },
  });

  console.log(`✅ Created ${3} users`);

  // Create demo projects
  const projects = [
    {
      name: "Website Redesign",
      description: "Complete overhaul of the company website with new branding",
      status: "ACTIVE" as const,
    },
    {
      name: "Mobile App Development",
      description: "Native iOS and Android apps for customer engagement",
      status: "ACTIVE" as const,
    },
    {
      name: "Data Migration",
      description: "Migrate legacy data to new cloud infrastructure",
      status: "ARCHIVED" as const,
    },
  ];

  for (const projectData of projects) {
    await prisma.project.upsert({
      where: {
        id: randomUUID(), // This will always create since UUIDs are unique
      },
      update: {},
      create: {
        id: randomUUID(),
        name: projectData.name,
        description: projectData.description,
        status: projectData.status,
        tenantId: tenant.id,
        createdById: ownerUser.id,
        metadata: {},
      },
    });
  }

  console.log(`✅ Created ${projects.length} projects`);

  // Log some audit entries
  await prisma.auditLog.createMany({
    data: [
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        action: "tenant.created",
        entityType: "Tenant",
        entityId: tenant.id,
        metadata: { name: tenant.name },
      },
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        action: "user.created",
        entityType: "User",
        entityId: adminUser.id,
        metadata: { email: adminUser.email },
      },
      {
        tenantId: tenant.id,
        userId: ownerUser.id,
        action: "user.created",
        entityType: "User",
        entityId: memberUser.id,
        metadata: { email: memberUser.email },
      },
    ],
  });

  console.log("✅ Created audit logs");

  // Seed application templates (Shopify & QuickBooks)
  await seedApplicationTemplates();

  console.log("\n🎉 Seeding complete!\n");
  console.log("Demo tenant:", tenant.slug);
  console.log("Demo users:");
  console.log("  - owner@demo.com (OWNER)");
  console.log("  - admin@demo.com (ADMIN)");
  console.log("  - member@demo.com (MEMBER)");
  console.log("Application templates:");
  console.log("  - Shopify (25 tools)");
  console.log("  - Amazon FBA (8 tools)");
  console.log("  - QuickBooks Online (30 tools)");
  console.log("  - HubSpot CRM (23 tools)");
  console.log("  - Stripe (17 tools)");
  console.log("  - Jungle Scout (6 tools)");
  console.log("  - Google Ads (65 tools)");
  console.log("  - ServiceTitan (137 tools)");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
