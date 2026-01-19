"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { ChevronRight, Info, Loader2, Search, X, Package, Settings, Plus } from "lucide-react"

// Stub hook for loading mock data
function useMockTools() {
  return {
    tools: [
      {
        id: "1",
        name: "get_invoice",
        category: "Finance",
        version: "v1.2.0",
        description: "Retrieve invoice details by ID",
        requiresConfig: ["api_key"],
        requiresSecrets: ["stripe_secret"],
      },
      {
        id: "2",
        name: "list_transactions",
        category: "Finance",
        version: "v1.0.3",
        description: "List recent transactions",
        requiresConfig: [],
        requiresSecrets: ["stripe_secret"],
      },
      {
        id: "3",
        name: "send_email",
        category: "Communication",
        version: "v2.1.0",
        description: "Send email notifications",
        requiresConfig: ["sender_email"],
        requiresSecrets: ["sendgrid_api_key"],
      },
      {
        id: "4",
        name: "create_ticket",
        category: "Support",
        version: "v1.5.0",
        description: "Create support ticket",
        requiresConfig: ["ticket_priority"],
        requiresSecrets: ["zendesk_token"],
      },
    ],
    isLoading: false,
  }
}

function BreadcrumbNav() {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/mcps">MCPs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Create MCP</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

type ConfigField = {
  name: string
  type: "string" | "number" | "boolean" | "json"
  required: boolean
  exampleValue: string
}

export default function CreateMCPPage() {
  const router = useRouter()
  const { tools: availableTools, isLoading } = useMockTools()

  // Wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [isCreating, setIsCreating] = useState(false)

  // Step 1: Basic Info
  const [mcpName, setMcpName] = useState("")
  const [description, setDescription] = useState("")
  const [department, setDepartment] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState("")
  const [visibility, setVisibility] = useState<"private" | "shared">("private")

  // Step 2: Select Tools
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [selectedTools, setSelectedTools] = useState<
    Array<{ id: string; name: string; version: string; pinnedVersion: string }>
  >([])

  // Step 3: Configuration & Policies
  const [configFields, setConfigFields] = useState<ConfigField[]>([
    { name: "api_key", type: "string", required: true, exampleValue: "sk_test_..." },
  ])
  const [maxRows, setMaxRows] = useState("100")
  const [timeout, setTimeout] = useState("30")
  const [maxCalls, setMaxCalls] = useState("10")
  const [egressDomains, setEgressDomains] = useState<string[]>(["api.stripe.com"])
  const [domainInput, setDomainInput] = useState("")

  // Validation
  const canContinueStep1 = mcpName.trim().length > 0 && mcpName.length <= 64
  const canContinueStep2 = selectedTools.length > 0
  const canContinueStep3 = true

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()])
      setTagInput("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleToggleTool = (tool: (typeof availableTools)[0]) => {
    const isSelected = selectedTools.some((t) => t.id === tool.id)
    if (isSelected) {
      setSelectedTools(selectedTools.filter((t) => t.id !== tool.id))
    } else {
      setSelectedTools([
        ...selectedTools,
        { id: tool.id, name: tool.name, version: tool.version, pinnedVersion: tool.version },
      ])
    }
  }

  const handleVersionChange = (toolId: string, version: string) => {
    setSelectedTools(selectedTools.map((t) => (t.id === toolId ? { ...t, pinnedVersion: version } : t)))
  }

  const handleRemoveTool = (toolId: string) => {
    setSelectedTools(selectedTools.filter((t) => t.id !== toolId))
  }

  const handleAddConfigField = () => {
    setConfigFields([...configFields, { name: "", type: "string", required: false, exampleValue: "" }])
  }

  const handleRemoveConfigField = (index: number) => {
    setConfigFields(configFields.filter((_, i) => i !== index))
  }

  const handleAddDomain = () => {
    if (domainInput.trim() && !egressDomains.includes(domainInput.trim())) {
      setEgressDomains([...egressDomains, domainInput.trim()])
      setDomainInput("")
    }
  }

  const handleRemoveDomain = (domain: string) => {
    setEgressDomains(egressDomains.filter((d) => d !== domain))
  }

  const handleCreateMCP = async (publish: boolean) => {
    setIsCreating(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsCreating(false)
    toast.success(`MCP ${publish ? "created and published" : "created as draft"} successfully`)
    router.push("/mcps/mcp-123") // Redirect to MCP detail page
  }

  const filteredTools = availableTools.filter((tool) => {
    const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "all" || tool.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const categories = Array.from(new Set(availableTools.map((t) => t.category)))

  const progressPercentage = (currentStep / 4) * 100

  // Infer secrets from selected tools
  const inferredSecrets = Array.from(
    new Set(selectedTools.flatMap((st) => availableTools.find((t) => t.id === st.id)?.requiresSecrets || [])),
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-5xl">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-5xl">
        {/* Breadcrumbs */}
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <BreadcrumbNav />
        </Suspense>

        {/* Header */}
        <div className="mt-6 mb-8">
          <h1 className="text-3xl font-semibold tracking-tight mb-2">Create New MCP</h1>
          <p className="text-muted-foreground">
            Package tools into a reusable MCP that can be deployed as a chatbot or LLM tool.
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Step {currentStep} of 4</span>
            <span className="text-sm text-muted-foreground">{progressPercentage.toFixed(0)}% complete</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span className={currentStep >= 1 ? "text-primary font-medium" : ""}>Basic Info</span>
            <span className={currentStep >= 2 ? "text-primary font-medium" : ""}>Select Tools</span>
            <span className={currentStep >= 3 ? "text-primary font-medium" : ""}>Configuration</span>
            <span className={currentStep >= 4 ? "text-primary font-medium" : ""}>Review</span>
          </div>
        </div>

        {/* Wizard Content */}
        <Card>
          <CardContent className="p-8">
            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Basic Information</h2>
                  <p className="text-sm text-muted-foreground">Define the core details of your MCP</p>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="mcp-name">
                      MCP Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="mcp-name"
                      placeholder="e.g., Finance Analytics MCP"
                      value={mcpName}
                      onChange={(e) => setMcpName(e.target.value)}
                      maxLength={64}
                    />
                    <p className="text-xs text-muted-foreground">
                      {mcpName.length}/64 characters. Choose a descriptive name for your MCP.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this MCP does and when to use it..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department / Team (optional)</Label>
                    <Input
                      id="department"
                      placeholder="e.g., Finance"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="tags">Tags</Label>
                    <div className="flex gap-2">
                      <Input
                        id="tags"
                        placeholder="Add a tag..."
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddTag()
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={handleAddTag}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="pl-2 pr-1">
                            {tag}
                            <button
                              onClick={() => handleRemoveTag(tag)}
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="visibility">Visibility</Label>
                    <Select value={visibility} onValueChange={(v) => setVisibility(v as "private" | "shared")}>
                      <SelectTrigger id="visibility">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="private">Private (only you)</SelectItem>
                        <SelectItem value="shared">Shared within tenant</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    MCPs define tool capabilities. You can deploy multiple instances later.
                  </AlertDescription>
                </Alert>
              </div>
            )}

            {/* Step 2: Select Tools */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Select Tools</h2>
                  <p className="text-sm text-muted-foreground">Choose which tools to include in this MCP</p>
                </div>

                <Separator />

                <Alert className="bg-blue-500/10 border-blue-500/20">
                  <Info className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="text-blue-700 dark:text-blue-400">
                    Tool versions are pinned per MCP version for reproducibility.
                  </AlertDescription>
                </Alert>

                <div className="grid md:grid-cols-2 gap-6">
                  {/* Left: Tool Catalog */}
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search tools..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="All categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All categories</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {cat}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Tool Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Version</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredTools.map((tool) => (
                            <TableRow key={tool.id}>
                              <TableCell>
                                <Checkbox
                                  checked={selectedTools.some((t) => t.id === tool.id)}
                                  onCheckedChange={() => handleToggleTool(tool)}
                                />
                              </TableCell>
                              <TableCell>
                                <div>
                                  <div className="font-medium">{tool.name}</div>
                                  <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {tool.description}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary" className="text-xs">
                                  {tool.category}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-mono">{tool.version}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Right: Selected Tools */}
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Selected Tools ({selectedTools.length})
                    </h3>
                    {selectedTools.length === 0 ? (
                      <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                          <Package className="h-12 w-12 text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">No tools selected</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Select tools from the catalog on the left
                          </p>
                        </CardContent>
                      </Card>
                    ) : (
                      <div className="space-y-3">
                        {selectedTools.map((tool) => (
                          <Card key={tool.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="font-medium">{tool.name}</div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleRemoveTool(tool.id)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Version</Label>
                                <Select
                                  value={tool.pinnedVersion}
                                  onValueChange={(v) => handleVersionChange(tool.id, v)}
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={tool.version}>{tool.version} (latest)</SelectItem>
                                    <SelectItem value="v1.0.0">v1.0.0</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Configuration & Policies */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Configuration & Policies</h2>
                  <p className="text-sm text-muted-foreground">Define runtime configuration and security policies</p>
                </div>

                <Separator />

                {/* Configuration Fields */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Configuration Fields</Label>
                    <Button variant="outline" size="sm" onClick={handleAddConfigField}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Field
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {configFields.map((field, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="grid grid-cols-4 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Name</Label>
                              <Input
                                placeholder="field_name"
                                value={field.name}
                                onChange={(e) => {
                                  const updated = [...configFields]
                                  updated[index].name = e.target.value
                                  setConfigFields(updated)
                                }}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Type</Label>
                              <Select
                                value={field.type}
                                onValueChange={(v) => {
                                  const updated = [...configFields]
                                  updated[index].type = v as ConfigField["type"]
                                  setConfigFields(updated)
                                }}
                              >
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="string">String</SelectItem>
                                  <SelectItem value="number">Number</SelectItem>
                                  <SelectItem value="boolean">Boolean</SelectItem>
                                  <SelectItem value="json">JSON</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Example Value</Label>
                              <Input
                                placeholder="example..."
                                value={field.exampleValue}
                                onChange={(e) => {
                                  const updated = [...configFields]
                                  updated[index].exampleValue = e.target.value
                                  setConfigFields(updated)
                                }}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Required</Label>
                              <div className="flex items-center gap-2 h-8">
                                <Checkbox
                                  checked={field.required}
                                  onCheckedChange={(checked) => {
                                    const updated = [...configFields]
                                    updated[index].required = checked as boolean
                                    setConfigFields(updated)
                                  }}
                                />
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => handleRemoveConfigField(index)}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Secrets */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Secrets</Label>
                  <Alert className="bg-amber-500/10 border-amber-500/20">
                    <Info className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-700 dark:text-amber-300">
                      Secrets are referenced at deployment time using AWS Secrets Manager.
                    </AlertDescription>
                  </Alert>
                  <Card>
                    <CardContent className="p-4">
                      {inferredSecrets.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No secrets required by selected tools
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {inferredSecrets.map((secret) => (
                            <div key={secret} className="flex items-center justify-between p-2 border rounded">
                              <span className="text-sm font-mono">{secret}</span>
                              <Badge variant="secondary" className="text-xs">
                                Bind at deployment
                              </Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Policies */}
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Policies</Label>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="max-rows">Max rows per tool result</Label>
                      <Input id="max-rows" type="number" value={maxRows} onChange={(e) => setMaxRows(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="timeout">Tool timeout (seconds)</Label>
                      <Input id="timeout" type="number" value={timeout} onChange={(e) => setTimeout(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-calls">Max tool calls per request</Label>
                      <Input
                        id="max-calls"
                        type="number"
                        value={maxCalls}
                        onChange={(e) => setMaxCalls(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="egress">Allowed egress domains</Label>
                    <div className="flex gap-2">
                      <Input
                        id="egress"
                        placeholder="e.g., api.example.com"
                        value={domainInput}
                        onChange={(e) => setDomainInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddDomain()
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={handleAddDomain}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {egressDomains.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {egressDomains.map((domain) => (
                          <Badge key={domain} variant="secondary" className="pl-2 pr-1 font-mono text-xs">
                            {domain}
                            <button
                              onClick={() => handleRemoveDomain(domain)}
                              className="ml-1 hover:bg-muted rounded-full p-0.5"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Review & Create */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Review & Create</h2>
                  <p className="text-sm text-muted-foreground">Review your MCP configuration before creating</p>
                </div>

                <Separator />

                <div className="space-y-6">
                  {/* Basic Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        Basic Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">MCP Name:</span>
                        <span className="font-medium">{mcpName}</span>
                      </div>
                      {description && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Description:</span>
                          <span className="font-medium text-right max-w-md">{description}</span>
                        </div>
                      )}
                      {department && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department:</span>
                          <span className="font-medium">{department}</span>
                        </div>
                      )}
                      {tags.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tags:</span>
                          <div className="flex flex-wrap gap-1 justify-end">
                            {tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Visibility:</span>
                        <Badge variant={visibility === "private" ? "secondary" : "outline"}>
                          {visibility === "private" ? "Private" : "Shared"}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Selected Tools */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Selected Tools ({selectedTools.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {selectedTools.map((tool) => (
                          <div key={tool.id} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm font-medium">{tool.name}</span>
                            <Badge variant="outline" className="font-mono text-xs">
                              {tool.pinnedVersion}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Configuration Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        Configuration & Policies
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Config fields:</span>
                        <span className="font-medium">{configFields.length}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Secrets:</span>
                        <span className="font-medium">{inferredSecrets.length}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max rows:</span>
                        <span className="font-medium">{maxRows}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Timeout:</span>
                        <span className="font-medium">{timeout}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max calls:</span>
                        <span className="font-medium">{maxCalls}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Egress domains:</span>
                        <span className="font-medium">{egressDomains.length}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Alert className="bg-blue-500/10 border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-600" />
                    <AlertDescription className="text-blue-700 dark:text-blue-400">
                      You can publish new versions and deploy this MCP after creation.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="mt-6 flex items-center justify-between">
          <div>
            {currentStep > 1 && (
              <Button variant="outline" onClick={() => setCurrentStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => router.push("/mcps")}>
              Cancel
            </Button>
            {currentStep < 4 ? (
              <Button
                onClick={() => setCurrentStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
                disabled={
                  (currentStep === 1 && !canContinueStep1) ||
                  (currentStep === 2 && !canContinueStep2) ||
                  (currentStep === 3 && !canContinueStep3)
                }
              >
                Next
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleCreateMCP(false)} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create MCP (Draft)"
                  )}
                </Button>
                <Button onClick={() => handleCreateMCP(true)} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create & Publish v1"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
