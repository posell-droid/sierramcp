"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Upload, Rocket, Settings, ArrowRight, MessageSquare, Zap, Server, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface MCP {
  id: string
  name: string
  description: string
  toolsCount: number
  activeDeployments: number
  monthlyToolCalls: number
  latestVersion: string
  lastUpdated: Date
  tags: string[]
}

// Stub hook - replace with trpc.mcps.get.useQuery({ id })
function useMCP(id: string) {
  const [data] = useState<MCP>({
    id,
    name: "Finance Analytics",
    description: "Real-time financial reporting, budget tracking, and revenue forecasting tools for finance teams",
    toolsCount: 12,
    activeDeployments: 3,
    monthlyToolCalls: 45289,
    latestVersion: "v2.1.0",
    lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 3), // 3 hours ago
    tags: ["Finance", "Prod"],
  })

  return {
    data,
    isLoading: false,
    error: null,
  }
}

export default function MCPDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const { data: mcp, isLoading } = useMCP(id)

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

  if (!mcp) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <h3 className="text-lg font-semibold mb-2">MCP Not Found</h3>
              <p className="text-muted-foreground mb-4">The MCP you're looking for doesn't exist.</p>
              <Button onClick={() => router.push("/mcps")}>Back to MCPs</Button>
            </CardContent>
          </Card>
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
              <BreadcrumbPage>{mcp.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-2">{mcp.name}</h1>
            <p className="text-muted-foreground mb-3">{mcp.description}</p>
            <div className="flex items-center gap-2 flex-wrap">
              {mcp.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant={tag === "Prod" ? "default" : "secondary"}
                  className={
                    tag === "Prod"
                      ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                      : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                  }
                >
                  {tag}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(mcp.lastUpdated, { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                toast.success("New version created", {
                  description: "You can now edit the new draft version",
                })
              }}
            >
              <Upload className="h-4 w-4 mr-2" />
              Publish new version
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Deployment flow coming soon")
              }}
            >
              <Rocket className="h-4 w-4 mr-2" />
              Deploy
            </Button>
            <Button variant="outline" onClick={() => router.push(`/mcps/${id}/settings`)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="overview" className="mb-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tools" onClick={() => router.push(`/mcps/${id}/tools`)}>
              Tools
            </TabsTrigger>
            <TabsTrigger value="config" onClick={() => router.push(`/mcps/${id}/config`)}>
              Config & Secrets
            </TabsTrigger>
            <TabsTrigger value="deployments" onClick={() => router.push(`/mcps/${id}/deployments`)}>
              Deployments
            </TabsTrigger>
            <TabsTrigger value="routes" onClick={() => router.push(`/mcps/${id}/routes`)}>
              Routes
            </TabsTrigger>
            <TabsTrigger value="audit" onClick={() => router.push(`/mcps/${id}/audit`)}>
              Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6 space-y-6">
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tools</CardTitle>
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mcp.toolsCount}</div>
                  <p className="text-xs text-muted-foreground mt-1">Published tools in this MCP</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
                  <Server className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mcp.activeDeployments}</div>
                  <p className="text-xs text-muted-foreground mt-1">Running across environments</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Monthly Tool Calls</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{mcp.monthlyToolCalls.toLocaleString()}</div>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">+12.5% from last month</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Latest Version</CardTitle>
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">{mcp.latestVersion}</div>
                  <p className="text-xs text-muted-foreground mt-1">Published 3 hours ago</p>
                </CardContent>
              </Card>
            </div>

            {/* How it works section */}
            <Card>
              <CardHeader>
                <CardTitle>How it works</CardTitle>
                <CardDescription>
                  Your MCP server receives requests from chat clients and routes them to the appropriate tools
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
                  {/* Step 1: Chat Clients */}
                  <div className="flex-1 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mb-3">
                      <MessageSquare className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-semibold mb-1">Slack / Teams</h3>
                    <p className="text-sm text-muted-foreground">Users interact through chat interfaces</p>
                  </div>

                  {/* Arrow */}
                  <div className="hidden md:block">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Step 2: Chat Gateway */}
                  <div className="flex-1 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-3">
                      <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-semibold mb-1">Chat Gateway</h3>
                    <p className="text-sm text-muted-foreground">Routes messages to MCP servers</p>
                  </div>

                  {/* Arrow */}
                  <div className="hidden md:block">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Step 3: Deployment */}
                  <div className="flex-1 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                      <Server className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-semibold mb-1">MCP Deployment</h3>
                    <p className="text-sm text-muted-foreground">Your deployed {mcp.name} server</p>
                  </div>

                  {/* Arrow */}
                  <div className="hidden md:block">
                    <ArrowRight className="h-6 w-6 text-muted-foreground" />
                  </div>

                  {/* Step 4: Tools */}
                  <div className="flex-1 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center mb-3">
                      <Wrench className="h-8 w-8 text-orange-600 dark:text-orange-400" />
                    </div>
                    <h3 className="font-semibold mb-1">Tools API</h3>
                    <p className="text-sm text-muted-foreground">{mcp.toolsCount} tools execute actions</p>
                  </div>
                </div>

                <div className="mt-6 p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Note:</strong> Each deployment runs independently with its own
                    configuration, allowing you to maintain separate environments for development, staging, and
                    production.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
