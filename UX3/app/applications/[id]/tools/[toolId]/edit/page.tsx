"use client"

import { use, useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { ChevronRight, Loader2, Sparkles, CheckCircle, XCircle, Lock, Info } from "lucide-react"

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

function useTool(toolId: string) {
  const [data] = useState({
    id: toolId,
    name: "Search Knowledge Base",
    description: "Semantic search across all documentation and FAQs to find relevant information for customer queries",
    httpMethod: "POST" as const,
    path: "/api/search",
    status: "Draft" as "Draft" | "Published",
    applicationName: "Customer Support Bot",
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    inputParams: [
      { name: "query", type: "string", description: "The search query text", required: true },
      { name: "limit", type: "number", description: "Maximum results to return", required: false },
    ],
    outputFields: [
      { name: "results", type: "array", description: "Array of matching documents" },
      { name: "totalCount", type: "number", description: "Total number of matches" },
    ],
    isReadOnly: false,
    testCases: [
      {
        id: "1",
        name: "Basic search",
        inputs: { query: "password reset", limit: 10 },
        expectedStatus: 200,
      },
      {
        id: "2",
        name: "Empty query",
        inputs: { query: "", limit: 5 },
        expectedStatus: 400,
      },
    ],
    version: "1.0",
  })

  return { data, isLoading: false }
}

function useRefineTool() {
  const mutateAsync = async (payload: any) => {
    console.log("[v0] Refining tool:", payload)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return {
      summary: "Updated input schema to accept email instead of user ID",
    }
  }

  return { mutateAsync, isPending: false }
}

function usePublishTool() {
  const mutateAsync = async (toolId: string) => {
    console.log("[v0] Publishing tool:", toolId)
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }

  return { mutateAsync, isPending: false }
}

function useDeleteDraft() {
  const mutateAsync = async (toolId: string) => {
    console.log("[v0] Deleting draft:", toolId)
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }

  return { mutateAsync, isPending: false }
}

function useRunTest() {
  const mutateAsync = async (testCaseId: string) => {
    console.log("[v0] Running test:", testCaseId)
    await new Promise((resolve) => setTimeout(resolve, 2000))
    return {
      status: Math.random() > 0.3 ? "success" : "failure",
      duration: Math.floor(Math.random() * 500) + 100,
      response: {
        results: [
          { id: "1", title: "Password Reset Guide", content: "..." },
          { id: "2", title: "Account Recovery", content: "..." },
        ],
        totalCount: 2,
      },
    }
  }

  return { mutateAsync, isPending: false }
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

export default function EditToolPage({ params }: { params: Promise<{ id: string; toolId: string }> }) {
  const { id: applicationId, toolId } = use(params)
  const router = useRouter()
  const { data: tool, isLoading: isLoadingTool } = useTool(toolId)
  const { mutateAsync: refineTool, isPending: isRefining } = useRefineTool()
  const { mutateAsync: publishTool, isPending: isPublishing } = usePublishTool()
  const { mutateAsync: deleteDraft, isPending: isDeleting } = useDeleteDraft()
  const { mutateAsync: runTest, isPending: isRunningTest } = useRunTest()

  const [refinementInput, setRefinementInput] = useState("")
  const [lastAiSummary, setLastAiSummary] = useState("")
  const [testResults, setTestResults] = useState<Record<string, any>>({})
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [isCreatingVersion, setIsCreatingVersion] = useState(false)

  const [editedTool, setEditedTool] = useState<any>(null)

  if (tool && !editedTool) {
    setEditedTool({
      name: tool.name,
      description: tool.description,
      httpMethod: tool.httpMethod,
      path: tool.path,
    })
  }

  const isPublished = tool?.status === "Published"
  const isLocked = isPublished

  const handleRefineTool = async () => {
    if (!refinementInput.trim()) return

    try {
      const result = await refineTool({
        toolId,
        instruction: refinementInput,
      })

      setLastAiSummary(result.summary)
      setRefinementInput("")

      toast.success("Tool refined", {
        description: result.summary,
      })
    } catch (error) {
      toast.error("Failed to refine tool", {
        description: "Please try again",
      })
    }
  }

  const handlePublish = async () => {
    try {
      await publishTool(toolId)

      toast.success("Tool published", {
        description: "Tool is now available for production use",
      })

      router.push(`/applications/${applicationId}/tools/${toolId}`)
    } catch (error) {
      toast.error("Failed to publish tool", {
        description: "Please try again",
      })
    }
  }

  const handleDeleteDraft = async () => {
    try {
      await deleteDraft(toolId)

      toast.success("Draft deleted", {
        description: "The draft tool has been removed",
      })

      router.push(`/applications/${applicationId}/tools`)
    } catch (error) {
      toast.error("Failed to delete draft", {
        description: "Please try again",
      })
    }
  }

  const handleRunTest = async (testCaseId: string) => {
    try {
      const result = await runTest(testCaseId)

      setTestResults((prev) => ({ ...prev, [testCaseId]: result }))

      toast.success("Test completed", {
        description: `Status: ${result.status}, Duration: ${result.duration}ms`,
      })
    } catch (error) {
      toast.error("Test failed", {
        description: "Please try again",
      })
    }
  }

  const handleCreateNewVersion = async () => {
    setIsCreatingVersion(true)
    try {
      // Mock version creation - replace with actual tRPC mutation
      const newVersion = await new Promise<string>((resolve) => {
        setTimeout(() => {
          const currentVersion = tool.version || "1.0"
          const parts = currentVersion.split(".")
          const newMinor = Number.parseInt(parts[1] || "0") + 1
          resolve(`${parts[0]}.${newMinor}`)
        }, 1000)
      })

      toast.success("New version created", {
        description: `Version ${newVersion} is now in draft`,
      })

      // Navigate to the new draft version
      router.push(`/applications/${applicationId}/tools/${toolId}-v${newVersion}/edit`)
    } catch (error) {
      toast.error("Failed to create version", {
        description: "Please try again",
      })
    } finally {
      setIsCreatingVersion(false)
    }
  }

  if (isLoadingTool || !tool || !editedTool) {
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
        {/* Breadcrumbs */}
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <div className="mb-6">
            <EditToolBreadcrumb
              applicationId={applicationId}
              applicationName={tool.applicationName}
              toolId={toolId}
              toolName={tool.name}
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
            <h1 className="text-3xl font-semibold tracking-tight">{tool.name}</h1>
            <Badge variant={isPublished ? "default" : "secondary"}>{tool.status}</Badge>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>Application: {tool.applicationName}</span>
            <span>•</span>
            <span>
              Last updated:{" "}
              {tool.updatedAt.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
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
                  disabled={isRefining || isLocked}
                />

                <Button
                  onClick={handleRefineTool}
                  disabled={isRefining || !refinementInput.trim() || isLocked}
                  className="w-full"
                >
                  {isRefining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                  <Label htmlFor="name">Tool Name</Label>
                  <Input
                    id="name"
                    value={editedTool.name}
                    onChange={(e) => setEditedTool({ ...editedTool, name: e.target.value })}
                    disabled={isLocked}
                  />
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
                      onValueChange={(value) => setEditedTool({ ...editedTool, httpMethod: value })}
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

                <Separator />

                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-sm mb-3">Input Parameters</h3>
                    <div className="space-y-2">
                      {tool.inputParams.map((param, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm bg-muted/50 p-3 rounded">
                          <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{param.name}</code>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">{param.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Type: {param.type} {param.required && "• Required"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium text-sm mb-3">Output Fields</h3>
                    <div className="space-y-2">
                      {tool.outputFields.map((field, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-sm bg-muted/50 p-3 rounded">
                          <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">{field.name}</code>
                          <div className="flex-1">
                            <p className="text-xs text-muted-foreground">{field.description}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">Type: {field.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Test Tool</CardTitle>
            <CardDescription>Run generated test cases to verify tool behavior</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {tool.testCases.map((testCase) => {
              const result = testResults[testCase.id]

              return (
                <div key={testCase.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium text-sm">{testCase.name}</h4>
                      <p className="text-xs text-muted-foreground mt-1">Expected status: {testCase.expectedStatus}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRunTest(testCase.id)}
                      disabled={isRunningTest}
                    >
                      {isRunningTest ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Run Test
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Input values:</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                      {JSON.stringify(testCase.inputs, null, 2)}
                    </pre>
                  </div>

                  {result && (
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center gap-2">
                        {result.status === "success" ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-destructive" />
                        )}
                        <span className="text-sm font-medium capitalize">{result.status}</span>
                        <span className="text-xs text-muted-foreground">• {result.duration}ms</span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Response:</p>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-40">
                          {JSON.stringify(result.response, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
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
                    disabled={isDeleting || isPublishing}
                  >
                    Delete Draft
                  </Button>
                  <Button onClick={handlePublish} disabled={isPublishing}>
                    {isPublishing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Publish Tool
                  </Button>
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
                This action cannot be undone. The draft tool "{tool.name}" will be permanently deleted.
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
