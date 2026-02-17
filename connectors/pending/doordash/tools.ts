// DoorDash Merchant Tool Definitions for SierraMCP seed.ts

export const doordashTools = [
  // ============================================
  // ORDERS MODULE
  // ============================================
  {
    name: "list_orders",
    title: "List Orders",
    description:
      "Retrieve a paginated list of orders for the merchant. Returns order details including status, items, and customer info.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/orders",
    inputs: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["pending", "confirmed", "preparing", "ready_for_pickup", "picked_up", "delivered", "cancelled"],
          description: "Filter by order status",
        },
        startDate: { type: "string", format: "date-time", description: "Filter orders created after this date" },
        endDate: { type: "string", format: "date-time", description: "Filter orders created before this date" },
        storeId: { type: "string", description: "Filter by store ID" },
        limit: { type: "integer", description: "Number of results to return (max 100)" },
        offset: { type: "integer", description: "Offset for pagination" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        orders: { type: "array", description: "Array of order objects" },
        totalCount: { type: "integer" },
        hasMore: { type: "boolean" },
      },
    },
  },
  {
    name: "get_order",
    title: "Get Order Details",
    description:
      "Get detailed information about a specific order including items, pricing, customer info, and delivery status.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/orders/{orderId}",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        items: { type: "array" },
        subtotal: { type: "number" },
        tax: { type: "number" },
        total: { type: "number" },
        customer: { type: "object" },
        delivery: { type: "object" },
      },
    },
  },
  {
    name: "confirm_order",
    title: "Confirm Order",
    description:
      "Confirm a pending order and set the estimated preparation time.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/orders/{orderId}/confirm",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        estimatedPrepTimeMinutes: { type: "integer", description: "Estimated preparation time in minutes" },
      },
      required: ["orderId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        estimatedReadyTime: { type: "string" },
      },
    },
  },
  {
    name: "cancel_order",
    title: "Cancel Order",
    description:
      "Cancel an active order with a specified reason.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/orders/{orderId}/cancel",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        reason: {
          type: "string",
          enum: ["out_of_items", "store_closed", "too_busy", "other"],
          description: "Cancellation reason",
        },
        explanation: { type: "string", description: "Additional explanation for cancellation" },
      },
      required: ["orderId", "reason"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        cancelledAt: { type: "string" },
      },
    },
  },
  {
    name: "mark_order_ready",
    title: "Mark Order Ready",
    description:
      "Mark an order as ready for Dasher pickup.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/orders/{orderId}/ready",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        readyAt: { type: "string" },
      },
    },
  },
  {
    name: "update_order_prep_time",
    title: "Update Order Prep Time",
    description:
      "Update the estimated preparation time for an in-progress order.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/orders/{orderId}/prep-time",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        estimatedPrepTimeMinutes: { type: "integer", description: "Updated preparation time in minutes" },
      },
      required: ["orderId", "estimatedPrepTimeMinutes"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        estimatedReadyTime: { type: "string" },
      },
    },
  },
  {
    name: "get_order_items",
    title: "Get Order Items",
    description:
      "Get the itemized list for an order including modifiers, special instructions, and pricing.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/orders/{orderId}/items",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of order item objects" },
      },
    },
  },
  {
    name: "update_item_availability",
    title: "Update Item Availability",
    description:
      "Mark a specific item as unavailable for an active order, triggering customer notification.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/orders/{orderId}/items/{itemId}/unavailable",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        itemId: { type: "string", description: "The item ID" },
        substituteItemId: { type: "string", description: "Optional substitute item ID" },
      },
      required: ["orderId", "itemId"],
    },
    outputs: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        itemId: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "get_order_delivery_status",
    title: "Get Order Delivery Status",
    description:
      "Get real-time delivery status including Dasher location and estimated delivery time.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/orders/{orderId}/delivery",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
      },
      required: ["orderId"],
    },
    outputs: {
      type: "object",
      properties: {
        status: { type: "string" },
        dasherName: { type: "string" },
        estimatedDeliveryTime: { type: "string" },
        dasherLocation: { type: "object" },
        pickupTime: { type: "string" },
      },
    },
  },
  {
    name: "adjust_order_total",
    title: "Adjust Order Total",
    description:
      "Apply an adjustment to the order total (e.g., for substitutions or errors).",
    httpMethod: "POST",
    pathTemplate: "/api/v1/orders/{orderId}/adjustments",
    inputs: {
      type: "object",
      properties: {
        orderId: { type: "string", description: "The order ID" },
        amount: { type: "number", description: "Adjustment amount (positive or negative)" },
        reason: { type: "string", description: "Reason for adjustment" },
      },
      required: ["orderId", "amount", "reason"],
    },
    outputs: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        adjustment: { type: "number" },
        newTotal: { type: "number" },
      },
    },
  },
  {
    name: "search_orders",
    title: "Search Orders",
    description:
      "Search orders by customer name, order ID, or item name.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/orders/search",
    inputs: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query" },
        storeId: { type: "string", description: "Filter by store" },
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        limit: { type: "integer", description: "Results per page" },
      },
      required: ["query"],
    },
    outputs: {
      type: "object",
      properties: {
        results: { type: "array", description: "Matching orders" },
        totalCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_active_orders",
    title: "Get Active Orders",
    description:
      "Get all currently active orders (pending, confirmed, preparing, or ready) for a store.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/orders/active",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Store ID" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        orders: { type: "array", description: "Array of active order objects" },
        count: { type: "integer" },
      },
    },
  },
  // ============================================
  // MENU MODULE
  // ============================================
  {
    name: "get_menu",
    title: "Get Menu",
    description:
      "Get the complete menu for a store including categories, items, modifiers, and pricing.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/stores/{storeId}/menus",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
      },
      required: ["storeId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        categories: { type: "array" },
        itemCount: { type: "integer" },
      },
    },
  },
  {
    name: "update_menu",
    title: "Update Menu",
    description:
      "Update the entire menu for a store. Replaces the current menu with the provided data.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/stores/{storeId}/menus",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        categories: {
          type: "array",
          description: "Array of menu categories with items",
        },
      },
      required: ["storeId", "categories"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        updatedAt: { type: "string" },
        itemCount: { type: "integer" },
      },
    },
  },
  {
    name: "get_menu_item",
    title: "Get Menu Item",
    description:
      "Get details of a specific menu item including modifiers, pricing, and availability.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/stores/{storeId}/menus/items/{itemId}",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        itemId: { type: "string", description: "The menu item ID" },
      },
      required: ["storeId", "itemId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        description: { type: "string" },
        price: { type: "number" },
        modifiers: { type: "array" },
        isActive: { type: "boolean" },
      },
    },
  },
  {
    name: "update_menu_item",
    title: "Update Menu Item",
    description:
      "Update a specific menu item's name, description, price, or modifiers.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/stores/{storeId}/menus/items/{itemId}",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        itemId: { type: "string", description: "The menu item ID" },
        name: { type: "string", description: "Item name" },
        description: { type: "string", description: "Item description" },
        price: { type: "number", description: "Item price in cents" },
        imageUrl: { type: "string", description: "URL to item image" },
      },
      required: ["storeId", "itemId"],
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
    name: "toggle_item_availability",
    title: "Toggle Item Availability",
    description:
      "Mark a menu item as available or unavailable (86'd). Unavailable items are hidden from customers.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/stores/{storeId}/menus/items/{itemId}/availability",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        itemId: { type: "string", description: "The menu item ID" },
        isActive: { type: "boolean", description: "Whether the item is available" },
        deactivateUntil: { type: "string", format: "date-time", description: "Auto-reactivate at this time" },
      },
      required: ["storeId", "itemId", "isActive"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        isActive: { type: "boolean" },
        deactivateUntil: { type: "string" },
      },
    },
  },
  {
    name: "create_menu_item",
    title: "Create Menu Item",
    description:
      "Add a new item to a menu category.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/stores/{storeId}/menus/items",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        categoryId: { type: "string", description: "Category to add item to" },
        name: { type: "string", description: "Item name" },
        description: { type: "string", description: "Item description" },
        price: { type: "number", description: "Item price in cents" },
        imageUrl: { type: "string", description: "URL to item image" },
        modifiers: { type: "array", description: "Item modifier groups" },
      },
      required: ["storeId", "categoryId", "name", "price"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
  {
    name: "delete_menu_item",
    title: "Delete Menu Item",
    description:
      "Remove a menu item from the store's menu.",
    httpMethod: "DELETE",
    pathTemplate: "/api/v1/stores/{storeId}/menus/items/{itemId}",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        itemId: { type: "string", description: "The menu item ID" },
      },
      required: ["storeId", "itemId"],
    },
    outputs: {
      type: "object",
      properties: {
        deleted: { type: "boolean" },
      },
    },
  },
  {
    name: "create_menu_category",
    title: "Create Menu Category",
    description:
      "Create a new category in the store's menu.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/stores/{storeId}/menus/categories",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        name: { type: "string", description: "Category name" },
        description: { type: "string", description: "Category description" },
        sortOrder: { type: "integer", description: "Display order" },
      },
      required: ["storeId", "name"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
  {
    name: "update_menu_hours",
    title: "Update Menu Hours",
    description:
      "Set the hours during which a menu or menu category is available.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/stores/{storeId}/menus/hours",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        menuId: { type: "string", description: "The menu ID" },
        hours: {
          type: "array",
          description: "Array of day-of-week availability windows",
        },
      },
      required: ["storeId", "menuId", "hours"],
    },
    outputs: {
      type: "object",
      properties: {
        menuId: { type: "string" },
        hours: { type: "array" },
        updatedAt: { type: "string" },
      },
    },
  },
  {
    name: "bulk_update_prices",
    title: "Bulk Update Prices",
    description:
      "Update prices for multiple menu items at once (e.g., for a percentage increase).",
    httpMethod: "POST",
    pathTemplate: "/api/v1/stores/{storeId}/menus/bulk-pricing",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        updates: {
          type: "array",
          items: {
            type: "object",
            properties: {
              itemId: { type: "string" },
              newPrice: { type: "number" },
            },
          },
          description: "Array of item ID and new price pairs",
        },
      },
      required: ["storeId", "updates"],
    },
    outputs: {
      type: "object",
      properties: {
        updated: { type: "integer" },
        failed: { type: "array" },
      },
    },
  },
  {
    name: "get_popular_items",
    title: "Get Popular Items",
    description:
      "Get the most popular menu items based on order frequency and ratings.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/stores/{storeId}/menus/popular",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        period: {
          type: "string",
          enum: ["7d", "30d", "90d"],
          description: "Time period for popularity data",
        },
        limit: { type: "integer", description: "Number of items to return" },
      },
      required: ["storeId"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Popular items with order counts and ratings" },
      },
    },
  },
  // ============================================
  // STORE MODULE
  // ============================================
  {
    name: "list_stores",
    title: "List Stores",
    description:
      "Get all stores associated with the merchant account.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/stores",
    inputs: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["active", "paused", "deactivated"],
          description: "Filter by store status",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        stores: { type: "array", description: "Array of store objects" },
      },
    },
  },
  {
    name: "get_store",
    title: "Get Store Details",
    description:
      "Get detailed information about a specific store including address, hours, and settings.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/stores/{storeId}",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
      },
      required: ["storeId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
        address: { type: "object" },
        phone: { type: "string" },
        hours: { type: "array" },
        status: { type: "string" },
        isOpen: { type: "boolean" },
      },
    },
  },
  {
    name: "update_store",
    title: "Update Store",
    description:
      "Update store information such as name, address, phone, or description.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/stores/{storeId}",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        name: { type: "string", description: "Store name" },
        phone: { type: "string", description: "Store phone number" },
        description: { type: "string", description: "Store description" },
        specialInstructions: { type: "string", description: "Pickup instructions for Dashers" },
      },
      required: ["storeId"],
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
    name: "update_store_hours",
    title: "Update Store Hours",
    description:
      "Update the operating hours for a store.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/stores/{storeId}/hours",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        hours: {
          type: "array",
          description: "Array of day-of-week hour objects with open and close times",
        },
      },
      required: ["storeId", "hours"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        hours: { type: "array" },
        updatedAt: { type: "string" },
      },
    },
  },
  {
    name: "pause_store",
    title: "Pause Store",
    description:
      "Temporarily pause a store from accepting orders. The store will appear as closed to customers.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/stores/{storeId}/pause",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        reason: {
          type: "string",
          enum: ["too_busy", "staffing", "equipment", "weather", "other"],
          description: "Reason for pausing",
        },
        resumeAt: { type: "string", format: "date-time", description: "Auto-resume at this time" },
      },
      required: ["storeId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        pausedAt: { type: "string" },
        resumeAt: { type: "string" },
      },
    },
  },
  {
    name: "resume_store",
    title: "Resume Store",
    description:
      "Resume a paused store so it starts accepting orders again.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/stores/{storeId}/resume",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
      },
      required: ["storeId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        resumedAt: { type: "string" },
      },
    },
  },
  {
    name: "get_store_status",
    title: "Get Store Status",
    description:
      "Get the current operational status of a store including whether it is open, paused, or closed.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/stores/{storeId}/status",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
      },
      required: ["storeId"],
    },
    outputs: {
      type: "object",
      properties: {
        status: { type: "string" },
        isAcceptingOrders: { type: "boolean" },
        activeOrders: { type: "integer" },
        averagePrepTime: { type: "integer" },
      },
    },
  },
  {
    name: "update_prep_time",
    title: "Update Default Prep Time",
    description:
      "Update the default order preparation time for a store.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/stores/{storeId}/prep-time",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "The store ID" },
        defaultPrepTimeMinutes: { type: "integer", description: "Default preparation time in minutes" },
      },
      required: ["storeId", "defaultPrepTimeMinutes"],
    },
    outputs: {
      type: "object",
      properties: {
        storeId: { type: "string" },
        defaultPrepTimeMinutes: { type: "integer" },
      },
    },
  },
  // ============================================
  // DELIVERY MODULE
  // ============================================
  {
    name: "create_delivery",
    title: "Create Delivery",
    description:
      "Create an on-demand DoorDash Drive delivery for a merchant-placed order.",
    httpMethod: "POST",
    pathTemplate: "/drive/v2/deliveries",
    inputs: {
      type: "object",
      properties: {
        externalDeliveryId: { type: "string", description: "Your unique delivery ID" },
        pickupAddress: { type: "string", description: "Full pickup address" },
        pickupBusinessName: { type: "string", description: "Business name at pickup" },
        pickupPhoneNumber: { type: "string", description: "Phone number at pickup" },
        pickupInstructions: { type: "string", description: "Instructions for Dasher at pickup" },
        dropoffAddress: { type: "string", description: "Full delivery address" },
        dropoffBusinessName: { type: "string", description: "Recipient business name" },
        dropoffPhoneNumber: { type: "string", description: "Recipient phone number" },
        dropoffInstructions: { type: "string", description: "Delivery instructions" },
        orderValue: { type: "integer", description: "Order value in cents" },
        tip: { type: "integer", description: "Tip amount in cents" },
        pickupTime: { type: "string", format: "date-time", description: "Requested pickup time" },
        dropoffTime: { type: "string", format: "date-time", description: "Requested delivery time" },
      },
      required: ["externalDeliveryId", "pickupAddress", "pickupPhoneNumber", "dropoffAddress", "dropoffPhoneNumber", "orderValue"],
    },
    outputs: {
      type: "object",
      properties: {
        externalDeliveryId: { type: "string" },
        deliveryStatus: { type: "string" },
        fee: { type: "integer" },
        trackingUrl: { type: "string" },
      },
    },
  },
  {
    name: "get_delivery",
    title: "Get Delivery Status",
    description:
      "Get the current status and details of a DoorDash Drive delivery.",
    httpMethod: "GET",
    pathTemplate: "/drive/v2/deliveries/{deliveryId}",
    inputs: {
      type: "object",
      properties: {
        deliveryId: { type: "string", description: "The external delivery ID" },
      },
      required: ["deliveryId"],
    },
    outputs: {
      type: "object",
      properties: {
        externalDeliveryId: { type: "string" },
        deliveryStatus: { type: "string" },
        dasherName: { type: "string" },
        dasherPhoneNumber: { type: "string" },
        trackingUrl: { type: "string" },
        pickupTimeEstimated: { type: "string" },
        dropoffTimeEstimated: { type: "string" },
      },
    },
  },
  {
    name: "cancel_delivery",
    title: "Cancel Delivery",
    description:
      "Cancel an active DoorDash Drive delivery.",
    httpMethod: "PUT",
    pathTemplate: "/drive/v2/deliveries/{deliveryId}/cancel",
    inputs: {
      type: "object",
      properties: {
        deliveryId: { type: "string", description: "The external delivery ID" },
      },
      required: ["deliveryId"],
    },
    outputs: {
      type: "object",
      properties: {
        externalDeliveryId: { type: "string" },
        deliveryStatus: { type: "string" },
        cancellationFee: { type: "integer" },
      },
    },
  },
  {
    name: "get_delivery_quote",
    title: "Get Delivery Quote",
    description:
      "Get a delivery fee quote for a potential DoorDash Drive delivery.",
    httpMethod: "POST",
    pathTemplate: "/drive/v2/deliveries/quote",
    inputs: {
      type: "object",
      properties: {
        pickupAddress: { type: "string", description: "Full pickup address" },
        dropoffAddress: { type: "string", description: "Full delivery address" },
        orderValue: { type: "integer", description: "Order value in cents" },
        pickupTime: { type: "string", format: "date-time", description: "Requested pickup time" },
      },
      required: ["pickupAddress", "dropoffAddress", "orderValue"],
    },
    outputs: {
      type: "object",
      properties: {
        fee: { type: "integer", description: "Delivery fee in cents" },
        currency: { type: "string" },
        estimatedPickupTime: { type: "string" },
        estimatedDropoffTime: { type: "string" },
      },
    },
  },
  {
    name: "update_delivery",
    title: "Update Delivery",
    description:
      "Update details of an active delivery such as dropoff instructions or tip.",
    httpMethod: "PATCH",
    pathTemplate: "/drive/v2/deliveries/{deliveryId}",
    inputs: {
      type: "object",
      properties: {
        deliveryId: { type: "string", description: "The external delivery ID" },
        dropoffInstructions: { type: "string", description: "Updated delivery instructions" },
        tip: { type: "integer", description: "Updated tip amount in cents" },
        dropoffPhoneNumber: { type: "string", description: "Updated recipient phone" },
      },
      required: ["deliveryId"],
    },
    outputs: {
      type: "object",
      properties: {
        externalDeliveryId: { type: "string" },
        updatedAt: { type: "string" },
      },
    },
  },
  {
    name: "list_deliveries",
    title: "List Deliveries",
    description:
      "List all DoorDash Drive deliveries with optional status filtering.",
    httpMethod: "GET",
    pathTemplate: "/drive/v2/deliveries",
    inputs: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["created", "confirmed", "enroute_to_pickup", "arrived_at_pickup", "picked_up", "enroute_to_dropoff", "arrived_at_dropoff", "delivered", "cancelled"],
          description: "Filter by delivery status",
        },
        startDate: { type: "string", format: "date", description: "Start date" },
        endDate: { type: "string", format: "date", description: "End date" },
        limit: { type: "integer", description: "Results per page" },
        offset: { type: "integer", description: "Offset for pagination" },
      },
    },
    outputs: {
      type: "object",
      properties: {
        deliveries: { type: "array", description: "Array of delivery objects" },
        totalCount: { type: "integer" },
      },
    },
  },
  // ============================================
  // PROMOTIONS MODULE
  // ============================================
  {
    name: "list_promotions",
    title: "List Promotions",
    description:
      "Get all active and scheduled promotions for the merchant.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/promotions",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        status: {
          type: "string",
          enum: ["active", "scheduled", "expired", "paused"],
          description: "Filter by promotion status",
        },
      },
    },
    outputs: {
      type: "object",
      properties: {
        promotions: { type: "array", description: "Array of promotion objects" },
      },
    },
  },
  {
    name: "create_promotion",
    title: "Create Promotion",
    description:
      "Create a new promotion or discount offer for the store.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/promotions",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Store ID" },
        type: {
          type: "string",
          enum: ["percentage_off", "flat_off", "free_item", "free_delivery", "bogo"],
          description: "Promotion type",
        },
        value: { type: "number", description: "Discount value (percentage or flat amount)" },
        minOrderAmount: { type: "number", description: "Minimum order amount to qualify" },
        maxDiscount: { type: "number", description: "Maximum discount amount" },
        startDate: { type: "string", format: "date-time", description: "Promotion start date" },
        endDate: { type: "string", format: "date-time", description: "Promotion end date" },
        description: { type: "string", description: "Promotion description visible to customers" },
        applicableItemIds: {
          type: "array",
          items: { type: "string" },
          description: "Specific items this promotion applies to (empty = all items)",
        },
      },
      required: ["storeId", "type", "value", "startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
        createdAt: { type: "string" },
      },
    },
  },
  {
    name: "update_promotion",
    title: "Update Promotion",
    description:
      "Update an existing promotion's details or schedule.",
    httpMethod: "PUT",
    pathTemplate: "/api/v1/promotions/{promotionId}",
    inputs: {
      type: "object",
      properties: {
        promotionId: { type: "string", description: "The promotion ID" },
        value: { type: "number", description: "Updated discount value" },
        endDate: { type: "string", format: "date-time", description: "Updated end date" },
        description: { type: "string", description: "Updated description" },
        minOrderAmount: { type: "number", description: "Updated minimum order" },
      },
      required: ["promotionId"],
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
    name: "pause_promotion",
    title: "Pause Promotion",
    description:
      "Temporarily pause an active promotion.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/promotions/{promotionId}/pause",
    inputs: {
      type: "object",
      properties: {
        promotionId: { type: "string", description: "The promotion ID" },
      },
      required: ["promotionId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "resume_promotion",
    title: "Resume Promotion",
    description:
      "Resume a paused promotion.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/promotions/{promotionId}/resume",
    inputs: {
      type: "object",
      properties: {
        promotionId: { type: "string", description: "The promotion ID" },
      },
      required: ["promotionId"],
    },
    outputs: {
      type: "object",
      properties: {
        id: { type: "string" },
        status: { type: "string" },
      },
    },
  },
  {
    name: "delete_promotion",
    title: "Delete Promotion",
    description:
      "Delete a promotion. Only scheduled or paused promotions can be deleted.",
    httpMethod: "DELETE",
    pathTemplate: "/api/v1/promotions/{promotionId}",
    inputs: {
      type: "object",
      properties: {
        promotionId: { type: "string", description: "The promotion ID" },
      },
      required: ["promotionId"],
    },
    outputs: {
      type: "object",
      properties: {
        deleted: { type: "boolean" },
      },
    },
  },
  {
    name: "get_promotion_performance",
    title: "Get Promotion Performance",
    description:
      "Get performance metrics for a promotion including redemptions, revenue impact, and ROI.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/promotions/{promotionId}/performance",
    inputs: {
      type: "object",
      properties: {
        promotionId: { type: "string", description: "The promotion ID" },
      },
      required: ["promotionId"],
    },
    outputs: {
      type: "object",
      properties: {
        redemptions: { type: "integer" },
        totalDiscountGiven: { type: "number" },
        incrementalOrders: { type: "integer" },
        incrementalRevenue: { type: "number" },
        roi: { type: "number" },
      },
    },
  },
  // ============================================
  // REPORTS MODULE
  // ============================================
  {
    name: "get_sales_report",
    title: "Get Sales Report",
    description:
      "Get a sales report with revenue, order counts, and average order value over a date range.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/sales",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
        granularity: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Data granularity",
        },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        totalRevenue: { type: "number" },
        totalOrders: { type: "integer" },
        averageOrderValue: { type: "number" },
        data: { type: "array", description: "Time series sales data" },
      },
    },
  },
  {
    name: "get_operations_report",
    title: "Get Operations Report",
    description:
      "Get operational metrics including prep times, cancellation rates, and order accuracy.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/operations",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        averagePrepTime: { type: "number" },
        cancellationRate: { type: "number" },
        orderAccuracy: { type: "number" },
        downtime: { type: "number", description: "Minutes store was paused" },
        data: { type: "array" },
      },
    },
  },
  {
    name: "get_customer_ratings",
    title: "Get Customer Ratings",
    description:
      "Get customer rating and review data for the store.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/ratings",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        averageRating: { type: "number" },
        totalRatings: { type: "integer" },
        ratingDistribution: { type: "object" },
        recentReviews: { type: "array" },
      },
    },
  },
  {
    name: "get_item_sales_report",
    title: "Get Item Sales Report",
    description:
      "Get sales data broken down by menu item including quantities, revenue, and trends.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/item-sales",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
        sortBy: {
          type: "string",
          enum: ["quantity", "revenue", "name"],
          description: "Sort results by field",
        },
        limit: { type: "integer", description: "Number of items to return" },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        items: { type: "array", description: "Array of item sales data" },
        totalRevenue: { type: "number" },
        totalItemsSold: { type: "integer" },
      },
    },
  },
  {
    name: "get_peak_hours_report",
    title: "Get Peak Hours Report",
    description:
      "Get order volume data by hour of day and day of week to identify peak ordering times.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/peak-hours",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        hourlyData: { type: "array", description: "Order counts by hour of day" },
        dailyData: { type: "array", description: "Order counts by day of week" },
        peakHour: { type: "integer" },
        peakDay: { type: "string" },
      },
    },
  },
  {
    name: "get_payout_report",
    title: "Get Payout Report",
    description:
      "Get payout history and details including fees, adjustments, and net amounts.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/payouts",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        payouts: { type: "array", description: "Array of payout objects" },
        totalGross: { type: "number" },
        totalFees: { type: "number" },
        totalNet: { type: "number" },
      },
    },
  },
  {
    name: "get_cancellation_report",
    title: "Get Cancellation Report",
    description:
      "Get a detailed report on order cancellations including reasons and trends.",
    httpMethod: "GET",
    pathTemplate: "/api/v1/reports/cancellations",
    inputs: {
      type: "object",
      properties: {
        storeId: { type: "string", description: "Filter by store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
      },
      required: ["startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        totalCancellations: { type: "integer" },
        cancellationRate: { type: "number" },
        byReason: { type: "array", description: "Cancellation counts by reason" },
        trend: { type: "array" },
      },
    },
  },
  {
    name: "export_report",
    title: "Export Report",
    description:
      "Export a report in CSV format for download.",
    httpMethod: "POST",
    pathTemplate: "/api/v1/reports/export",
    inputs: {
      type: "object",
      properties: {
        reportType: {
          type: "string",
          enum: ["sales", "operations", "ratings", "item-sales", "payouts", "cancellations"],
          description: "Type of report to export",
        },
        storeId: { type: "string", description: "Store ID" },
        startDate: { type: "string", format: "date", description: "Report start date" },
        endDate: { type: "string", format: "date", description: "Report end date" },
        format: {
          type: "string",
          enum: ["csv", "json"],
          description: "Export format",
        },
      },
      required: ["reportType", "startDate", "endDate"],
    },
    outputs: {
      type: "object",
      properties: {
        downloadUrl: { type: "string" },
        expiresAt: { type: "string" },
      },
    },
  },
];
