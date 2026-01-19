"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Loader2, Sparkles, CheckCircle, XCircle, Lock, Info, Play, Clock, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { trpc } from "@/lib/trpc"
import { formatDistanceToNow } from "date-fns"

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"

interface TestResult {
  success: boolean
  durationMs: number
  httpStatusCode: number | null
  actualOutput: unknown
  errorMessage: string | null
  responseHeaders?: Record<string, string>
}

interface Environment {
  id: string
  environment: string
  baseUrl: string
  authType: string
  secretArn: string | null
}

function EditToolBreadcrumb({
  applicationId,
  applicationName,
  toolId,
  toolName,
}: {
  applicationId: string
  applicationName?: string
  toolId: string
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
          <BreadcrumbPage>Edit {toolName || "Tool"}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function EditToolPage({ params }: { params: { id: string; toolId: string } }) {
  const { id: applicationId, toolId } = params
  const router = useRouter()

  // Real tRPC queries and mutations
  const { data: application } = trpc.applications.get.useQuery({ id: applicationId })
  const { data: tool, isLoading: isLoadingTool, refetch } = trpc.tools.get.useQuery({ id: toolId })

  const updateMutation = trpc.tools.update.useMutation({
    onSuccess: () => {
      refetch()
      toast.success("Tool updated", { description: "Changes saved successfully" })
    },
    onError: (error) => {
      toast.error("Failed to update tool", { description: error.message })
    },
  })

  const publishMutation = trpc.tools.publish.useMutation({
    onSuccess: () => {
      toast.success("Tool published", { description: "Tool is now available for production use" })
      router.push(`/applications/${applicationId}/tools/${toolId}`)
    },
    onError: (error) => {
      toast.error("Failed to publish tool", { description: error.message })
    },
  })

  const deleteMutation = trpc.tools.delete.useMutation({
    onSuccess: () => {
      toast.success("Draft deleted", { description: "The draft tool has been removed" })
      router.push(`/applications/${applicationId}/tools`)
    },
    onError: (error) => {
      toast.error("Failed to delete draft", { description: error.message })
    },
  })

  const refineMutation = trpc.llm.refineTool.useMutation({
    onSuccess: (result) => {
      refetch()
      setLastAiSummary(result.summary || "Tool refined successfully")
      setRefinementInput("")
      toast.success("Tool refined", { description: result.summary })
    },
    onError: (error) => {
      toast.error("Failed to refine tool", { description: error.message })
    },
  })

  const testMutation = trpc.tools.test.useMutation({
    onSuccess: (result, variables) => {
      // Find which test case was run by the input
      const testIdx = runningTestIdx
      if (testIdx !== null) {
        setTestResults((prev) => ({
          ...prev,
          [testIdx]: result,
        }))
      }
      refetch() // Refresh tool to update status if changed to TESTED
      if (result.success) {
        toast.success("Test passed", { description: `Completed in ${result.durationMs}ms` })
      } else {
        toast.error("Test failed", { description: result.errorMessage || "Unknown error" })
      }
    },
    onError: (error) => {
      toast.error("Test execution failed", { description: error.message })
    },
  })

  const [refinementInput, setRefinementInput] = useState("")
  const [lastAiSummary, setLastAiSummary] = useState("")
  const [testResults, setTestResults] = useState<Record<number, TestResult>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>("")
  const [runningTestIdx, setRunningTestIdx] = useState<number | null>(null)

  // Local edit state
  const [editedTool, setEditedTool] = useState<{
    name: string
    title: string
    description: string
    httpMethod: HttpMethod
    path: string
  } | null>(null)

  // Initialize edited tool from loaded data
  useEffect(() => {
    if (tool && !editedTool) {
      const spec = tool.spec as { http?: { method?: string; path?: string } } | null
      setEditedTool({
        name: tool.name,
        title: tool.title || tool.name,
        description: tool.description,
        httpMethod: (spec?.http?.method || tool.httpMethod || "GET") as HttpMethod,
        path: spec?.http?.path || tool.pathTemplate || "/",
      })
    }
  }, [tool, editedTool])

  // Set default environment when application loads
  useEffect(() => {
    if (application?.environments && application.environments.length > 0 && !selectedEnvironmentId) {
      // Prefer sandbox/development over production for testing
      const devEnv = application.environments.find((e: Environment) =>
        e.environment === "SANDBOX" || e.environment === "DEVELOPMENT"
      )
      setSelectedEnvironmentId(devEnv?.id || application.environments[0].id)
    }
  }, [application, selectedEnvironmentId])

  // Parse spec from tool
  const spec = tool?.spec as {
    http?: { method?: string; path?: string }
    inputs?: { path?: { properties?: Record<string, unknown> }; query?: { properties?: Record<string, unknown> }; headers?: object; body?: { properties?: Record<string, unknown> } }
    outputs?: { success?: object; errors?: object[] }
    safety?: { readOnly?: boolean; destructive?: boolean }
  } | null

  const testCases = (tool?.testCases as Array<{ id?: string; name: string; inputs: { path?: Record<string, unknown>; query?: Record<string, unknown>; body?: Record<string, unknown> }; expectedStatus?: number }>) || []

  const isPublished = tool?.status === "PUBLISHED"
  const isLocked = isPublished

  const environments = (application?.environments || []) as Environment[]
  const selectedEnv = environments.find((e) => e.id === selectedEnvironmentId)

  const handleRefineTool = async () => {
    if (!refinementInput.trim()) return

    refineMutation.mutate({
      toolId,
      instruction: refinementInput,
    })
  }

  const handlePublish = async () => {
    publishMutation.mutate({ id: toolId })
  }

  const handleDeleteDraft = async () => {
    deleteMutation.mutate({ id: toolId })
  }

  const handleSaveChanges = async () => {
    if (!editedTool) return

    // Build updated spec
    const currentSpec = spec || {}
    const updatedSpec = {
      ...currentSpec,
      http: {
        ...currentSpec.http,
        method: editedTool.httpMethod,
        path: editedTool.path,
      },
    }

    updateMutation.mutate({
      id: toolId,
      title: editedTool.title,
      description: editedTool.description,
      httpMethod: editedTool.httpMethod,
      pathTemplate: editedTool.path,
      spec: updatedSpec,
    })
  }

  const handleRunTest = async (testCaseIdx: number) => {
    if (!selectedEnvironmentId) {
      toast.error("Select an environment", { description: "Please select an environment to run tests" })
      return
    }

    const testCase = testCases[testCaseIdx]
    if (!testCase) return

    // Flatten the inputs object for the API
    const flatInput: Record<string, unknown> = {
      ...(testCase.inputs?.path || {}),
      ...(testCase.inputs?.query || {}),
      ...(testCase.inputs?.body || {}),
    }

    setRunningTestIdx(testCaseIdx)
    testMutation.mutate({
      toolId,
      environmentId: selectedEnvironmentId,
      input: flatInput,
    })
  }

  const handleCreateNewVersion = async () => {
    setIsCreatingVersion(true)
    try {
      // TODO: Wire to real createNewVersion mutation
      toast.info("Version creation coming soon")
    } finally {
      setIsCreatingVersion(false)
    }
  }

  // Reset running test idx when mutation completes
  useEffect(() => {
    if (!testMutation.isPending) {
      setRunningTestIdx(null)
    }
  }, [testMutation.isPending])

  if (isLoadingTool || !tool) {
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

  if (!editedTool) {
    return null
  }

  const displayTitle = tool.title || tool.name
  const status = tool.status === "PUBLISHED" ? "Published" : tool.status === "TESTED" ? "Tested" : "Draft"

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumbs */}
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <div className="mb-6">
            <EditToolBreadcrumb
              applicationId={applicationId}
              applicationName={application?.name}
              toolId={toolId}
              toolName={displayTitle}
            />
          </div>
        </Suspense>

        {isPublished && (
          <Alert className="mb-6 border-primary/20 bg-primary/5">
            <Info className="h-4 w-4 text-primary" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-foreground">This tool is published. Changes require creating a new version.</span>
              <Button onClick={handleCreateNewVersion} disabled={isCreatingVersion} size="sm" className="ml-4">
                {isCreatingVersion ? "Creating..." : "Create New Version"}
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-semibold tracking-tight">{displayTitle}</h1>
            <Badge
              variant={isPublished ? "default" : "secondary"}
              className={tool.status === "TESTED" ? "bg-blue-500/10 text-blue-700 border-blue-500/20" : ""}
            >
              {status}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Application: {application?.name || "Loading..."}</span>
            <span>•</span>
            <span>
              Last updated: {formatDistanceToNow(new Date(tool.updatedAt), { addSuffix: true })}
            </span>
          </div>
        </div>

        <div className="grid lg:grid-cols-[450px_1fr] gap-6 mb-6">
          {/* LEFT PANEL - AI Refinement */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Refine this tool</CardTitle>
                <CardDescription>Use natural language to update the tool definition</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder={`Change this to accept email instead of ID\nAdd a filter for status\nRemove the limit parameter`}
                  value={refinementInput}
                  onChange={(e) => setRefinementInput(e.target.value)}
                  rows={4}
                  disabled={refineMutation.isPending || isLocked}
                />

                <Button
                  onClick={handleRefineTool}
                  disabled={refineMutation.isPending || !refinementInput.trim() || isLocked}
                  className="w-full"
                >
                  {refineMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Sparkles className="mr-2 h-4 w-4" />
                  Update Tool
                </Button>

                {lastAiSummary && (
                  <div className="mt-4 p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Last AI change:</p>
                    <p className="text-sm">{lastAiSummary}</p>
                  </div>
                )}

                {isLocked && (
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertDescription>Published tools cannot be edited. Create a new version instead.</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - Tool Definition */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Tool Definition</CardTitle>
                <CardDescription>
                  {isLocked ? "Published tools are read-only" : "Core details about this tool and its purpose"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLocked && (
                  <Alert className="mb-4">
                    <Lock className="h-4 w-4" />
                    <AlertDescription>Published tools are read-only. Create a new version to edit.</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="title">Tool Title</Label>
                  <Input
                    id="title"
                    value={editedTool.title}
                    onChange={(e) => setEditedTool({ ...editedTool, title: e.target.value })}
                    disabled={isLocked}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="name">Tool Name (for LLM)</Label>
                  <Input
                    id="name"
                    value={editedTool.name}
                    disabled={true}
                    className="font-mono bg-muted"
                    placeholder="get_customer_by_id"
                  />
                  <p className="text-xs text-muted-foreground">Snake_case identifier used by the LLM (set at creation)</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={editedTool.description}
                    onChange={(e) => setEditedTool({ ...editedTool, description: e.target.value })}
                    rows={3}
                    disabled={isLocked}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="httpMethod">HTTP Method</Label>
                    <Select
                      value={editedTool.httpMethod}
                      onValueChange={(value) => setEditedTool({ ...editedTool, httpMethod: value as HttpMethod })}
                      disabled={isLocked}
                    >
                      <SelectTrigger id="httpMethod">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="PATCH">PATCH</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="path">Endpoint Path</Label>
                    <Input
                      id="path"
                      value={editedTool.path}
                      onChange={(e) => setEditedTool({ ...editedTool, path: e.target.value })}
                      className="font-mono text-sm"
                      disabled={isLocked}
                    />
                  </div>
                </div>

                {!isLocked && (
                  <Button
                    onClick={handleSaveChanges}
                    disabled={updateMutation.isPending}
                    className="w-full"
                  >
                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                )}

                <Separator />

                {/* Input Schema */}
                {spec?.inputs && (
                  <div>
                    <h3 className="font-medium text-sm mb-3">Input Schema</h3>
                    <div className="rounded-lg bg-muted p-3 overflow-x-auto">
                      <pre className="text-xs font-mono">{JSON.stringify(spec.inputs, null, 2)}</pre>
                    </div>
                  </div>
                )}

                {/* Output Schema */}
                {spec?.outputs && (
                  <div>
                    <h3 className="font-medium text-sm mb-3">Output Schema</h3>
                    <div className="rounded-lg bg-muted p-3 overflow-x-auto">
                      <pre className="text-xs font-mono">{JSON.stringify(spec.outputs, null, 2)}</pre>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Test Cases */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Test Tool</CardTitle>
                <CardDescription>Run tests against a configured environment</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="test-env" className="text-sm font-normal text-muted-foreground">
                  Environment:
                </Label>
                <Select value={selectedEnvironmentId} onValueChange={setSelectedEnvironmentId}>
                  <SelectTrigger id="test-env" className="w-[200px]">
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.length === 0 ? (
                      <SelectItem value="none" disabled>
                        No environments configured
                      </SelectItem>
                    ) : (
                      environments.map((env) => (
                        <SelectItem key={env.id} value={env.id}>
                          <div className="flex items-center gap-2">
                            <span>{env.environment}</span>
                            {!env.secretArn && env.authType !== "NONE" && (
                              <AlertTriangle className="h-3 w-3 text-amber-500" />
                            )}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Environment warning */}
            {selectedEnv && !selectedEnv.secretArn && selectedEnv.authType !== "NONE" && (
              <Alert className="border-amber-500/20 bg-amber-500/5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200">
                  Credentials not configured for {selectedEnv.environment}. Tests may fail without authentication.
                </AlertDescription>
              </Alert>
            )}

            {environments.length === 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No environments configured. <Button variant="link" className="h-auto p-0 ml-1" onClick={() => router.push(`/applications/${applicationId}`)}>Add an environment</Button> to run tests.
                </AlertDescription>
              </Alert>
            )}

            {testCases.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No test cases defined for this tool.</p>
              </div>
            ) : (
              testCases.map((testCase, idx) => {
                const result = testResults[idx]
                const isRunning = runningTestIdx === idx && testMutation.isPending

                return (
                  <div key={idx} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{testCase.name}</h4>
                        {testCase.expectedStatus && (
                          <p className="text-xs text-muted-foreground mt-1">Expected status: {testCase.expectedStatus}</p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRunTest(idx)}
                        disabled={isRunning || !selectedEnvironmentId || environments.length === 0}
                      >
                        {isRunning ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="mr-2 h-4 w-4" />
                        )}
                        {isRunning ? "Running..." : "Run Test"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Input values:</p>
                      <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                        {JSON.stringify(testCase.inputs, null, 2)}
                      </pre>
                    </div>

                    {/* Test Result */}
                    {result && (
                      <div className="space-y-3 pt-3 border-t">
                        <div className="flex items-center gap-3">
                          {result.success ? (
                            <div className="flex items-center gap-2 text-green-600">
                              <CheckCircle className="h-5 w-5" />
                              <span className="font-medium">Passed</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-destructive">
                              <XCircle className="h-5 w-5" />
                              <span className="font-medium">Failed</span>
                            </div>
                          )}
                          <Badge variant="outline" className="font-mono">
                            {result.httpStatusCode || "N/A"}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {result.durationMs}ms
                          </div>
                        </div>

                        {result.errorMessage && (
                          <div className="rounded-lg bg-destructive/10 p-3">
                            <p className="text-sm text-destructive">{result.errorMessage}</p>
                          </div>
                        )}

                        {result.actualOutput !== null && result.actualOutput !== undefined && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">Response:</p>
                            <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-60 overflow-y-auto">
                              {JSON.stringify(result.actualOutput, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              {!isPublished ? (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setShowDeleteDialog(true)}
                    disabled={deleteMutation.isPending || publishMutation.isPending}
                  >
                    Delete Draft
                  </Button>
                  <div className="flex items-center gap-3">
                    {tool.status === "DRAFT" && (
                      <p className="text-sm text-muted-foreground">Run a successful test to enable publishing</p>
                    )}
                    <Button
                      onClick={handlePublish}
                      disabled={publishMutation.isPending || tool.status === "DRAFT"}
                    >
                      {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Publish Tool
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div />
                  <Button onClick={handleCreateNewVersion}>Create New Version</Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete draft tool?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. The draft tool "{displayTitle}" will be permanently deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteDraft} className="bg-destructive text-destructive-foreground">
                Delete Draft
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
