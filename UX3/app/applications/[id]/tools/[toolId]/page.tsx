"use client"

import { use, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Pencil, Upload, AlertCircle, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

type ToolStatus = "Draft" | "Published" | "Deprecated"
type TestStatus = "Success" | "Failure"
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE"
type AuthType = "NONE" | "API_KEY" | "OAUTH2" | "BASIC" | "BEARER" | "CUSTOM_HEADER" | "MTLS"
type Environment = "Dev" | "Staging" | "Prod"

interface Tool {
  id: string
  name: string
  description: string
  status: ToolStatus
  httpMethod: HttpMethod
  path: string
  inputSchema: object
  outputSchema: object
  updatedAt: Date
}

interface EnvironmentConfig {
  environment: Environment
  baseUrl: string
  authType: AuthType
  credentialSource: string
}

interface TestResult {
  id: string
  date: Date
  environment: Environment
  status: TestStatus
  duration: number // in milliseconds
}

function useTool(toolId: string) {
  const [data] = useState<Tool>({
    id: toolId,
    name: "Search Knowledge Base",
    description: "Semantic search across all documentation and FAQs to find relevant information for customer queries",
    status: "Published",
    httpMethod: "POST",
    path: "/search",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The search query",
        },
        limit: {
          type: "number",
          description: "Maximum number of results",
          default: 10,
        },
        filters: {
          type: "object",
          properties: {
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
          },
        },
      },
      required: ["query"],
    },
    outputSchema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              content: { type: "string" },
              relevanceScore: { type: "number" },
              url: { type: "string" },
            },
          },
        },
        totalCount: { type: "number" },
      },
    },
    updatedAt: new Date(Date.now() - 1000 * 60 * 30),
  })

  return {
    data,
    isLoading: false,
    error: null,
  }
}

function useEnvironmentConfigs(applicationId: string) {
  const [data] = useState<EnvironmentConfig[]>([
    {
      environment: "Dev",
      baseUrl: "https://dev-api.example.com",
      authType: "API_KEY",
      credentialSource: "Environment Variables",
    },
    {
      environment: "Staging",
      baseUrl: "https://staging-api.example.com",
      authType: "OAUTH2",
      credentialSource: "AWS Secrets Manager",
    },
    {
      environment: "Prod",
      baseUrl: "https://api.example.com",
      authType: "OAUTH2",
      credentialSource: "AWS Secrets Manager",
    },
  ])

  return {
    data,
    isLoading: false,
  }
}

function useTestResults(toolId: string) {
  const [data] = useState<TestResult[]>([
    {
      id: "1",
      date: new Date(Date.now() - 1000 * 60 * 15),
      environment: "Prod",
      status: "Success",
      duration: 234,
    },
    {
      id: "2",
      date: new Date(Date.now() - 1000 * 60 * 60 * 2),
      environment: "Prod",
      status: "Success",
      duration: 189,
    },
    {
      id: "3",
      date: new Date(Date.now() - 1000 * 60 * 60 * 5),
      environment: "Staging",
      status: "Failure",
      duration: 1205,
    },
    {
      id: "4",
      date: new Date(Date.now() - 1000 * 60 * 60 * 12),
      environment: "Dev",
      status: "Success",
      duration: 301,
    },
    {
      id: "5",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24),
      environment: "Prod",
      status: "Success",
      duration: 267,
    },
  ])

  return {
    data,
    isLoading: false,
  }
}

function useApplication(id: string) {
  const [data] = useState({ id, name: "Customer Support Bot" })
  return { data, isLoading: false }
}

function ToolDetailBreadcrumb({
  applicationId,
  applicationName,
  toolName,
}: {
  applicationId: string
  applicationName?: string
  toolName?: string
}) {
  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/applications">Applications</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/applications/${applicationId}`}>{applicationName || "Application"}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/applications/${applicationId}/tools`}>Tools</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>{toolName || "Tool"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function ToolDetailPage({
  params,
}: {
  params: Promise<{ id: string; toolId: string }>
}) {
  const { id: applicationId, toolId } = use(params)
  const router = useRouter()
  const [selectedEnvironment, setSelectedEnvironment] = useState<Environment>("Prod")
  const { data: application } = useApplication(applicationId)
  const { data: tool, isLoading, error } = useTool(toolId)
  const { data: environmentConfigs } = useEnvironmentConfigs(applicationId)
  const { data: testResults } = useTestResults(toolId)

  const currentEnvConfig = environmentConfigs?.find((env) => env.environment === selectedEnvironment)

  const getStatusBadgeVariant = (status: ToolStatus) => {
    switch (status) {
      case "Published":
        return "default"
      case "Draft":
        return "secondary"
      case "Deprecated":
        return "outline"
    }
  }

  const getEnvironmentBadgeClass = (environment: Environment) => {
    switch (environment) {
      case "Prod":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
      case "Staging":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
      case "Dev":
        return "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20"
    }
  }

  const handlePublish = () => {
    toast.success("Tool published", {
      description: `${tool?.name} is now available`,
    })
  }

  const handleDeprecate = () => {
    toast.success("Tool deprecated", {
      description: `${tool?.name} has been marked as deprecated`,
    })
  }

  const handleEdit = () => {
    router.push(`/applications/${applicationId}/tools/${toolId}/edit`)
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

  if (error || !tool) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Tool Not Found</h3>
              <p className="text-muted-foreground mb-4">
                The tool you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button onClick={() => router.push(`/applications/${applicationId}/tools`)}>Back to Tools</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <div className="mb-6">
            <ToolDetailBreadcrumb
              applicationId={applicationId}
              applicationName={application?.name}
              toolName={tool.name}
            />
          </div>
        </Suspense>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-1">{tool.name}</h1>
            <p className="text-muted-foreground">{tool.description}</p>
            <div className="flex items-center gap-2 mt-3">
              <Badge
                variant={getStatusBadgeVariant(tool.status)}
                className={
                  tool.status === "Published"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                    : ""
                }
              >
                {tool.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(tool.updatedAt, { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {tool.status === "Draft" && (
              <Button onClick={handlePublish}>
                <Upload className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
            {tool.status === "Published" && (
              <Button variant="outline" onClick={handleDeprecate}>
                <AlertCircle className="h-4 w-4 mr-2" />
                Deprecate
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Runtime Configuration (Inherited)</CardTitle>
              <CardDescription>
                Configuration provided by the environment. Edit these in Application Environments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-2 block">Environment</label>
                <Select value={selectedEnvironment} onValueChange={(val) => setSelectedEnvironment(val as Environment)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dev">Development</SelectItem>
                    <SelectItem value="Staging">Staging</SelectItem>
                    <SelectItem value="Prod">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {currentEnvConfig && (
                <div className="grid gap-4 md:grid-cols-3 pt-2">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Base URL</div>
                    <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">{currentEnvConfig.baseUrl}</p>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Auth Type</div>
                    <Badge variant="outline">{currentEnvConfig.authType}</Badge>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">Credential Source</div>
                    <p className="text-sm">{currentEnvConfig.credentialSource}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Tool Definition</CardTitle>
              <CardDescription>Request configuration for this tool</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Description</div>
                  <p className="text-sm">{tool.description}</p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">HTTP Method</div>
                  <Badge variant="secondary">{tool.httpMethod}</Badge>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Path</div>
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">{tool.path}</p>
                  <p className="text-xs text-muted-foreground mt-1">Path is relative to the environment Base URL</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Input Schema</CardTitle>
              <CardDescription>Expected request parameters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4 overflow-x-auto">
                <pre className="text-xs font-mono">{JSON.stringify(tool.inputSchema, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Output Schema</CardTitle>
              <CardDescription>Response data structure</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted p-4 overflow-x-auto">
                <pre className="text-xs font-mono">{JSON.stringify(tool.outputSchema, null, 2)}</pre>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>Recent test execution history</CardDescription>
            </CardHeader>
            <CardContent>
              {testResults && testResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Environment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {testResults.map((result) => (
                      <TableRow key={result.id}>
                        <TableCell className="text-sm">
                          {formatDistanceToNow(result.date, { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getEnvironmentBadgeClass(result.environment)}>
                            {result.environment}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {result.status === "Success" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <Badge
                              variant={result.status === "Success" ? "default" : "destructive"}
                              className={
                                result.status === "Success"
                                  ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                                  : ""
                              }
                            >
                              {result.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{result.duration}ms</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <h3 className="text-lg font-semibold mb-1">No tests run yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Run your first test to verify this tool works correctly
                  </p>
                  <Button onClick={() => toast.info("Test runner coming soon")}>Run Test</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
