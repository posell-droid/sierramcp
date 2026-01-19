"use client"

import { Suspense } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, XCircle, Pencil, Upload, AlertCircle, ChevronRight, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { trpc } from "@/lib/trpc"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

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

function getHttpMethodColor(method: HttpMethod) {
  switch (method) {
    case "GET":
      return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
    case "POST":
      return "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20"
    case "PUT":
      return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
    case "DELETE":
      return "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
    case "PATCH":
      return "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
  }
}

export default function ToolDetailPage({
  params,
}: {
  params: { id: string; toolId: string }
}) {
  const { id: applicationId, toolId } = params
  const router = useRouter()

  // Real tRPC queries
  const { data: application } = trpc.applications.get.useQuery({ id: applicationId })
  const { data: tool, isLoading, error } = trpc.tools.get.useQuery({ id: toolId })

  // Parse spec from the tool
  const spec = tool?.spec as {
    http?: { method?: string; path?: string }
    inputs?: { path?: object; query?: object; headers?: object; body?: object }
    outputs?: { success?: object; errors?: object[] }
    safety?: { readOnly?: boolean; destructive?: boolean; pii?: boolean }
  } | null

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "PUBLISHED":
        return "default"
      case "DRAFT":
        return "secondary"
      case "DEPRECATED":
        return "outline"
      default:
        return "secondary"
    }
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

  const httpMethod = (spec?.http?.method || tool.httpMethod || "GET") as HttpMethod
  const path = spec?.http?.path || tool.pathTemplate || "/"
  const status = tool.status === "PUBLISHED" ? "Published" : tool.status === "DRAFT" ? "Draft" : "Deprecated"

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <div className="mb-6">
            <ToolDetailBreadcrumb
              applicationId={applicationId}
              applicationName={application?.name}
              toolName={tool.title || tool.name}
            />
          </div>
        </Suspense>

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight mb-1">{tool.title || tool.name}</h1>
            <p className="text-muted-foreground">{tool.description}</p>
            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <Badge
                variant={getStatusBadgeVariant(tool.status)}
                className={
                  tool.status === "PUBLISHED"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                    : ""
                }
              >
                {status}
              </Badge>
              <Badge variant="outline" className={getHttpMethodColor(httpMethod)}>
                {httpMethod}
              </Badge>
              {tool.readOnly && (
                <Badge variant="secondary" className="text-xs">
                  <Shield className="mr-1 h-3 w-3" />
                  Read-only
                </Badge>
              )}
              {tool.destructive && (
                <Badge variant="destructive" className="text-xs">
                  Destructive
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                Updated {formatDistanceToNow(new Date(tool.updatedAt), { addSuffix: true })}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Button>
            {tool.status === "DRAFT" && (
              <Button onClick={() => toast.info("Publish coming soon")}>
                <Upload className="h-4 w-4 mr-2" />
                Publish
              </Button>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {/* Tool Definition */}
          <Card>
            <CardHeader>
              <CardTitle>Tool Definition</CardTitle>
              <CardDescription>API endpoint configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">Name (for LLM)</div>
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">{tool.name}</p>
                </div>
                <div>
                  <div className="text-sm font-medium text-muted-foreground mb-1">HTTP Method</div>
                  <Badge variant="outline" className={getHttpMethodColor(httpMethod)}>
                    {httpMethod}
                  </Badge>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Endpoint Path</div>
                  <p className="text-sm font-mono bg-muted px-3 py-2 rounded-md">{path}</p>
                </div>
                <div className="md:col-span-2">
                  <div className="text-sm font-medium text-muted-foreground mb-1">Description</div>
                  <p className="text-sm">{tool.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Input Schema */}
          {spec?.inputs && (
            <Card>
              <CardHeader>
                <CardTitle>Input Schema</CardTitle>
                <CardDescription>Expected request parameters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 overflow-x-auto">
                  <pre className="text-xs font-mono">{JSON.stringify(spec.inputs, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Output Schema */}
          {spec?.outputs && (
            <Card>
              <CardHeader>
                <CardTitle>Output Schema</CardTitle>
                <CardDescription>Response data structure</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-muted p-4 overflow-x-auto">
                  <pre className="text-xs font-mono">{JSON.stringify(spec.outputs, null, 2)}</pre>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sources */}
          {tool.sources && Array.isArray(tool.sources) && (tool.sources as unknown[]).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Documentation Sources</CardTitle>
                <CardDescription>API documentation used to generate this tool</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {(tool.sources as Array<{ docId: string; chunkId: string; excerpt: string }>).map((source, idx) => (
                    <div key={idx} className="border-l-2 border-primary/20 pl-3 py-2">
                      <p className="text-sm text-muted-foreground">{source.excerpt}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Test Results */}
          <Card>
            <CardHeader>
              <CardTitle>Test Results</CardTitle>
              <CardDescription>Recent test execution history</CardDescription>
            </CardHeader>
            <CardContent>
              {tool.testResults && tool.testResults.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="w-[100px]">HTTP</TableHead>
                      <TableHead className="w-[100px]">Duration</TableHead>
                      <TableHead>Input</TableHead>
                      <TableHead className="text-right">Tested</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tool.testResults.map((result: {
                      id: string
                      success: boolean
                      durationMs: number
                      input: unknown
                      actualOutput: unknown
                      errorMessage: string | null
                      createdAt: string | Date
                    }) => (
                      <TableRow key={result.id}>
                        <TableCell>
                          {result.success ? (
                            <Badge variant="outline" className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pass
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">
                              <XCircle className="h-3 w-3 mr-1" />
                              Fail
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {result.actualOutput && typeof result.actualOutput === 'object' ? (
                            <span className="text-sm font-mono">
                              {result.success ? '2xx' : result.errorMessage?.match(/HTTP (\d+)/)?.[1] || 'Error'}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{result.durationMs}ms</span>
                        </TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted px-2 py-1 rounded max-w-[200px] truncate block">
                            {JSON.stringify(result.input).substring(0, 50)}
                            {JSON.stringify(result.input).length > 50 ? '...' : ''}
                          </code>
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true })}
                        </TableCell>
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
                  <Button variant="outline" onClick={() => router.push(`/applications/${applicationId}/tools/${toolId}/edit`)}>
                    Go to Edit to Test
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
