"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  MoreVertical,
  ExternalLink,
  TrendingUp,
  Square,
  Play,
  RotateCw,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  Activity,
  Zap,
  Clock,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type DeploymentStatus = "Provisioning" | "Running" | "Updating" | "Stopped" | "Failed"
type DeploymentSize = "Small" | "Medium" | "Large"
type Environment = "Production" | "Sandbox"

interface Deployment {
  id: string
  name: string
  environment: Environment
  status: DeploymentStatus
  size: DeploymentSize
  minTasks: number
  maxTasks: number
  endpoint: string
  created: Date
  costMtd: number
  metrics?: {
    rps: number
    p95Latency: number
    errors: number
    toolCalls: number
  }
  recentEvents?: Array<{
    id: string
    timestamp: Date
    event: string
    status: "success" | "error" | "info"
  }>
}

// Stub hook - replace with trpc.deployments.list.useQuery({ mcpId })
function useDeploymentsList(mcpId: string) {
  const [data] = useState<Deployment[]>([
    {
      id: "1",
      name: "finance-prod",
      environment: "Production",
      status: "Running",
      size: "Medium",
      minTasks: 2,
      maxTasks: 10,
      endpoint: "https://finance-prod.mcp.sierramcp.com",
      created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15),
      costMtd: 342.5,
      metrics: {
        rps: 45,
        p95Latency: 120,
        errors: 3,
        toolCalls: 12450,
      },
      recentEvents: [
        {
          id: "e1",
          timestamp: new Date(Date.now() - 1000 * 60 * 15),
          event: "Scaled to 4 tasks",
          status: "success",
        },
        {
          id: "e2",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
          event: "Health check passed",
          status: "success",
        },
        {
          id: "e3",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5),
          event: "Deployment updated to v2.1.0",
          status: "info",
        },
      ],
    },
    {
      id: "2",
      name: "finance-sandbox",
      environment: "Sandbox",
      status: "Running",
      size: "Small",
      minTasks: 1,
      maxTasks: 3,
      endpoint: "https://finance-sandbox.mcp.sierramcp.com",
      created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45),
      costMtd: 87.2,
      metrics: {
        rps: 8,
        p95Latency: 95,
        errors: 1,
        toolCalls: 1840,
      },
      recentEvents: [
        {
          id: "e4",
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 1),
          event: "Health check passed",
          status: "success",
        },
      ],
    },
    {
      id: "3",
      name: "finance-test",
      environment: "Sandbox",
      status: "Stopped",
      size: "Small",
      minTasks: 1,
      maxTasks: 2,
      endpoint: "https://finance-test.mcp.sierramcp.com",
      created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      costMtd: 0,
    },
  ])

  return {
    data,
    isLoading: false,
    error: null,
  }
}

// Stub hook for MCP info
function useMCP(mcpId: string) {
  return {
    data: { id: mcpId, name: "Finance Analytics" },
    isLoading: false,
  }
}

// Stub hook for MCP versions
function useMCPVersions(mcpId: string) {
  const [data] = useState([
    { version: "v2.1.0", published: new Date(Date.now() - 1000 * 60 * 60 * 3), status: "Latest" },
    { version: "v2.0.5", published: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7), status: "Stable" },
    { version: "v1.9.2", published: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), status: "Deprecated" },
  ])
  return { data }
}

export default function MCPDeploymentsPage({ params }: { params: { id: string } }) {
  const { id: mcpId } = params
  const router = useRouter()
  const { data: mcp } = useMCP(mcpId)
  const { data: deployments, isLoading } = useDeploymentsList(mcpId)
  const { data: versions } = useMCPVersions(mcpId)

  // Wizard state
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1)
  const [deploymentName, setDeploymentName] = useState("")
  const [deploymentEnv, setDeploymentEnv] = useState<Environment>("Production")
  const [departmentTag, setDepartmentTag] = useState("")
  const [selectedSize, setSelectedSize] = useState<DeploymentSize>("Medium")
  const [minTasks, setMinTasks] = useState(2)
  const [maxTasks, setMaxTasks] = useState(10)
  const [selectedVersion, setSelectedVersion] = useState("v2.1.0")
  const [isCreating, setIsCreating] = useState(false)

  // Detail drawer state
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)

  const handleCopyEndpoint = (endpoint: string, e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(endpoint)
    toast.success("Endpoint copied to clipboard")
  }

  const handleAction = (action: string, deployment: Deployment, e: React.MouseEvent) => {
    e.stopPropagation()

    switch (action) {
      case "open":
        window.open(deployment.endpoint, "_blank")
        break
      case "scale":
        toast.info("Scale dialog coming soon")
        break
      case "stop":
        toast.success("Deployment stopped")
        break
      case "start":
        toast.success("Deployment started")
        break
      case "redeploy":
        toast.success("Redeployment initiated")
        break
    }
  }

  const handleRowClick = (deployment: Deployment) => {
    setSelectedDeployment(deployment)
    setDetailDrawerOpen(true)
  }

  const handleCreateDeployment = async () => {
    setIsCreating(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000))
    setIsCreating(false)
    setCreateDialogOpen(false)
    resetWizard()
    toast.success("Deployment created successfully")
  }

  const resetWizard = () => {
    setWizardStep(1)
    setDeploymentName("")
    setDeploymentEnv("Production")
    setDepartmentTag("")
    setSelectedSize("Medium")
    setMinTasks(2)
    setMaxTasks(10)
    setSelectedVersion("v2.1.0")
  }

  const canContinueStep1 = deploymentName.trim() !== ""
  const canContinueStep2 = true
  const canContinueStep3 = selectedVersion !== ""

  const getStatusBadge = (status: DeploymentStatus) => {
    switch (status) {
      case "Running":
        return (
          <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Running
          </Badge>
        )
      case "Provisioning":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Provisioning
          </Badge>
        )
      case "Updating":
        return (
          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Updating
          </Badge>
        )
      case "Stopped":
        return (
          <Badge variant="outline" className="bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20">
            <Square className="h-3 w-3 mr-1" />
            Stopped
          </Badge>
        )
      case "Failed":
        return (
          <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        )
    }
  }

  const sizeProfiles = [
    {
      size: "Small" as DeploymentSize,
      description: "Perfect for development and testing",
      cpu: "0.5 vCPU",
      memory: "1 GB RAM",
      costPerHour: "$0.08",
    },
    {
      size: "Medium" as DeploymentSize,
      description: "Recommended for production workloads",
      cpu: "2 vCPU",
      memory: "4 GB RAM",
      costPerHour: "$0.32",
    },
    {
      size: "Large" as DeploymentSize,
      description: "High-performance for demanding applications",
      cpu: "4 vCPU",
      memory: "8 GB RAM",
      costPerHour: "$0.64",
    },
  ]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-48 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/mcps">MCPs</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/mcps/${mcpId}`}>{mcp?.name || "MCP"}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>Deployments</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Deployments</h1>
            <p className="text-muted-foreground mt-1">Manage MCP server deployments across environments</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create Deployment
          </Button>
        </div>

        {/* Deployments Table */}
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deployment Name</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Min/Max Tasks</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Cost MTD</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deployments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-muted-foreground">
                    No deployments yet. Create your first deployment to get started.
                  </TableCell>
                </TableRow>
              ) : (
                deployments?.map((deployment) => (
                  <TableRow key={deployment.id} className="cursor-pointer" onClick={() => handleRowClick(deployment)}>
                    <TableCell>
                      <div className="font-medium">{deployment.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          deployment.environment === "Production"
                            ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                            : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
                        }
                      >
                        {deployment.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(deployment.status)}</TableCell>
                    <TableCell>
                      <span className="text-sm">{deployment.size}</span>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {deployment.minTasks} - {deployment.maxTasks}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {deployment.endpoint}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={(e) => handleCopyEndpoint(deployment.endpoint, e)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDistanceToNow(deployment.created, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">${deployment.costMtd.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleAction("open", deployment, e)}>
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Open
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleAction("scale", deployment, e)}>
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Scale
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {deployment.status === "Running" ? (
                            <DropdownMenuItem onClick={(e) => handleAction("stop", deployment, e)}>
                              <Square className="h-4 w-4 mr-2" />
                              Stop
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => handleAction("start", deployment, e)}>
                              <Play className="h-4 w-4 mr-2" />
                              Start
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => handleAction("redeploy", deployment, e)}>
                            <RotateCw className="h-4 w-4 mr-2" />
                            Redeploy
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Create Deployment Wizard Dialog */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Deployment - Step {wizardStep} of 4</DialogTitle>
              <DialogDescription>
                {wizardStep === 1 && "Configure deployment name and environment"}
                {wizardStep === 2 && "Choose size profile and autoscaling settings"}
                {wizardStep === 3 && "Select MCP version to deploy"}
                {wizardStep === 4 && "Review and deploy"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Step 1: Name + Environment + Department */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="deployment-name">Deployment Name</Label>
                    <Input
                      id="deployment-name"
                      placeholder="e.g., finance-prod"
                      value={deploymentName}
                      onChange={(e) => setDeploymentName(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Choose a unique name for this deployment</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="environment">Environment</Label>
                    <Select value={deploymentEnv} onValueChange={(v) => setDeploymentEnv(v as Environment)}>
                      <SelectTrigger id="environment">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Production">Production</SelectItem>
                        <SelectItem value="Sandbox">Sandbox</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department Tag (optional)</Label>
                    <Input
                      id="department"
                      placeholder="e.g., Finance"
                      value={departmentTag}
                      onChange={(e) => setDepartmentTag(e.target.value)}
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Size Profile + Autoscaling */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    <Label>Size Profile</Label>
                    <div className="grid gap-3">
                      {sizeProfiles.map((profile) => (
                        <Card
                          key={profile.size}
                          className={`cursor-pointer transition-all ${
                            selectedSize === profile.size
                              ? "border-primary ring-2 ring-primary/20"
                              : "hover:border-primary/50"
                          }`}
                          onClick={() => setSelectedSize(profile.size)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{profile.size}</h4>
                                <p className="text-sm text-muted-foreground mb-2">{profile.description}</p>
                                <div className="flex gap-4 text-xs text-muted-foreground">
                                  <span>{profile.cpu}</span>
                                  <span>{profile.memory}</span>
                                  <span className="font-medium text-foreground">{profile.costPerHour}/hr</span>
                                </div>
                              </div>
                              {selectedSize === profile.size && <CheckCircle2 className="h-5 w-5 text-primary" />}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min-tasks">Minimum Tasks</Label>
                      <Input
                        id="min-tasks"
                        type="number"
                        min="1"
                        value={minTasks}
                        onChange={(e) => setMinTasks(Number.parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max-tasks">Maximum Tasks</Label>
                      <Input
                        id="max-tasks"
                        type="number"
                        min={minTasks}
                        value={maxTasks}
                        onChange={(e) => setMaxTasks(Number.parseInt(e.target.value) || minTasks)}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tasks will automatically scale between min and max based on demand
                  </p>
                </div>
              )}

              {/* Step 3: Version Selection */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="version">MCP Version</Label>
                    <Select value={selectedVersion} onValueChange={setSelectedVersion}>
                      <SelectTrigger id="version">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {versions.map((v) => (
                          <SelectItem key={v.version} value={v.version}>
                            <div className="flex items-center gap-2">
                              <span>{v.version}</span>
                              <Badge variant="secondary" className="text-xs">
                                {v.status}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <Card className="bg-muted/50">
                    <CardHeader>
                      <CardTitle className="text-sm">Configuration Validation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>12 tools configured</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>All required secrets set</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        <span>Configuration valid</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 4: Review */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Deployment Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Name:</span>
                        <span className="font-medium">{deploymentName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Environment:</span>
                        <Badge variant="outline">{deploymentEnv}</Badge>
                      </div>
                      {departmentTag && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Department:</span>
                          <Badge variant="secondary">{departmentTag}</Badge>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span className="font-medium">{selectedSize}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Autoscaling:</span>
                        <span className="font-medium">
                          {minTasks} - {maxTasks} tasks
                        </span>
                      </div>
                      <Separator />
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version:</span>
                        <span className="font-medium font-mono">{selectedVersion}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Estimated Cost:</span>
                        <span className="font-medium">
                          $
                          {(
                            Number.parseFloat(
                              sizeProfiles.find((p) => p.size === selectedSize)?.costPerHour.replace("$", "") || "0",
                            ) *
                            24 *
                            30
                          ).toFixed(2)}
                          /month
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      <strong>Note:</strong> Your deployment will be provisioned and ready in approximately 2-3 minutes.
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex justify-between w-full">
                <div>
                  {wizardStep > 1 && (
                    <Button variant="outline" onClick={() => setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}>
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  {wizardStep < 4 ? (
                    <Button
                      onClick={() => setWizardStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
                      disabled={
                        (wizardStep === 1 && !canContinueStep1) ||
                        (wizardStep === 2 && !canContinueStep2) ||
                        (wizardStep === 3 && !canContinueStep3)
                      }
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button onClick={handleCreateDeployment} disabled={isCreating}>
                      {isCreating ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Deploying...
                        </>
                      ) : (
                        "Deploy"
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Deployment Detail Drawer */}
        <Sheet open={detailDrawerOpen} onOpenChange={setDetailDrawerOpen}>
          <SheetContent className="sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>{selectedDeployment?.name}</SheetTitle>
              <SheetDescription>
                {selectedDeployment?.environment} • {selectedDeployment?.size} • Created{" "}
                {selectedDeployment && formatDistanceToNow(selectedDeployment.created, { addSuffix: true })}
              </SheetDescription>
            </SheetHeader>

            {selectedDeployment && (
              <div className="mt-6 space-y-6">
                {/* Metrics */}
                {selectedDeployment.metrics && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Metrics (Last 1 hour)</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Activity className="h-4 w-4 text-blue-600" />
                            <span className="text-xs text-muted-foreground">RPS</span>
                          </div>
                          <div className="text-2xl font-bold">{selectedDeployment.metrics.rps}</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Clock className="h-4 w-4 text-purple-600" />
                            <span className="text-xs text-muted-foreground">P95 Latency</span>
                          </div>
                          <div className="text-2xl font-bold">{selectedDeployment.metrics.p95Latency}ms</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-red-600" />
                            <span className="text-xs text-muted-foreground">Errors</span>
                          </div>
                          <div className="text-2xl font-bold">{selectedDeployment.metrics.errors}</div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Zap className="h-4 w-4 text-orange-600" />
                            <span className="text-xs text-muted-foreground">Tool Calls</span>
                          </div>
                          <div className="text-2xl font-bold">
                            {selectedDeployment.metrics.toolCalls.toLocaleString()}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {/* Recent Events */}
                {selectedDeployment.recentEvents && selectedDeployment.recentEvents.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3">Recent Events</h3>
                    <div className="space-y-3">
                      {selectedDeployment.recentEvents.map((event) => (
                        <div key={event.id} className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5">
                            {event.status === "success" && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                            {event.status === "error" && <AlertCircle className="h-4 w-4 text-red-600" />}
                            {event.status === "info" && <Activity className="h-4 w-4 text-blue-600" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{event.event}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Configuration */}
                <div>
                  <h3 className="text-sm font-medium mb-3">Configuration</h3>
                  <Card>
                    <CardContent className="p-4 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Status:</span>
                        {getStatusBadge(selectedDeployment.status)}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Size:</span>
                        <span className="font-medium">{selectedDeployment.size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Tasks:</span>
                        <span className="font-medium">
                          {selectedDeployment.minTasks} - {selectedDeployment.maxTasks}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cost MTD:</span>
                        <span className="font-medium">${selectedDeployment.costMtd.toFixed(2)}</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Endpoint:</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => handleCopyEndpoint(selectedDeployment.endpoint, {} as React.MouseEvent)}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <code className="text-xs bg-muted p-2 rounded block break-all">
                        {selectedDeployment.endpoint}
                      </code>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  )
}
