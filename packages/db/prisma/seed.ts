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
    slug: "quickbooks",
    name: "QuickBooks Online",
    category: "Accounting",
    description: "Connect to QuickBooks Online for invoicing, customers, vendors, payments, and financial reporting",
    logoUrl: "/images/templates/quickbooks.svg",
    docsUrl: "https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account",
    authTypes: ["OAUTH2"],
    isActive: true,
    sortOrder: 2,
    defaultBaseUrl: "https://quickbooks.api.intuit.com/v3/company/{realmId}",
    defaultAuthType: "OAUTH2" as const,
    authConfig: {
      authorizationUrl: "https://appcenter.intuit.com/connect/oauth2",
      tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
      scopes: ["com.intuit.quickbooks.accounting"]
    },
    defaultTools: quickbooksDefaultTools,
    documentationUrls: ["https://developer.intuit.com/app/developer/qbo/docs/api/accounting/all-entities/account"]
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
  console.log("  - QuickBooks Online (30 tools)");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
