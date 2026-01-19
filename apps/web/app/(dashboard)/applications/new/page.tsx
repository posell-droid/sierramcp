"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Loader2, ShoppingCart, Calculator, Settings, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

type TemplateChoice = "shopify" | "quickbooks" | "custom"

interface TemplateOption {
  id: TemplateChoice
  name: string
  description: string
  category: string
  icon: React.ReactNode
  logoUrl: string
  toolCount: number
  features: string[]
}

const templateOptions: TemplateOption[] = [
  {
    id: "shopify",
    name: "Shopify",
    description: "Connect to Shopify stores for order management, product catalog, customers, and inventory",
    category: "E-commerce",
    icon: <ShoppingCart className="h-6 w-6" />,
    logoUrl: "/images/templates/shopify.svg",
    toolCount: 25,
    features: ["Products & Collections", "Orders & Fulfillment", "Customers", "Inventory Management"],
  },
  {
    id: "quickbooks",
    name: "QuickBooks Online",
    description: "Connect to QuickBooks for invoicing, customers, vendors, payments, and financial reporting",
    category: "Accounting",
    icon: <Calculator className="h-6 w-6" />,
    logoUrl: "/images/templates/quickbooks.svg",
    toolCount: 30,
    features: ["Invoices & Payments", "Customers & Vendors", "Bills & Purchases", "Chart of Accounts"],
  },
  {
    id: "custom",
    name: "Custom Application",
    description: "Build your own MCP application from scratch with full control over tools and configuration",
    category: "Custom",
    icon: <Settings className="h-6 w-6" />,
    logoUrl: "",
    toolCount: 0,
    features: ["Full Customization", "Any REST API", "Custom Authentication", "Manual Tool Creation"],
  },
]

export default function NewApplicationPage() {
  const router = useRouter()

  // Fetch templates from database to get their IDs
  const { data: templates = [] } = trpc.applications.listTemplates.useQuery()

  // Step management
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)

  // Step 1: Template selection
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateChoice | null>(null)

  // Template configuration (collected after selection)
  const [shopifyStore, setShopifyStore] = useState("")
  const [quickbooksRealmId, setQuickbooksRealmId] = useState("")
  const [customName, setCustomName] = useState("")
  const [customDescription, setCustomDescription] = useState("")

  const createApplication = trpc.applications.create.useMutation({
    onSuccess: (data) => {
      const toolCount = selectedTemplate === "shopify" ? 25 : selectedTemplate === "quickbooks" ? 30 : 0
      toast.success("Application created", {
        description: toolCount > 0
          ? `${toolCount} tools auto-generated. Now configure your environment credentials.`
          : "Now configure your environments to connect to the API",
      })
      router.push(`/applications/${data.id}`)
    },
    onError: (error) => {
      toast.error("Failed to create application", {
        description: error.message,
      })
    },
  })

  // Find the database template ID for the selected template
  const getTemplateId = (choice: TemplateChoice): string | undefined => {
    if (choice === "custom") return undefined
    const template = templates.find((t: { slug: string }) => t.slug === choice)
    return template?.id
  }

  // Check if we can proceed from step 1 to step 2
  const canProceedToStep2 = () => {
    if (!selectedTemplate) return false
    if (selectedTemplate === "shopify") return shopifyStore.trim().length > 0
    if (selectedTemplate === "quickbooks") return quickbooksRealmId.trim().length > 0
    if (selectedTemplate === "custom") return customName.trim().length > 0
    return false
  }

  // Check if we can create (all required config provided)
  const canCreate = canProceedToStep2()

  const handleCreate = async () => {
    if (!canCreate || !selectedTemplate) return

    let name: string
    let description: string | undefined

    if (selectedTemplate === "shopify") {
      name = `Shopify - ${shopifyStore}`
      description = `Shopify store: ${shopifyStore}.myshopify.com`
    } else if (selectedTemplate === "quickbooks") {
      name = `QuickBooks - ${quickbooksRealmId}`
      description = `QuickBooks company ID: ${quickbooksRealmId}`
    } else {
      name = customName
      description = customDescription || undefined
    }

    createApplication.mutate({
      name,
      description,
      templateId: getTemplateId(selectedTemplate),
      templateConfig: selectedTemplate === "shopify"
        ? { store: shopifyStore }
        : selectedTemplate === "quickbooks"
          ? { realmId: quickbooksRealmId }
          : undefined,
    })
  }

  const handleSelectTemplate = (choice: TemplateChoice) => {
    setSelectedTemplate(choice)
    // Reset config when changing templates
    setShopifyStore("")
    setQuickbooksRealmId("")
    setCustomName("")
    setCustomDescription("")
  }

  const selectedOption = templateOptions.find(t => t.id === selectedTemplate)

  return (
    <div className="container mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/applications")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">New Application</h1>
            <p className="text-muted-foreground mt-1">Connect a system to build tools and deploy MCP servers</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                {currentStep === 1 ? "Choose Application Type" : "Configure Application"}
              </CardTitle>
              <CardDescription>
                {currentStep === 1
                  ? "Select a pre-built template or create a custom application"
                  : "Provide the required configuration for your application"}
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => router.push("/applications")}>
              Cancel
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {/* Step 1: Template Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              {/* Template Cards */}
              <div className="grid gap-4">
                {templateOptions.map((option) => (
                  <Card
                    key={option.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      selectedTemplate === option.id
                        ? "border-primary ring-2 ring-primary/20"
                        : ""
                    }`}
                    onClick={() => handleSelectTemplate(option.id)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="size-14 rounded-lg bg-muted">
                          {option.logoUrl ? (
                            <AvatarImage src={option.logoUrl} className="object-contain p-2" />
                          ) : null}
                          <AvatarFallback className="rounded-lg bg-muted">
                            {option.icon}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-lg">{option.name}</h3>
                                <Badge variant="secondary" className="text-xs">
                                  {option.category}
                                </Badge>
                                {option.toolCount > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    {option.toolCount} tools
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">
                                {option.description}
                              </p>
                              <div className="flex flex-wrap gap-2 mt-3">
                                {option.features.map((feature) => (
                                  <span
                                    key={feature}
                                    className="text-xs bg-muted px-2 py-1 rounded"
                                  >
                                    {feature}
                                  </span>
                                ))}
                              </div>
                            </div>
                            {selectedTemplate === option.id && (
                              <Check className="h-6 w-6 text-primary shrink-0" />
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Configuration Fields (shown after selection) */}
              {selectedTemplate && (
                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold">
                    {selectedTemplate === "custom" ? "Application Details" : "Connection Configuration"}
                  </h3>

                  {selectedTemplate === "shopify" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="shopify-store">
                          Shopify Store Name <span className="text-destructive">*</span>
                        </Label>
                        <div className="flex items-center gap-2">
                          <Input
                            id="shopify-store"
                            placeholder="my-store"
                            value={shopifyStore}
                            onChange={(e) => setShopifyStore(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                            className="max-w-xs"
                          />
                          <span className="text-muted-foreground text-sm">.myshopify.com</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Enter your store name from your Shopify URL (e.g., "my-store" from my-store.myshopify.com)
                        </p>
                      </div>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          25 essential Shopify tools will be auto-generated, including product management,
                          order processing, customer data, and inventory tracking.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {selectedTemplate === "quickbooks" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="quickbooks-realm">
                          QuickBooks Company ID (Realm ID) <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="quickbooks-realm"
                          placeholder="123456789012345678"
                          value={quickbooksRealmId}
                          onChange={(e) => setQuickbooksRealmId(e.target.value.replace(/\D/g, ""))}
                          className="max-w-xs"
                        />
                        <p className="text-xs text-muted-foreground">
                          Find your Company ID in QuickBooks: Settings → Account and Settings → look for "Company ID"
                        </p>
                      </div>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          30 essential QuickBooks tools will be auto-generated, including invoicing,
                          payments, customers, vendors, and financial reporting.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}

                  {selectedTemplate === "custom" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="custom-name">
                          Application Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="custom-name"
                          placeholder="My Application"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="custom-description">Description (optional)</Label>
                        <Textarea
                          id="custom-description"
                          placeholder="Describe what this application does..."
                          rows={3}
                          value={customDescription}
                          onChange={(e) => setCustomDescription(e.target.value)}
                        />
                      </div>
                      <Alert>
                        <Info className="h-4 w-4" />
                        <AlertDescription>
                          Custom applications start with no pre-configured tools. You'll configure
                          the API connection and create tools manually after setup.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleCreate} disabled={!canCreate || createApplication.isPending}>
                  {createApplication.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Application
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
