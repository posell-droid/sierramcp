"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, ArrowRight, Check, Search, Loader2, Key, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

type SetupMode = "template" | "custom"
type AuthType = "NONE" | "API_KEY" | "OAUTH2" | "BASIC" | "BEARER" | "CUSTOM_HEADER" | "MTLS"
type Environment = "PRODUCTION" | "SANDBOX" | "DEVELOPMENT"
type TemplateCategory =
  | "CRM"
  | "Support"
  | "Productivity"
  | "DevOps"
  | "Data"
  | "Monitoring"
  | "Payments"
  | "E-commerce"
  | "Identity"
  | "ERP/HR"

interface Template {
  slug: string
  name: string
  description: string
  category: TemplateCategory
  authTypes: AuthType[]
  logoUrl?: string
}

interface EnvironmentConfig {
  environment: Environment
  enabled: boolean
  baseUrl: string
  authType: AuthType
  authConfig: string
  credentialsSet: boolean
  credentials: Record<string, string>
}

// Stub hook for templates
function useApplicationTemplates() {
  const templates: Template[] = [
    {
      slug: "salesforce-crm",
      name: "Salesforce CRM",
      description: "Connect to Salesforce for customer data and pipeline management",
      category: "CRM",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/salesforce-logo.png",
    },
    {
      slug: "hubspot-crm",
      name: "HubSpot CRM",
      description: "Integrate HubSpot contacts, deals, and marketing automation",
      category: "CRM",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/hubspot-logo.png",
    },
    {
      slug: "zendesk-support",
      name: "Zendesk Support",
      description: "Access tickets, customers, and support workflows",
      category: "Support",
      authTypes: ["API_KEY", "OAUTH2"],
      logoUrl: "/zendesk-interface.png",
    },
    {
      slug: "intercom-support",
      name: "Intercom",
      description: "Customer messaging and support ticketing system",
      category: "Support",
      authTypes: ["API_KEY", "BEARER"],
      logoUrl: "/intercom.jpg",
    },
    {
      slug: "slack-productivity",
      name: "Slack",
      description: "Send messages, search conversations, and manage channels",
      category: "Productivity",
      authTypes: ["OAUTH2", "BEARER"],
      logoUrl: "/slack-communication.png",
    },
    {
      slug: "notion-productivity",
      name: "Notion",
      description: "Access databases, pages, and workspace content",
      category: "Productivity",
      authTypes: ["API_KEY", "OAUTH2"],
      logoUrl: "/notion-app-interface.png",
    },
    {
      slug: "github-devops",
      name: "GitHub",
      description: "Repository management, issues, and CI/CD workflows",
      category: "DevOps",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/github-logo.png",
    },
    {
      slug: "gitlab-devops",
      name: "GitLab",
      description: "Source control and DevOps platform integration",
      category: "DevOps",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/gitlab.jpg",
    },
    {
      slug: "snowflake-data",
      name: "Snowflake",
      description: "Query and analyze data warehouse tables",
      category: "Data",
      authTypes: ["API_KEY", "OAUTH2"],
      logoUrl: "/snowflake.jpg",
    },
    {
      slug: "postgres-data",
      name: "PostgreSQL",
      description: "Direct database connection for queries and analytics",
      category: "Data",
      authTypes: ["BASIC", "CUSTOM_HEADER"],
      logoUrl: "/postgresql-logo.png",
    },
    {
      slug: "datadog-monitoring",
      name: "Datadog",
      description: "Metrics, logs, and monitoring dashboards",
      category: "Monitoring",
      authTypes: ["API_KEY"],
      logoUrl: "/datadog.jpg",
    },
    {
      slug: "sentry-monitoring",
      name: "Sentry",
      description: "Error tracking and performance monitoring",
      category: "Monitoring",
      authTypes: ["API_KEY", "BEARER"],
      logoUrl: "/sentry.jpg",
    },
    {
      slug: "stripe-payments",
      name: "Stripe",
      description: "Payment processing and subscription management",
      category: "Payments",
      authTypes: ["API_KEY"],
      logoUrl: "/stripe-payment-gateway.png",
    },
    {
      slug: "square-payments",
      name: "Square",
      description: "POS and payment processing integration",
      category: "Payments",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/geometric-square.png",
    },
    {
      slug: "shopify-ecommerce",
      name: "Shopify",
      description: "E-commerce store and product management",
      category: "E-commerce",
      authTypes: ["API_KEY", "OAUTH2"],
      logoUrl: "/shopify-logo.png",
    },
    {
      slug: "woocommerce-ecommerce",
      name: "WooCommerce",
      description: "WordPress e-commerce plugin integration",
      category: "E-commerce",
      authTypes: ["API_KEY", "BASIC"],
      logoUrl: "/woocommerce-storefront.png",
    },
    {
      slug: "auth0-identity",
      name: "Auth0",
      description: "Identity and access management platform",
      category: "Identity",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/auth0.jpg",
    },
    {
      slug: "okta-identity",
      name: "Okta",
      description: "Enterprise identity and SSO provider",
      category: "Identity",
      authTypes: ["OAUTH2", "API_KEY"],
      logoUrl: "/okta.jpg",
    },
    {
      slug: "workday-erp",
      name: "Workday",
      description: "HR and financial management system",
      category: "ERP/HR",
      authTypes: ["OAUTH2", "BASIC"],
      logoUrl: "/workday.jpg",
    },
    {
      slug: "bamboohr-hr",
      name: "BambooHR",
      description: "Human resources information system",
      category: "ERP/HR",
      authTypes: ["API_KEY"],
      logoUrl: "/bamboohr.jpg",
    },
  ]

  return {
    data: templates,
    isLoading: false,
    error: null,
  }
}

// Stub hook for creating application
function useCreateApplication() {
  const router = useRouter()

  const mutateAsync = async (payload: any) => {
    console.log("[v0] Creating application:", payload)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    const mockId = `app_${Math.random().toString(36).substring(7)}`

    toast.success("Application created successfully", {
      description: `${payload.name} is ready to configure`,
    })

    router.push(`/applications/${mockId}`)
  }

  return {
    mutateAsync,
    isPending: false,
  }
}

export default function NewApplicationPage() {
  const router = useRouter()
  const { data: templates = [], isLoading: templatesLoading } = useApplicationTemplates()
  const { mutateAsync: createApplication, isPending } = useCreateApplication()

  // Step management
  const [currentStep, setCurrentStep] = useState<1 | 2>(1)

  // Step 1: Setup mode
  const [setupMode, setSetupMode] = useState<SetupMode>("template")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [customName, setCustomName] = useState("")
  const [customDescription, setCustomDescription] = useState("")

  // Filters for template mode
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("All")

  // Step 2: Environments
  const [environments, setEnvironments] = useState<EnvironmentConfig[]>([
    {
      environment: "PRODUCTION",
      enabled: true,
      baseUrl: "",
      authType: "NONE",
      authConfig: "",
      credentialsSet: false,
      credentials: {},
    },
    {
      environment: "SANDBOX",
      enabled: false,
      baseUrl: "",
      authType: "NONE",
      authConfig: "",
      credentialsSet: false,
      credentials: {},
    },
    {
      environment: "DEVELOPMENT",
      enabled: false,
      baseUrl: "",
      authType: "NONE",
      authConfig: "",
      credentialsSet: false,
      credentials: {},
    },
  ])

  // Credentials dialog
  const [credentialsDialogOpen, setCredentialsDialogOpen] = useState(false)
  const [selectedEnvForCreds, setSelectedEnvForCreds] = useState<Environment | null>(null)
  const [tempCredentials, setTempCredentials] = useState<Record<string, string>>({})

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "All" || t.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const canContinueStep1 = setupMode === "template" ? selectedTemplate !== null : customName.trim() !== ""

  const canSubmit = environments.some((env) => env.enabled && env.baseUrl.trim() !== "")

  const handleContinue = () => {
    if (!canContinueStep1) return
    setCurrentStep(2)
  }

  const handleBack = () => {
    setCurrentStep(1)
  }

  const handleToggleEnvironment = (env: Environment, enabled: boolean) => {
    setEnvironments((prev) => prev.map((e) => (e.environment === env ? { ...e, enabled } : e)))
  }

  const handleUpdateEnvironment = (env: Environment, field: keyof EnvironmentConfig, value: any) => {
    setEnvironments((prev) => prev.map((e) => (e.environment === env ? { ...e, [field]: value } : e)))
  }

  const handleOpenCredentialsDialog = (env: Environment) => {
    const envConfig = environments.find((e) => e.environment === env)
    if (!envConfig) return

    setSelectedEnvForCreds(env)
    setTempCredentials(envConfig.credentials || {})
    setCredentialsDialogOpen(true)
  }

  const handleSaveCredentials = () => {
    if (!selectedEnvForCreds) return

    setEnvironments((prev) =>
      prev.map((e) =>
        e.environment === selectedEnvForCreds
          ? { ...e, credentials: tempCredentials, credentialsSet: Object.keys(tempCredentials).length > 0 }
          : e,
      ),
    )

    setCredentialsDialogOpen(false)
    setSelectedEnvForCreds(null)
    setTempCredentials({})
    toast.success("Credentials saved")
  }

  const handleCreate = async () => {
    const payload = {
      type: setupMode,
      templateSlug: selectedTemplate?.slug,
      name: setupMode === "template" ? selectedTemplate?.name : customName,
      description: setupMode === "template" ? selectedTemplate?.description : customDescription,
      environments: environments
        .filter((e) => e.enabled)
        .map((e) => ({
          environment: e.environment,
          baseUrl: e.baseUrl,
          authType: e.authType,
          authConfig: e.authConfig ? JSON.parse(e.authConfig) : null,
          credentialsSet: e.credentialsSet,
        })),
    }

    await createApplication(payload)
  }

  const getAuthFieldsForType = (authType: AuthType): string[] => {
    switch (authType) {
      case "API_KEY":
        return ["apiKey"]
      case "OAUTH2":
        return ["clientId", "clientSecret", "authUrl", "tokenUrl", "scopes"]
      case "BASIC":
        return ["username", "password"]
      case "BEARER":
        return ["token"]
      case "CUSTOM_HEADER":
        return ["headerName", "headerValue"]
      case "MTLS":
        return ["certReference"]
      default:
        return []
    }
  }

  const selectedEnvConfig = environments.find((e) => e.environment === selectedEnvForCreds)
  const authFields = selectedEnvConfig ? getAuthFieldsForType(selectedEnvConfig.authType) : []

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-4xl">
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
                <CardTitle>Step {currentStep} of 2</CardTitle>
                <CardDescription>
                  {currentStep === 1 ? "Choose your setup method" : "Configure environments and authentication"}
                </CardDescription>
              </div>
              {currentStep === 1 && (
                <Button variant="outline" onClick={() => router.push("/applications")}>
                  Cancel
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent>
            {/* Step 1: Choose Setup Method */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <Tabs value={setupMode} onValueChange={(v) => setSetupMode(v as SetupMode)}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="template">From Template</TabsTrigger>
                    <TabsTrigger value="custom">Custom</TabsTrigger>
                  </TabsList>

                  <TabsContent value="template" className="space-y-4 mt-6">
                    {/* Filters */}
                    <div className="flex flex-col gap-4 sm:flex-row">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search templates..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All">All Categories</SelectItem>
                          <SelectItem value="CRM">CRM</SelectItem>
                          <SelectItem value="Support">Support</SelectItem>
                          <SelectItem value="Productivity">Productivity</SelectItem>
                          <SelectItem value="DevOps">DevOps</SelectItem>
                          <SelectItem value="Data">Data</SelectItem>
                          <SelectItem value="Monitoring">Monitoring</SelectItem>
                          <SelectItem value="Payments">Payments</SelectItem>
                          <SelectItem value="E-commerce">E-commerce</SelectItem>
                          <SelectItem value="Identity">Identity</SelectItem>
                          <SelectItem value="ERP/HR">ERP/HR</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Template Grid */}
                    {templatesLoading ? (
                      <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {filteredTemplates.map((template) => (
                          <Card
                            key={template.slug}
                            className={`cursor-pointer transition-all hover:shadow-md ${
                              selectedTemplate?.slug === template.slug ? "border-primary ring-2 ring-primary/20" : ""
                            }`}
                            onClick={() => setSelectedTemplate(template)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Avatar className="size-10 rounded-md">
                                  <AvatarImage src={template.logoUrl || "/placeholder.svg"} />
                                  <AvatarFallback className="rounded-md text-xs">
                                    {template.name.substring(0, 2).toUpperCase()}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <h4 className="font-semibold text-sm leading-tight">{template.name}</h4>
                                      <p className="text-xs text-muted-foreground mt-0.5">{template.category}</p>
                                    </div>
                                    {selectedTemplate?.slug === template.slug && (
                                      <Check className="h-5 w-5 text-primary shrink-0" />
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                    {template.description}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {template.authTypes.map((authType) => (
                                      <Badge key={authType} variant="secondary" className="text-xs">
                                        {authType.replace("_", " ")}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="custom" className="space-y-4 mt-6">
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">
                          Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="name"
                          placeholder="My Application"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description (optional)</Label>
                        <Textarea
                          id="description"
                          placeholder="Describe what this application does..."
                          rows={4}
                          value={customDescription}
                          onChange={(e) => setCustomDescription(e.target.value)}
                        />
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>

                {/* Step 1 Actions */}
                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={handleContinue} disabled={!canContinueStep1}>
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Configure Environments */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Summary */}
                <div className="rounded-lg border bg-muted/50 p-4">
                  {setupMode === "template" && selectedTemplate ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 rounded-md">
                        <AvatarImage src={selectedTemplate.logoUrl || "/placeholder.svg"} />
                        <AvatarFallback className="rounded-md">
                          {selectedTemplate.name.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h4 className="font-semibold text-sm">{selectedTemplate.name}</h4>
                        <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h4 className="font-semibold text-sm">{customName}</h4>
                      {customDescription && <p className="text-xs text-muted-foreground mt-1">{customDescription}</p>}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Environment Configuration */}
                <div className="space-y-4">
                  <h3 className="font-semibold">Environment Configuration</h3>

                  <Accordion type="multiple" defaultValue={["PRODUCTION"]} className="space-y-2">
                    {environments.map((env) => (
                      <AccordionItem key={env.environment} value={env.environment} className="border rounded-lg px-4">
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center justify-between w-full pr-2">
                            <div className="flex items-center gap-3">
                              <Switch
                                checked={env.enabled}
                                onCheckedChange={(checked) => handleToggleEnvironment(env.environment, checked)}
                                disabled={env.environment === "PRODUCTION"}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <span className="font-medium">
                                {env.environment.charAt(0) + env.environment.slice(1).toLowerCase()}
                              </span>
                              {env.environment === "PRODUCTION" && (
                                <Badge variant="secondary" className="text-xs">
                                  Required
                                </Badge>
                              )}
                            </div>
                            {env.enabled && env.credentialsSet && (
                              <Badge variant="outline" className="text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Credentials Set
                              </Badge>
                            )}
                          </div>
                        </AccordionTrigger>

                        {env.enabled && (
                          <AccordionContent className="space-y-4 pb-4">
                            <div className="space-y-2">
                              <Label htmlFor={`${env.environment}-baseUrl`}>
                                Base URL{" "}
                                {env.environment === "PRODUCTION" && <span className="text-destructive">*</span>}
                              </Label>
                              <Input
                                id={`${env.environment}-baseUrl`}
                                placeholder="https://api.example.com"
                                value={env.baseUrl}
                                onChange={(e) => handleUpdateEnvironment(env.environment, "baseUrl", e.target.value)}
                              />
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor={`${env.environment}-authType`}>Authentication Type</Label>
                              <Select
                                value={env.authType}
                                onValueChange={(value) =>
                                  handleUpdateEnvironment(env.environment, "authType", value as AuthType)
                                }
                              >
                                <SelectTrigger id={`${env.environment}-authType`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="NONE">None</SelectItem>
                                  <SelectItem value="API_KEY">API Key</SelectItem>
                                  <SelectItem value="OAUTH2">OAuth 2.0</SelectItem>
                                  <SelectItem value="BASIC">Basic Auth</SelectItem>
                                  <SelectItem value="BEARER">Bearer Token</SelectItem>
                                  <SelectItem value="CUSTOM_HEADER">Custom Header</SelectItem>
                                  <SelectItem value="MTLS">mTLS</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            {env.authType !== "NONE" && (
                              <>
                                <div className="space-y-2">
                                  <Label htmlFor={`${env.environment}-authConfig`}>
                                    Auth metadata (non-secret JSON)
                                  </Label>
                                  <Textarea
                                    id={`${env.environment}-authConfig`}
                                    placeholder='{"scope": "read write", "audience": "api.example.com"}'
                                    rows={3}
                                    value={env.authConfig}
                                    onChange={(e) =>
                                      handleUpdateEnvironment(env.environment, "authConfig", e.target.value)
                                    }
                                  />
                                  <p className="text-xs text-muted-foreground">
                                    Do not paste secrets here. Secrets are stored separately in Credentials.
                                  </p>
                                </div>

                                <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                                  <div className="flex items-center gap-2">
                                    <Key className="h-4 w-4 text-muted-foreground" />
                                    <span className="text-sm font-medium">Credentials</span>
                                    {env.credentialsSet && (
                                      <Badge variant="outline" className="text-xs">
                                        <Check className="h-3 w-3 mr-1" />
                                        Set
                                      </Badge>
                                    )}
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleOpenCredentialsDialog(env.environment)}
                                  >
                                    <ShieldCheck className="h-4 w-4 mr-2" />
                                    {env.credentialsSet ? "Update" : "Set Credentials"}
                                  </Button>
                                </div>
                              </>
                            )}
                          </AccordionContent>
                        )}
                      </AccordionItem>
                    ))}
                  </Accordion>
                </div>

                {/* Step 2 Actions */}
                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                  </Button>
                  <Button onClick={handleCreate} disabled={!canSubmit || isPending}>
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Application
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credentials Dialog */}
        <Dialog open={credentialsDialogOpen} onOpenChange={setCredentialsDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Credentials</DialogTitle>
              <DialogDescription>
                {selectedEnvForCreds &&
                  `Configure authentication credentials for ${selectedEnvForCreds.toLowerCase()} environment`}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {authFields.length === 0 ? (
                <p className="text-sm text-muted-foreground">Select an authentication type to configure credentials.</p>
              ) : (
                authFields.map((field) => (
                  <div key={field} className="space-y-2">
                    <Label htmlFor={field}>
                      {field
                        .replace(/([A-Z])/g, " $1")
                        .replace(/^./, (str) => str.toUpperCase())
                        .trim()}
                    </Label>
                    <Input
                      id={field}
                      type={
                        field.toLowerCase().includes("secret") || field.toLowerCase().includes("password")
                          ? "password"
                          : "text"
                      }
                      placeholder={`Enter ${field}`}
                      value={tempCredentials[field] || ""}
                      onChange={(e) => setTempCredentials({ ...tempCredentials, [field]: e.target.value })}
                    />
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setCredentialsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveCredentials}>Save Credentials</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
