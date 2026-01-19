"use client"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Plus, Search, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

interface Tool {
  id: string
  name: string
  description: string
  currentVersion: string
  availableVersions: string[]
  lastUpdated: Date
  enabled: boolean
  inputSchema: {
    properties: Record<string, { type: string; description: string; required?: boolean }>
  }
  outputSchema: {
    properties: Record<string, { type: string; description: string }>
  }
}

interface AvailableTool {
  id: string
  name: string
  description: string
  latestVersion: string
  category: string
  applicationName: string
}

// Stub hooks
function useMCPTools(mcpId: string) {
  const [tools] = useState<Tool[]>([
    {
      id: "tool-1",
      name: "Get Account Balance",
      description: "Retrieves the current balance and account details for a given account ID",
      currentVersion: "v2.1.0",
      availableVersions: ["v2.1.0", "v2.0.0", "v1.5.0"],
      lastUpdated: new Date(Date.now() - 2 * 60 * 60 * 1000),
      enabled: true,
      inputSchema: {
        properties: {
          accountId: { type: "string", description: "Unique account identifier", required: true },
          includeHistory: { type: "boolean", description: "Include transaction history" },
        },
      },
      outputSchema: {
        properties: {
          balance: { type: "number", description: "Current account balance" },
          currency: { type: "string", description: "Currency code (USD, EUR, etc.)" },
          lastTransaction: { type: "object", description: "Most recent transaction details" },
        },
      },
    },
    {
      id: "tool-2",
      name: "Calculate Revenue Forecast",
      description: "Generates revenue projections based on historical data and market trends",
      currentVersion: "v1.3.0",
      availableVersions: ["v1.3.0", "v1.2.0"],
      lastUpdated: new Date(Date.now() - 5 * 60 * 60 * 1000),
      enabled: true,
      inputSchema: {
        properties: {
          startDate: { type: "string", description: "Forecast start date (ISO format)", required: true },
          endDate: { type: "string", description: "Forecast end date (ISO format)", required: true },
          includeSeasonality: { type: "boolean", description: "Apply seasonal adjustments" },
        },
      },
      outputSchema: {
        properties: {
          projectedRevenue: { type: "number", description: "Forecasted revenue amount" },
          confidence: { type: "number", description: "Confidence score (0-100)" },
          breakdown: { type: "array", description: "Monthly breakdown of projections" },
        },
      },
    },
    {
      id: "tool-3",
      name: "Export Financial Report",
      description: "Generates and exports comprehensive financial reports in multiple formats",
      currentVersion: "v2.0.1",
      availableVersions: ["v2.0.1", "v2.0.0", "v1.9.0"],
      lastUpdated: new Date(Date.now() - 24 * 60 * 60 * 1000),
      enabled: false,
      inputSchema: {
        properties: {
          reportType: { type: "string", description: "Type of report (P&L, Balance Sheet, etc.)", required: true },
          period: { type: "string", description: "Reporting period (monthly, quarterly, yearly)", required: true },
          format: { type: "string", description: "Output format (PDF, Excel, CSV)" },
        },
      },
      outputSchema: {
        properties: {
          reportUrl: { type: "string", description: "Download URL for generated report" },
          expiresAt: { type: "string", description: "URL expiration timestamp" },
          fileSize: { type: "number", description: "File size in bytes" },
        },
      },
    },
  ])

  return { data: tools, isLoading: false }
}

function useAvailableTools() {
  const [tools] = useState<AvailableTool[]>([
    {
      id: "tool-4",
      name: "Budget Approval Workflow",
      description: "Automates budget approval routing and notifications",
      latestVersion: "v1.0.0",
      category: "Workflow",
      applicationName: "Finance Analytics",
    },
    {
      id: "tool-5",
      name: "Currency Converter",
      description: "Real-time currency conversion with historical rates",
      latestVersion: "v2.5.0",
      category: "Utility",
      applicationName: "Finance Analytics",
    },
    {
      id: "tool-6",
      name: "Tax Calculator",
      description: "Calculates applicable taxes based on jurisdiction and amount",
      latestVersion: "v1.2.0",
      category: "Compliance",
      applicationName: "Finance Analytics",
    },
  ])

  return { data: tools, isLoading: false }
}

function useMCP(id: string) {
  return {
    data: { id, name: "Finance Analytics" },
    isLoading: false,
  }
}

function BreadcrumbNav({ id, mcpName }: { id: string; mcpName: string }) {
  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/mcps">MCPs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/mcps/${id}`}>{mcpName}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Tools</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function MCPToolsPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: mcp } = useMCP(id)
  const { data: tools, isLoading } = useMCPTools(id)
  const { data: availableTools } = useAvailableTools()

  const [addToolsDialogOpen, setAddToolsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [previewSheetOpen, setPreviewSheetOpen] = useState(false)
  const [previewTool, setPreviewTool] = useState<Tool | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const filteredAvailableTools = availableTools.filter(
    (tool) =>
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const handleToggleToolSelection = (toolId: string) => {
    const newSelection = new Set(selectedTools)
    if (newSelection.has(toolId)) {
      newSelection.delete(toolId)
    } else {
      newSelection.add(toolId)
    }
    setSelectedTools(newSelection)
  }

  const handleAddTools = async () => {
    if (selectedTools.size === 0) return

    console.log("[v0] Adding tools:", Array.from(selectedTools))
    await new Promise((resolve) => setTimeout(resolve, 1000))

    toast.success(`Added ${selectedTools.size} tool(s) to MCP`)
    setSelectedTools(new Set())
    setAddToolsDialogOpen(false)
    setHasUnsavedChanges(true)
  }

  const handleToggleEnabled = (toolId: string, enabled: boolean) => {
    console.log("[v0] Toggling tool enabled:", toolId, enabled)
    setHasUnsavedChanges(true)
  }

  const handleVersionChange = (toolId: string, version: string) => {
    console.log("[v0] Changing tool version:", toolId, version)
    setHasUnsavedChanges(true)
  }

  const handleViewSchema = (tool: Tool) => {
    setPreviewTool(tool)
    setPreviewSheetOpen(true)
  }

  const handleSaveChanges = async () => {
    setIsSaving(true)
    console.log("[v0] Saving tool configuration changes")
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsSaving(false)
    setHasUnsavedChanges(false)
    toast.success("Changes saved successfully")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-64 bg-muted rounded" />
            <div className="h-10 w-96 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <BreadcrumbNav id={id} mcpName={mcp?.name || "MCP"} />
        </Suspense>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Tools</h1>
            <p className="text-muted-foreground mt-1">
              Manage the tools included in this MCP and configure their versions
            </p>
          </div>
          <Button onClick={() => setAddToolsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Tools
          </Button>
        </div>

        {/* Tools List */}
        <div className="space-y-3">
          {tools.map((tool) => (
            <Card key={tool.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-base">{tool.name}</h3>
                      {!tool.enabled && (
                        <Badge variant="outline" className="text-xs">
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{tool.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Updated {formatDistanceToNow(tool.lastUpdated, { addSuffix: true })}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {/* Version Dropdown */}
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor={`version-${tool.id}`} className="text-xs text-muted-foreground">
                        Version (pinned)
                      </Label>
                      <Select
                        value={tool.currentVersion}
                        onValueChange={(version) => handleVersionChange(tool.id, version)}
                      >
                        <SelectTrigger id={`version-${tool.id}`} className="w-[120px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {tool.availableVersions.map((version) => (
                            <SelectItem key={version} value={version} className="text-xs">
                              {version}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Enabled Toggle */}
                    <div className="flex flex-col gap-1.5 items-center">
                      <Label htmlFor={`enabled-${tool.id}`} className="text-xs text-muted-foreground">
                        Enabled
                      </Label>
                      <Switch
                        id={`enabled-${tool.id}`}
                        checked={tool.enabled}
                        onCheckedChange={(enabled) => handleToggleEnabled(tool.id, enabled)}
                      />
                    </div>

                    {/* View Schema Button */}
                    <div className="flex flex-col gap-1.5">
                      <div className="h-4" /> {/* Spacer to align with other controls */}
                      <Button variant="outline" size="sm" onClick={() => handleViewSchema(tool)} className="h-8">
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        View schema
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          {tools.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <h3 className="text-lg font-semibold mb-1">No tools added yet</h3>
                <p className="text-muted-foreground mb-4">Add tools to this MCP to get started</p>
                <Button onClick={() => setAddToolsDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tools
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Tools Dialog */}
        <Dialog open={addToolsDialogOpen} onOpenChange={setAddToolsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Tools to MCP</DialogTitle>
              <DialogDescription>Select tools from your applications to include in this MCP server</DialogDescription>
            </DialogHeader>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tool Catalog List */}
            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {filteredAvailableTools.map((tool) => (
                <div
                  key={tool.id}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleToggleToolSelection(tool.id)}
                >
                  <Checkbox
                    checked={selectedTools.has(tool.id)}
                    onCheckedChange={() => handleToggleToolSelection(tool.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{tool.name}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {tool.latestVersion}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{tool.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-xs text-muted-foreground">
                        Category: <span className="font-medium">{tool.category}</span>
                      </span>
                      <Separator orientation="vertical" className="h-3" />
                      <span className="text-xs text-muted-foreground">
                        App: <span className="font-medium">{tool.applicationName}</span>
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {filteredAvailableTools.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">No tools found matching &quot;{searchQuery}&quot;</p>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setAddToolsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTools} disabled={selectedTools.size === 0}>
                Add {selectedTools.size > 0 ? `${selectedTools.size} ` : ""}Tool{selectedTools.size !== 1 ? "s" : ""}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Schema Preview Sheet */}
        <Sheet open={previewSheetOpen} onOpenChange={setPreviewSheetOpen}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            {previewTool && (
              <>
                <SheetHeader>
                  <SheetTitle>{previewTool.name}</SheetTitle>
                  <SheetDescription>{previewTool.description}</SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Input Schema */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Input Schema</h3>
                    <div className="space-y-2">
                      {Object.entries(previewTool.inputSchema.properties).map(([key, prop]) => (
                        <div key={key} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{key}</code>
                            <Badge variant="outline" className="text-xs">
                              {prop.type}
                            </Badge>
                            {prop.required && (
                              <Badge variant="secondary" className="text-xs">
                                Required
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{prop.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Example Payload */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Example Request Payload</h3>
                    <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(previewTool.inputSchema.properties).map(([key, prop]) => [
                            key,
                            prop.type === "string" ? "example_value" : prop.type === "number" ? 123 : true,
                          ]),
                        ),
                        null,
                        2,
                      )}
                    </pre>
                  </div>

                  <Separator />

                  {/* Output Schema */}
                  <div>
                    <h3 className="font-semibold text-sm mb-3">Output Schema</h3>
                    <div className="space-y-2">
                      {Object.entries(previewTool.outputSchema.properties).map(([key, prop]) => (
                        <div key={key} className="p-3 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2 mb-1">
                            <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{key}</code>
                            <Badge variant="outline" className="text-xs">
                              {prop.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">{prop.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>

        {/* Sticky Save Footer */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-50">
            <div className="container mx-auto max-w-7xl px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                  <span className="text-sm font-medium">You have unsaved changes</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={() => setHasUnsavedChanges(false)}>
                    Discard
                  </Button>
                  <Button onClick={handleSaveChanges} disabled={isSaving}>
                    {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Save changes
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
