"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { trpc } from "@/lib/trpc"
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
  Loader2,
  Boxes,
  Plus,
  MoreVertical,
  Link2,
  Play,
  Trash2,
  Globe,
  CheckCircle,
  Key,
  Shield,
  RefreshCw,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type ApplicationStatus = "DRAFT" | "CONFIGURING" | "ACTIVE" | "DISABLED" | "ERROR"
type EnvironmentType = "PRODUCTION" | "SANDBOX" | "DEVELOPMENT"
type AuthType = "API_KEY" | "OAUTH2" | "BASIC" | "BEARER" | "CUSTOM_HEADER" | "MTLS" | "NONE"
type DocumentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"
type ToolStatus = "DRAFT" | "TESTED" | "PUBLISHED" | "DEPRECATED"

interface AppEnvironment {
  id: string
  environment: EnvironmentType
  baseUrl: string
  authType: AuthType
  secretArn: string | null
  lastTestedAt: Date | null
  lastTestStatus: string | null
}

interface AppDocument {
  id: string
  title: string | null
  fileName: string | null
  sourceUrl: string | null
  sourceType: string
  status: DocumentStatus
  errorMessage: string | null
  totalChunks: number | null
  processedChunks: number | null
  _count: { chunks: number }
}

interface AppTool {
  id: string
  name: string
  title: string
  description: string
  status: ToolStatus
  httpMethod: string
  pathTemplate: string
  _count: { executions: number; testResults: number }
}

const authTypeLabels: Record<AuthType, string> = {
  API_KEY: "API Key",
  OAUTH2: "OAuth 2.0",
  BASIC: "Basic Auth",
  BEARER: "Bearer Token",
  CUSTOM_HEADER: "Custom Header",
  MTLS: "mTLS",
  NONE: "None",
}

const envLabels: Record<EnvironmentType, string> = {
  PRODUCTION: "Production",
  SANDBOX: "Sandbox",
  DEVELOPMENT: "Development",
}

export default function ApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const applicationId = params.id as string

  const [activeTab, setActiveTab] = useState("overview")
  const [isAddEnvDialogOpen, setIsAddEnvDialogOpen] = useState(false)
  const [isAddDocDialogOpen, setIsAddDocDialogOpen] = useState(false)
  // Tool dialog removed - now using route-based screen at /tools/new
  const [isCredentialsDialogOpen, setIsCredentialsDialogOpen] = useState(false)
  const [selectedEnvForCredentials, setSelectedEnvForCredentials] = useState<AppEnvironment | null>(null)
  const [isDeleteDocDialogOpen, setIsDeleteDocDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<AppDocument | null>(null)

  // Environment form
  const [envForm, setEnvForm] = useState({
    environment: "" as EnvironmentType | "",
    baseUrl: "",
    authType: "" as AuthType | "",
  })

  // Credentials form
  const [credentialsForm, setCredentialsForm] = useState({
    apiKey: "",
    apiKeyHeader: "X-API-Key",
    username: "",
    password: "",
    bearerToken: "",
    clientId: "",
    clientSecret: "",
    tokenUrl: "",
    customHeaderName: "",
    customHeaderValue: "",
  })

  // Document form
  const [docForm, setDocForm] = useState({
    sourceType: "url" as "url" | "text",
    sourceUrl: "",
    title: "",
    content: "",
  })

  // Tool form - no longer needed, using route-based /tools/new page

  const { data: application, isLoading, refetch } = trpc.applications.get.useQuery({ id: applicationId })
  const { data: documentsData, refetch: refetchDocs } = trpc.documents.list.useQuery(
    { applicationId },
    {
      // Auto-refresh every 3 seconds while any document is pending or processing
      refetchInterval: (query) => {
        const docs = query.state.data?.items || []
        const hasProcessing = docs.some(
          (doc: { status: string }) => doc.status === "PENDING" || doc.status === "PROCESSING"
        )
        return hasProcessing ? 3000 : false
      },
    }
  )
  const { data: toolsData, refetch: refetchTools } = trpc.tools.list.useQuery({ applicationId })

  const activateApplication = trpc.applications.activate.useMutation({
    onSuccess: () => {
      refetch()
      toast.success("Application enabled")
    },
  })

  const disableApplication = trpc.applications.disable.useMutation({
    onSuccess: () => {
      refetch()
      toast.success("Application disabled")
    },
  })

  const addEnvironment = trpc.applications.addEnvironment.useMutation({
    onSuccess: () => {
      refetch()
      setIsAddEnvDialogOpen(false)
      setEnvForm({ environment: "", baseUrl: "", authType: "" })
      toast.success("Environment added")
    },
  })

  const testConnection = trpc.applications.testConnection.useMutation({
    onSuccess: (data) => {
      refetch()
      toast.success(data.success ? "Connection successful" : "Connection failed")
    },
  })

  const deleteEnvironment = trpc.applications.deleteEnvironment.useMutation({
    onSuccess: () => {
      refetch()
      toast.success("Environment deleted")
    },
  })

  const setCredentials = trpc.applications.setCredentials.useMutation({
    onSuccess: () => {
      refetch()
      setIsCredentialsDialogOpen(false)
      setSelectedEnvForCredentials(null)
      resetCredentialsForm()
      toast.success("Credentials saved securely")
    },
    onError: (error) => {
      toast.error("Failed to save credentials", {
        description: error.message,
      })
    },
  })

  const addDocument = trpc.documents.addUrl.useMutation({
    onSuccess: () => {
      refetchDocs()
      refetch() // Update tab count
      setIsAddDocDialogOpen(false)
      setDocForm({ sourceType: "url", sourceUrl: "", title: "", content: "" })
      toast.success("Document added")
    },
    onError: (error) => {
      toast.error("Failed to add document", {
        description: error.message,
      })
    },
  })

  const addTextDocument = trpc.documents.addText.useMutation({
    onSuccess: () => {
      refetchDocs()
      refetch() // Update tab count
      setIsAddDocDialogOpen(false)
      setDocForm({ sourceType: "url", sourceUrl: "", title: "", content: "" })
      toast.success("Document added")
    },
    onError: (error) => {
      toast.error("Failed to add document", {
        description: error.message,
      })
    },
  })

  const deleteDocument = trpc.documents.delete.useMutation({
    onSuccess: () => {
      refetchDocs()
      refetch() // Update tab count
      setIsDeleteDocDialogOpen(false)
      setDocumentToDelete(null)
      toast.success("Document and embeddings deleted")
    },
    onError: (error) => {
      toast.error("Failed to delete document", {
        description: error.message,
      })
    },
  })

  const reprocessDocument = trpc.documents.reprocess.useMutation({
    onSuccess: () => {
      refetchDocs()
      toast.success("Document queued for reprocessing")
    },
    onError: (error) => {
      toast.error("Failed to reprocess document", {
        description: error.message,
      })
    },
  })

  // createTool mutation - no longer needed, using route-based /tools/new page

  const deleteTool = trpc.tools.delete.useMutation({
    onSuccess: () => {
      refetchTools()
      toast.success("Tool deleted")
    },
  })

  const publishTool = trpc.tools.publish.useMutation({
    onSuccess: () => {
      refetchTools()
      toast.success("Tool published")
    },
  })

  const handleAddEnvironment = () => {
    if (!envForm.environment || !envForm.baseUrl || !envForm.authType) return
    addEnvironment.mutate({
      applicationId,
      environment: envForm.environment as EnvironmentType,
      baseUrl: envForm.baseUrl,
      authType: envForm.authType as AuthType,
    })
  }

  const resetCredentialsForm = () => {
    setCredentialsForm({
      apiKey: "",
      apiKeyHeader: "X-API-Key",
      username: "",
      password: "",
      bearerToken: "",
      clientId: "",
      clientSecret: "",
      tokenUrl: "",
      customHeaderName: "",
      customHeaderValue: "",
    })
  }

  const openCredentialsDialog = (env: AppEnvironment) => {
    setSelectedEnvForCredentials(env)
    resetCredentialsForm()
    setIsCredentialsDialogOpen(true)
  }

  const handleSetCredentials = () => {
    if (!selectedEnvForCredentials) return
    setCredentials.mutate({
      environmentId: selectedEnvForCredentials.id,
      credentials: credentialsForm,
    })
  }

  const handleAddDocument = () => {
    if (docForm.sourceType === "url") {
      if (!docForm.sourceUrl) return
      addDocument.mutate({
        applicationId,
        sourceUrl: docForm.sourceUrl,
        title: docForm.title || undefined,
      })
    } else {
      if (!docForm.title || !docForm.content) return
      addTextDocument.mutate({
        applicationId,
        title: docForm.title,
        content: docForm.content,
      })
    }
  }

  // handleAddTool - no longer needed, using route-based /tools/new page

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!application) {
    return (
      <div className="container mx-auto">
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
    )
  }

  const documents = (documentsData?.items || []) as AppDocument[]
  const tools = toolsData?.items || []
  const existingEnvTypes = application.environments.map((e: AppEnvironment) => e.environment)

  // Calculate readiness
  const hasEnvironments = application.environments.length > 0
  const hasCredentials = application.environments.some((env: AppEnvironment) => env.secretArn)
  const hasDocs = application._count.documents > 0
  const hasTools = application._count.tools > 0

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

  if (!hasEnvironments) {
    nextStepLabel = "Add Environment"
  } else if (!hasCredentials) {
    nextStepLabel = "Set Credentials"
  } else if (!hasDocs) {
    nextStepLabel = "Add Docs"
  } else if (!hasTools) {
    nextStepLabel = "Create Tool"
  } else {
    nextStepLabel = "View Tools"
  }

  const handleNextStep = () => {
    if (!hasEnvironments) {
      setActiveTab("environments")
      setIsAddEnvDialogOpen(true)
    } else if (!hasCredentials) {
      // Go to environments tab where credentials can be set
      setActiveTab("environments")
    } else if (!hasDocs) {
      setActiveTab("documents")
      setIsAddDocDialogOpen(true)
    } else if (!hasTools) {
      router.push(`/applications/${applicationId}/tools/new`)
    } else {
      setActiveTab("tools")
    }
  }

  const getStatusBadgeVariant = (status: ApplicationStatus) => {
    switch (status) {
      case "ACTIVE":
        return "default"
      case "DRAFT":
        return "secondary"
      case "CONFIGURING":
        return "outline"
      case "DISABLED":
        return "outline"
      case "ERROR":
        return "destructive"
    }
  }

  const formatStatus = (status: ApplicationStatus) => {
    return status.charAt(0) + status.slice(1).toLowerCase()
  }

  const getDocStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case "COMPLETED":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "FAILED":
        return <XCircle className="h-4 w-4 text-destructive" />
      case "PROCESSING":
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getDocStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case "COMPLETED":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            Completed
          </Badge>
        )
      case "FAILED":
        return (
          <Badge variant="destructive">
            Failed
          </Badge>
        )
      case "PROCESSING":
        return (
          <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processing
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  const getToolStatusBadge = (status: ToolStatus) => {
    const variants: Record<ToolStatus, "default" | "secondary" | "outline" | "destructive"> = {
      PUBLISHED: "default",
      TESTED: "secondary",
      DRAFT: "outline",
      DEPRECATED: "destructive",
    }
    const classes: Record<ToolStatus, string> = {
      PUBLISHED: "bg-green-500/10 text-green-700 border-green-500/20",
      TESTED: "bg-blue-500/10 text-blue-700 border-blue-500/20",
      DRAFT: "",
      DEPRECATED: "",
    }
    return (
      <Badge variant={variants[status]} className={classes[status]}>
        {status.toLowerCase()}
      </Badge>
    )
  }

  const getTestStatusIcon = (status: string | null) => {
    switch (status) {
      case "SUCCESS":
        return <CheckCircle2 className="h-4 w-4 text-green-600" />
      case "FAILED":
        return <XCircle className="h-4 w-4 text-destructive" />
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="container mx-auto">
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
          <div className="flex items-start gap-4">
            {(application.logoUrl || application.template?.logoUrl) ? (
              <img
                src={application.logoUrl || application.template?.logoUrl || ""}
                alt={application.name}
                width={48}
                height={48}
                className="rounded-lg object-cover"
              />
            ) : (
              <div className="rounded-lg bg-primary/10 p-3">
                <Boxes className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-1">{application.name}</h1>
              <p className="text-muted-foreground">
                {application.description || "Connected system configuration and readiness"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3 ml-16">
            <Badge
              variant={getStatusBadgeVariant(application.status)}
              className={
                application.status === "ACTIVE"
                  ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                  : ""
              }
            >
              {formatStatus(application.status)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              Updated {formatDistanceToNow(new Date(application.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push(`/applications/${applicationId}/edit`)}>
            <Settings className="h-4 w-4 mr-2" />
            Edit
          </Button>
          {application.status === "DISABLED" ? (
            <Button
              variant="outline"
              onClick={() => activateApplication.mutate({ id: applicationId })}
              disabled={activateApplication.isPending}
            >
              <Power className="h-4 w-4 mr-2" />
              Enable
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => disableApplication.mutate({ id: applicationId })}
              disabled={disableApplication.isPending}
            >
              <PowerOff className="h-4 w-4 mr-2" />
              Disable
            </Button>
          )}
          <Button onClick={handleNextStep}>
            {nextStepLabel}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="environments">
            Environments ({application.environments.length})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({application._count.documents})
          </TabsTrigger>
          <TabsTrigger value="tools">
            Tools ({application._count.tools})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
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
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setActiveTab("environments")}
                      >
                        Manage
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
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
                            Missing for {envLabels[application.environments[0].environment as EnvironmentType]}
                          </span>
                        ) : (
                          "No credentials set"
                        )}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setActiveTab("environments")}
                      >
                        Set credentials
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
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
                        {hasDocs ? `${application._count.documents} document${application._count.documents !== 1 ? "s" : ""}` : "0 docs"}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => setActiveTab("documents")}
                      >
                        Add docs
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
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
                        {hasTools ? `${application._count.tools} tool${application._count.tools !== 1 ? "s" : ""}` : "0 tools"}
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto p-0"
                        onClick={() => router.push(`/applications/${applicationId}/tools/new`)}
                      >
                        Create tool
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
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
                      onClick={() => setActiveTab("environments")}
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
                      onClick={() => setActiveTab("documents")}
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
                      onClick={() => setActiveTab("tools")}
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
                      onClick={() => router.push(`/applications/${applicationId}/tools/new`)}
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
                        <div className="text-2xl font-bold">{application._count.documents}</div>
                        <div className="text-xs text-muted-foreground">
                          Document{application._count.documents !== 1 ? "s" : ""}
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
                        <div className="text-2xl font-bold">{application._count.tools}</div>
                        <div className="text-xs text-muted-foreground">
                          Tool{application._count.tools !== 1 ? "s" : ""}
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
                    <Button
                      variant="link"
                      size="sm"
                      className="h-auto p-0"
                      onClick={() => setActiveTab("environments")}
                    >
                      Manage
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {application.environments.length > 0 ? (
                    <div className="space-y-4">
                      {application.environments.map((env: AppEnvironment) => (
                        <div key={env.id} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{envLabels[env.environment]}</span>
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
                            <Badge variant={env.secretArn ? "secondary" : "outline"} className="text-xs">
                              {env.secretArn ? "Credentials set" : "Missing credentials"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertTriangle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No environments configured</p>
                      <Button
                        variant="link"
                        size="sm"
                        className="mt-2"
                        onClick={() => {
                          setActiveTab("environments")
                          setIsAddEnvDialogOpen(true)
                        }}
                      >
                        Add environment
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Environments Tab */}
        <TabsContent value="environments" className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Environments</h2>
              <p className="text-sm text-muted-foreground">Configure API endpoints for different environments</p>
            </div>
            <Button onClick={() => setIsAddEnvDialogOpen(true)} disabled={existingEnvTypes.length >= 3}>
              <Plus className="h-4 w-4 mr-2" />
              Add Environment
            </Button>
          </div>

          {application.environments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Globe className="h-8 w-8 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No environments configured</h3>
                <p className="text-sm text-muted-foreground mb-4">Add at least one environment to start using this application</p>
                <Button onClick={() => setIsAddEnvDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Environment
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {application.environments.map((env: AppEnvironment) => (
                <Card key={env.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={env.environment === "PRODUCTION" ? "default" : "secondary"}>
                          {envLabels[env.environment]}
                        </Badge>
                        <span className="text-sm text-muted-foreground">{authTypeLabels[env.authType]}</span>
                        {env.secretArn ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                            <Shield className="h-3 w-3 mr-1" />
                            Credentials set
                          </Badge>
                        ) : env.authType !== "NONE" ? (
                          <Badge variant="outline" className="text-orange-600 dark:text-orange-400 border-orange-500/30">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Missing credentials
                          </Badge>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {env.authType !== "NONE" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openCredentialsDialog(env)}
                          >
                            <Key className="h-4 w-4" />
                            <span className="ml-2">{env.secretArn ? "Update" : "Set"} Credentials</span>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testConnection.mutate({ environmentId: env.id })}
                          disabled={testConnection.isPending}
                        >
                          {testConnection.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                          <span className="ml-2">Test</span>
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => deleteEnvironment.mutate({ id: env.id })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                      <code className="bg-muted px-2 py-1 rounded text-xs">{env.baseUrl}</code>
                    </div>
                    {env.lastTestedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last tested: {new Date(env.lastTestedAt).toLocaleString()} - {env.lastTestStatus}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Documents</h2>
              <p className="text-sm text-muted-foreground">API documentation for generating tools with AI</p>
            </div>
            <Button onClick={() => setIsAddDocDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>

          {documents.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-8 w-8 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No documents yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Add API documentation to help generate tools</p>
                <Button onClick={() => setIsAddDocDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Document
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {documents.map((doc: AppDocument) => (
                <Card key={doc.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="mt-0.5 shrink-0">
                          {getDocStatusIcon(doc.status)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <CardTitle className="text-base truncate">{doc.title || doc.fileName || "Untitled Document"}</CardTitle>
                          {doc.sourceUrl && (
                            <CardDescription className="text-xs truncate mt-0.5">
                              {doc.sourceUrl}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {getDocStatusBadge(doc.status)}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {doc.status === "FAILED" && (
                              <DropdownMenuItem
                                onClick={() => reprocessDocument.mutate({ id: doc.id })}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Retry
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setDocumentToDelete(doc)
                                setIsDeleteDocDialogOpen(true)
                              }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {/* Processing indicator */}
                    {(doc.status === "PROCESSING" || doc.status === "PENDING") && (
                      <div className="space-y-2 mb-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {doc.status === "PENDING"
                              ? "Waiting to process..."
                              : doc.totalChunks && doc.processedChunks !== null
                                ? `Vectorizing chunks ${doc.processedChunks} of ${doc.totalChunks}...`
                                : "Extracting content..."}
                          </span>
                          {doc.status === "PROCESSING" && doc.totalChunks && doc.processedChunks !== null && (
                            <span className="text-muted-foreground font-medium">
                              {Math.round((doc.processedChunks / doc.totalChunks) * 100)}%
                            </span>
                          )}
                        </div>
                        <Progress
                          value={
                            doc.status === "PENDING"
                              ? 0
                              : doc.totalChunks && doc.processedChunks !== null
                                ? (doc.processedChunks / doc.totalChunks) * 100
                                : undefined
                          }
                          className={doc.status === "PROCESSING" && !doc.totalChunks ? "animate-pulse" : ""}
                        />
                      </div>
                    )}

                    {/* Success info */}
                    {doc.status === "COMPLETED" && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {doc.sourceType === "URL" ? "From URL" : doc.sourceType === "TEXT" ? "Pasted text" : doc.sourceType}
                        </span>
                        {doc._count.chunks > 0 && (
                          <span className="flex items-center gap-1">
                            <Boxes className="h-3 w-3" />
                            {doc._count.chunks} vector chunks
                          </span>
                        )}
                      </div>
                    )}

                    {/* Error message */}
                    {doc.errorMessage && (
                      <div className="mt-2 rounded-md bg-destructive/10 p-2">
                        <p className="text-sm text-destructive">{doc.errorMessage}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="mt-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Tools</h2>
              <p className="text-sm text-muted-foreground">MCP-exposed actions for this application</p>
            </div>
            <Button onClick={() => router.push(`/applications/${applicationId}/tools/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Tool
            </Button>
          </div>

          {tools.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Wrench className="h-8 w-8 text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-1">No tools yet</h3>
                <p className="text-sm text-muted-foreground mb-4">Create tools to expose API actions via MCP</p>
                <Button onClick={() => router.push(`/applications/${applicationId}/tools/new`)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Tool
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {tools.map((tool: AppTool) => (
                <Card
                  key={tool.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => router.push(`/applications/${applicationId}/tools/${tool.id}`)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base">{tool.title}</CardTitle>
                        <CardDescription className="text-xs font-mono">{tool.name}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {tool.status === "DRAFT" && (
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation()
                              publishTool.mutate({ id: tool.id })
                            }}>
                              Publish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteTool.mutate({ id: tool.id })
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{tool.description}</p>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="font-mono text-xs">
                        {tool.httpMethod}
                      </Badge>
                      <code className="text-xs text-muted-foreground truncate flex-1">{tool.pathTemplate}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      {getToolStatusBadge(tool.status)}
                      <span className="text-xs text-muted-foreground">
                        {tool._count.executions} execution{tool._count.executions !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Add Environment Dialog */}
      <Dialog open={isAddEnvDialogOpen} onOpenChange={setIsAddEnvDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Environment</DialogTitle>
            <DialogDescription>Configure a new environment for this application</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="environment">Environment</Label>
              <Select
                value={envForm.environment}
                onValueChange={(value) => setEnvForm({ ...envForm, environment: value as EnvironmentType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select environment" />
                </SelectTrigger>
                <SelectContent>
                  {(["PRODUCTION", "SANDBOX", "DEVELOPMENT"] as const)
                    .filter((env) => !existingEnvTypes.includes(env))
                    .map((env) => (
                      <SelectItem key={env} value={env}>
                        {envLabels[env]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="baseUrl">Base URL</Label>
              <Input
                id="baseUrl"
                placeholder="https://api.example.com"
                value={envForm.baseUrl}
                onChange={(e) => setEnvForm({ ...envForm, baseUrl: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="authType">Authentication Type</Label>
              <Select
                value={envForm.authType}
                onValueChange={(value) => setEnvForm({ ...envForm, authType: value as AuthType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select auth type" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(authTypeLabels) as AuthType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {authTypeLabels[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEnvDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEnvironment} disabled={addEnvironment.isPending}>
              {addEnvironment.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Environment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Document Dialog */}
      <Dialog open={isAddDocDialogOpen} onOpenChange={setIsAddDocDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
            <DialogDescription>Add API documentation for AI tool generation</DialogDescription>
          </DialogHeader>
          <Tabs value={docForm.sourceType} onValueChange={(v) => setDocForm({ ...docForm, sourceType: v as "url" | "text" })}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="url">From URL</TabsTrigger>
              <TabsTrigger value="text">Paste Text</TabsTrigger>
            </TabsList>
            <TabsContent value="url" className="space-y-4 pt-4">
              <div className="grid gap-2">
                <Label htmlFor="sourceUrl">Documentation URL</Label>
                <Input
                  id="sourceUrl"
                  placeholder="https://docs.example.com/api"
                  value={docForm.sourceUrl}
                  onChange={(e) => setDocForm({ ...docForm, sourceUrl: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="docTitle">Title (optional)</Label>
                <Input
                  id="docTitle"
                  placeholder="API Reference"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                />
              </div>
            </TabsContent>
            <TabsContent value="text" className="space-y-4 pt-4">
              <div className="grid gap-2">
                <Label htmlFor="textTitle">Title</Label>
                <Input
                  id="textTitle"
                  placeholder="API Reference"
                  value={docForm.title}
                  onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="content">Content</Label>
                <Textarea
                  id="content"
                  placeholder="Paste your API documentation here..."
                  rows={8}
                  value={docForm.content}
                  onChange={(e) => setDocForm({ ...docForm, content: e.target.value })}
                />
              </div>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDocDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddDocument} disabled={addDocument.isPending || addTextDocument.isPending}>
              {(addDocument.isPending || addTextDocument.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set Credentials Dialog */}
      <Dialog open={isCredentialsDialogOpen} onOpenChange={(open) => {
        setIsCredentialsDialogOpen(open)
        if (!open) {
          setSelectedEnvForCredentials(null)
          resetCredentialsForm()
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {selectedEnvForCredentials?.secretArn ? "Update" : "Set"} Credentials
            </DialogTitle>
            <DialogDescription>
              {selectedEnvForCredentials && (
                <>
                  Configure {authTypeLabels[selectedEnvForCredentials.authType]} credentials for{" "}
                  {envLabels[selectedEnvForCredentials.environment]} environment.
                  Credentials are stored securely in AWS Secrets Manager.
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {selectedEnvForCredentials && (
            <div className="grid gap-4 py-4">
              {/* API Key fields */}
              {selectedEnvForCredentials.authType === "API_KEY" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="apiKey">API Key</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="Enter your API key"
                      value={credentialsForm.apiKey}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, apiKey: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="apiKeyHeader">Header Name (optional)</Label>
                    <Input
                      id="apiKeyHeader"
                      placeholder="X-API-Key"
                      value={credentialsForm.apiKeyHeader}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, apiKeyHeader: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      The HTTP header to use for the API key. Defaults to X-API-Key.
                    </p>
                  </div>
                </>
              )}

              {/* Basic Auth fields */}
              {selectedEnvForCredentials.authType === "BASIC" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="Enter username"
                      value={credentialsForm.username}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, username: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter password"
                      value={credentialsForm.password}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, password: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Bearer Token fields */}
              {selectedEnvForCredentials.authType === "BEARER" && (
                <div className="grid gap-2">
                  <Label htmlFor="bearerToken">Bearer Token</Label>
                  <Input
                    id="bearerToken"
                    type="password"
                    placeholder="Enter bearer token"
                    value={credentialsForm.bearerToken}
                    onChange={(e) => setCredentialsForm({ ...credentialsForm, bearerToken: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    The token will be sent as: Authorization: Bearer [token]
                  </p>
                </div>
              )}

              {/* OAuth2 fields */}
              {selectedEnvForCredentials.authType === "OAUTH2" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="clientId">Client ID</Label>
                    <Input
                      id="clientId"
                      placeholder="Enter client ID"
                      value={credentialsForm.clientId}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, clientId: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="clientSecret">Client Secret</Label>
                    <Input
                      id="clientSecret"
                      type="password"
                      placeholder="Enter client secret"
                      value={credentialsForm.clientSecret}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, clientSecret: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="tokenUrl">Token URL (optional)</Label>
                    <Input
                      id="tokenUrl"
                      placeholder="https://auth.example.com/oauth/token"
                      value={credentialsForm.tokenUrl}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, tokenUrl: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* Custom Header fields */}
              {selectedEnvForCredentials.authType === "CUSTOM_HEADER" && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="customHeaderName">Header Name</Label>
                    <Input
                      id="customHeaderName"
                      placeholder="X-Custom-Auth"
                      value={credentialsForm.customHeaderName}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, customHeaderName: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="customHeaderValue">Header Value</Label>
                    <Input
                      id="customHeaderValue"
                      type="password"
                      placeholder="Enter header value"
                      value={credentialsForm.customHeaderValue}
                      onChange={(e) => setCredentialsForm({ ...credentialsForm, customHeaderValue: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* MTLS notice */}
              {selectedEnvForCredentials.authType === "MTLS" && (
                <div className="rounded-lg bg-muted p-4">
                  <p className="text-sm text-muted-foreground">
                    mTLS configuration requires certificate management. Please contact support for assistance.
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsCredentialsDialogOpen(false)
                setSelectedEnvForCredentials(null)
                resetCredentialsForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSetCredentials} disabled={setCredentials.isPending}>
              {setCredentials.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Credentials
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Document Confirmation Dialog */}
      <Dialog open={isDeleteDocDialogOpen} onOpenChange={(open) => {
        setIsDeleteDocDialogOpen(open)
        if (!open) {
          setDocumentToDelete(null)
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this document?
            </DialogDescription>
          </DialogHeader>
          {documentToDelete && (
            <div className="py-4">
              <div className="rounded-lg border p-4 mb-4">
                <div className="font-medium mb-1">
                  {documentToDelete.title || documentToDelete.fileName || "Untitled Document"}
                </div>
                {documentToDelete.sourceUrl && (
                  <div className="text-sm text-muted-foreground truncate">
                    {documentToDelete.sourceUrl}
                  </div>
                )}
              </div>
              {documentToDelete._count.chunks > 0 && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-medium text-amber-900 dark:text-amber-100 mb-1">
                        This will permanently delete {documentToDelete._count.chunks} vector embedding{documentToDelete._count.chunks !== 1 ? "s" : ""}
                      </div>
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        These embeddings are used for AI-powered tool generation. This action cannot be undone.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDocDialogOpen(false)
                setDocumentToDelete(null)
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (documentToDelete) {
                  deleteDocument.mutate({ id: documentToDelete.id })
                }
              }}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
