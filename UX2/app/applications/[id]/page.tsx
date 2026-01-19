"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronRight,
  Settings,
  PowerOff,
  Power,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Wrench,
  Server,
  Upload,
  TestTube,
  AlertCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
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

type ApplicationStatus = "Draft" | "Configuring" | "Active" | "Disabled" | "Error"
type Environment = "PRODUCTION" | "SANDBOX" | "DEVELOPMENT"
type AuthType = "NONE" | "API_KEY" | "OAUTH2" | "BASIC" | "BEARER" | "CUSTOM_HEADER" | "MTLS"
type TestStatus = "NOT_TESTED" | "SUCCESS" | "FAILED"

interface EnvironmentConfig {
  environment: Environment
  baseUrl: string
  authType: AuthType
  credentialsSet: boolean
  lastTestStatus?: TestStatus
  lastTestedAt?: string
}

interface DocumentsSummary {
  total: number
  completed: number
  processing: number
  failed: number
}

interface Application {
  id: string
  name: string
  description?: string
  status: ApplicationStatus
  updatedAt: string
  type: "template" | "custom"
  logoUrl?: string
  environments: EnvironmentConfig[]
  documentsSummary: DocumentsSummary
  toolsCount: number
}

interface ActivityEvent {
  id: string
  type: "document" | "tool" | "environment" | "test"
  title: string
  timestamp: string
}

// Stub hook - replace with trpc.applications.get.useQuery({ id })
function useApplication(id: string) {
  const [data] = useState<Application>({
    id,
    name: "Customer Support Bot",
    description: "AI-powered customer support with knowledge base integration",
    status: "Configuring",
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    type: "template",
    logoUrl: "/customer-support-bot-icon.jpg",
    environments: [
      {
        environment: "PRODUCTION",
        baseUrl: "https://api.example.com/v1",
        authType: "API_KEY",
        credentialsSet: false,
        lastTestStatus: "NOT_TESTED",
      },
    ],
    documentsSummary: {
      total: 0,
      completed: 0,
      processing: 0,
      failed: 0,
    },
    toolsCount: 0,
  })

  return {
    data,
    isLoading: false,
    error: null,
  }
}

// Stub hook - replace with trpc.applications.activity.useQuery({ id })
function useApplicationActivity(id: string) {
  const [data] = useState<ActivityEvent[]>([
    {
      id: "1",
      type: "environment",
      title: "Production environment created",
      timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    },
    {
      id: "2",
      type: "document",
      title: "API documentation uploaded",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    },
    {
      id: "3",
      type: "tool",
      title: "Search tool published",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: "4",
      type: "test",
      title: "Connection test succeeded",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    },
    {
      id: "5",
      type: "environment",
      title: "Sandbox environment configured",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ])

  return {
    data,
    isLoading: false,
    error: null,
  }
}

export default function ApplicationOverviewPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const { data: application, isLoading, error } = useApplication(params.id)
  const { data: activity } = useApplicationActivity(params.id)

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-64 bg-muted rounded" />
            <div className="h-10 w-96 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Application Not Found</h3>
              <p className="text-muted-foreground mb-4">
                The application you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => router.push("/applications")}>Back to Applications</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Calculate readiness
  const hasEnvironments = application.environments.length > 0
  const hasCredentials = application.environments.some((env) => env.credentialsSet)
  const hasDocs = application.documentsSummary.total > 0
  const hasTools = application.toolsCount > 0

  const readinessSteps = [
    { id: "env", completed: hasEnvironments, label: "Environments configured" },
    { id: "creds", completed: hasCredentials, label: "Credentials stored" },
    { id: "docs", completed: hasDocs, label: "Documentation ingested" },
    { id: "tools", completed: hasTools, label: "Tools created" },
  ]

  const readinessCount = readinessSteps.filter((s) => s.completed).length
  const readinessPercentage = (readinessCount / 4) * 100

  // Determine next step action
  let nextStepLabel = "Get Started"
  let nextStepHref = `/applications/${params.id}/environments`

  if (!hasEnvironments) {
    nextStepLabel = "Add Environments"
    nextStepHref = `/applications/${params.id}/environments`
  } else if (!hasCredentials) {
    nextStepLabel = "Set Credentials"
    nextStepHref = `/applications/${params.id}/environments`
  } else if (!hasDocs) {
    nextStepLabel = "Add Docs"
    nextStepHref = `/applications/${params.id}/documents`
  } else {
    nextStepLabel = "Create Tool"
    nextStepHref = `/applications/${params.id}/tools/new`
  }

  const getStatusBadgeVariant = (status: ApplicationStatus) => {
    switch (status) {
      case "Active":
        return "default"
      case "Draft":
        return "secondary"
      case "Configuring":
        return "outline"
      case "Disabled":
        return "outline"
      case "Error":
        return "destructive"
    }
  }

  const getTestStatusIcon = (status?: TestStatus) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "FAILED":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActivityIcon = (type: ActivityEvent["type"]) => {
    switch (type) {
      case "document":
        return <Upload className="h-4 w-4 text-blue-600" />
      case "tool":
        return <Wrench className="h-4 w-4 text-purple-600" />
      case "environment":
        return <Server className="h-4 w-4 text-green-600" />
      case "test":
        return <TestTube className="h-4 w-4 text-orange-600" />
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumbs */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/applications">Applications</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage>{application.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-1">{application.name}</h1>
            <p className="text-muted-foreground">
              {application.description || "Connected system configuration and readiness"}
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Badge
                variant={getStatusBadgeVariant(application.status)}
                className={
                  application.status === "Active"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                    : ""
                }
              >
                {application.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => router.push(`/applications/${params.id}/edit`)}>
              <Settings className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {application.status === "Disabled" ? (
              <Button variant="outline" onClick={() => toast.success("Application enabled")}>
                <Power className="h-4 w-4 mr-2" />
                Enable
              </Button>
            ) : (
              <Button variant="outline" onClick={() => toast.success("Application disabled")}>
                <PowerOff className="h-4 w-4 mr-2" />
                Disable
              </Button>
            )}
            <Button onClick={() => router.push(nextStepHref)}>
              {nextStepLabel}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <Tabs defaultValue="overview" className="mb-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="environments" onClick={() => router.push(`/applications/${params.id}/environments`)}>
              Environments
            </TabsTrigger>
            <TabsTrigger value="documents" onClick={() => router.push(`/applications/${params.id}/documents`)}>
              Documents
            </TabsTrigger>
            <TabsTrigger value="tools" onClick={() => router.push(`/applications/${params.id}/tools`)}>
              Tools
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Main Column */}
              <div className="space-y-6 lg:col-span-2">
                {/* Readiness Checklist */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Setup Checklist</CardTitle>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">{readinessCount}/4 Complete</span>
                        <div className="w-16">
                          <Progress value={readinessPercentage} />
                        </div>
                      </div>
                    </div>
                    <CardDescription>Complete these steps to deploy your application</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Step 1: Environments */}
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">
                        {hasEnvironments ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium mb-1">Environments configured</div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {hasEnvironments
                            ? `${application.environments.length} environment${application.environments.length !== 1 ? "s" : ""} configured`
                            : "No environments configured"}
                        </div>
                        <Link href={`/applications/${params.id}/environments`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Manage
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 2: Credentials */}
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">
                        {hasCredentials ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium mb-1">Credentials stored</div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {hasCredentials ? (
                            "Credentials configured"
                          ) : application.environments.length > 0 ? (
                            <span className="text-orange-600 dark:text-orange-400">
                              Missing for {application.environments[0].environment}
                            </span>
                          ) : (
                            "No credentials set"
                          )}
                        </div>
                        <Link href={`/applications/${params.id}/environments`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Set credentials
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 3: Documentation */}
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">
                        {hasDocs ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium mb-1">Documentation ingested</div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {hasDocs ? (
                            <>
                              {application.documentsSummary.completed} completed
                              {application.documentsSummary.processing > 0 &&
                                `, ${application.documentsSummary.processing} processing`}
                            </>
                          ) : (
                            "0 docs"
                          )}
                        </div>
                        <Link href={`/applications/${params.id}/documents`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Add docs
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    <Separator />

                    {/* Step 4: Tools */}
                    <div className="flex items-start gap-4">
                      <div className="mt-0.5">
                        {hasTools ? (
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium mb-1">Tools created</div>
                        <div className="text-sm text-muted-foreground mb-2">
                          {hasTools
                            ? `${application.toolsCount} tool${application.toolsCount !== 1 ? "s" : ""}`
                            : "0 tools"}
                        </div>
                        <Link href={`/applications/${params.id}/tools/new`}>
                          <Button variant="link" size="sm" className="h-auto p-0">
                            Create tool
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </Link>
                      </div>
                    </div>

                    {readinessCount === 4 && (
                      <>
                        <Separator />
                        <div className="rounded-lg bg-green-500/10 border border-green-500/20 p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                            <span className="font-semibold text-green-900 dark:text-green-100">Ready to deploy</span>
                          </div>
                          <p className="text-sm text-green-800 dark:text-green-200">Deployments coming soon</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4 bg-transparent"
                        onClick={() => router.push(`/applications/${params.id}/environments`)}
                      >
                        <Server className="h-5 w-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">Manage Environments</div>
                          <div className="text-xs text-muted-foreground">Configure connections</div>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4 bg-transparent"
                        onClick={() => router.push(`/applications/${params.id}/documents`)}
                      >
                        <FileText className="h-5 w-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">Manage Documents</div>
                          <div className="text-xs text-muted-foreground">Upload documentation</div>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4 bg-transparent"
                        onClick={() => router.push(`/applications/${params.id}/tools`)}
                      >
                        <Wrench className="h-5 w-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">View Tools</div>
                          <div className="text-xs text-muted-foreground">See all tools</div>
                        </div>
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start h-auto py-4 bg-transparent"
                        onClick={() => router.push(`/applications/${params.id}/tools/new`)}
                      >
                        <Wrench className="h-5 w-5 mr-3" />
                        <div className="text-left">
                          <div className="font-medium">Create Tool</div>
                          <div className="text-xs text-muted-foreground">Build new tool</div>
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Activity</CardTitle>
                    <CardDescription>Latest updates and changes</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {activity && activity.length > 0 ? (
                      <div className="space-y-4">
                        {activity.map((event) => (
                          <div key={event.id} className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-muted p-1.5">{getActivityIcon(event.type)}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{event.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-blue-500/10 p-2">
                          <Server className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{application.environments.length}</div>
                          <div className="text-xs text-muted-foreground">
                            Environment{application.environments.length !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-purple-500/10 p-2">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{application.documentsSummary.total}</div>
                          <div className="text-xs text-muted-foreground">
                            Document{application.documentsSummary.total !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-green-500/10 p-2">
                          <Wrench className="h-5 w-5 text-green-600" />
                        </div>
                        <div>
                          <div className="text-2xl font-bold">{application.toolsCount}</div>
                          <div className="text-xs text-muted-foreground">
                            Tool{application.toolsCount !== 1 ? "s" : ""}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-lg bg-orange-500/10 p-2">
                          <Clock className="h-5 w-5 text-orange-600" />
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-0.5">Last updated</div>
                          <div className="text-sm font-medium">
                            {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Environment Summary */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Environments</CardTitle>
                      <Link href={`/applications/${params.id}/environments`}>
                        <Button variant="link" size="sm" className="h-auto p-0">
                          Manage
                        </Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {application.environments.length > 0 ? (
                      <div className="space-y-4">
                        {application.environments.map((env) => (
                          <div key={env.environment} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-medium text-sm">{env.environment}</span>
                              {getTestStatusIcon(env.lastTestStatus)}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{env.baseUrl}</div>
                            <div className="flex gap-2">
                              <Badge
                                variant={env.lastTestStatus === "SUCCESS" ? "default" : "outline"}
                                className={
                                  env.lastTestStatus === "SUCCESS"
                                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 text-xs"
                                    : "text-xs"
                                }
                              >
                                {env.lastTestStatus === "SUCCESS"
                                  ? "Connected"
                                  : env.lastTestStatus === "FAILED"
                                    ? "Failed"
                                    : "Not tested"}
                              </Badge>
                              <Badge variant={env.credentialsSet ? "secondary" : "outline"} className="text-xs">
                                {env.credentialsSet ? "Credentials set" : "Missing credentials"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-sm text-muted-foreground">No environments configured</p>
                        <Link href={`/applications/${params.id}/environments`}>
                          <Button variant="link" size="sm" className="mt-2">
                            Add environment
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
