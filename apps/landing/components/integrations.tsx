import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  ShoppingCart,
  Cloud,
  Headphones,
  MessageSquare,
  Users,
  MessagesSquare,
  Smartphone,
} from "lucide-react";

const businessApps = [
  {
    name: "QuickBooks Online",
    description: "Invoices, customers, payments, P&L summaries",
    icon: FileSpreadsheet,
  },
  {
    name: "Shopify",
    description: "Orders, products, inventory, customer data",
    icon: ShoppingCart,
  },
  {
    name: "Salesforce",
    description: "Contacts, opportunities, pipeline status",
    icon: Cloud,
  },
  {
    name: "Zendesk",
    description: "Tickets, customer history, support metrics",
    icon: Headphones,
  },
];

const chatPlatforms = [
  { name: "Slack", icon: MessageSquare },
  { name: "Microsoft Teams", icon: Users },
  { name: "Google Chat", icon: MessagesSquare },
  { name: "SMS", icon: Smartphone },
];

export function Integrations() {
  return (
    <section className="py-24 bg-card/50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            Works With Tools You Already Use
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Pre-built integrations for popular business applications and chat platforms.
          </p>
        </div>

        {/* Business Apps */}
        <div className="max-w-4xl mx-auto mb-12">
          <h3 className="text-lg font-semibold text-center mb-6 text-muted-foreground">
            Business Applications
          </h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {businessApps.map((app) => (
              <div
                key={app.name}
                className="rounded-lg border border-border/50 bg-background/50 p-4 text-center hover:border-violet-500/30 transition-colors"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <app.icon className="h-6 w-6 text-violet-400" />
                </div>
                <h4 className="font-medium mb-1">{app.name}</h4>
                <p className="text-xs text-muted-foreground">{app.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Platforms */}
        <div className="max-w-2xl mx-auto mb-8">
          <h3 className="text-lg font-semibold text-center mb-6 text-muted-foreground">
            Deploy To
          </h3>
          <div className="flex flex-wrap justify-center gap-4">
            {chatPlatforms.map((platform) => (
              <div
                key={platform.name}
                className="flex items-center gap-2 rounded-full border border-border/50 bg-background/50 px-4 py-2"
              >
                <platform.icon className="h-4 w-4 text-violet-400" />
                <span className="text-sm font-medium">{platform.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Coming Soon */}
        <div className="text-center">
          <Badge variant="secondary" className="text-xs">
            Coming Soon: Xero, HubSpot, Square, and more
          </Badge>
        </div>
      </div>
    </section>
  );
}
