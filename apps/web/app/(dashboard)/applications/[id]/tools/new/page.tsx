"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Loader2, FileText, ChevronDown, ChevronRight, Shield, CheckCircle, XCircle, AlertTriangle, Wrench, Play, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

interface SourceDoc {
  chunkId: string
  documentId: string
  documentTitle?: string | null
  excerpt: string
  similarity: number
}

interface IterationStep {
  type: "generate" | "test" | "fix" | "success" | "error" | "question"
  message: string
  details?: unknown
  timestamp: number
}

interface ConversationMessage {
  type: "user" | "ai" | "step"
  message: string
  stepType?: IterationStep["type"]
  details?: unknown
}

export default function NewToolPage({ params }: { params: { id: string } }) {
  const applicationId = params.id
  const router = useRouter()

  // Fetch application details
  const { data: application } = trpc.applications.get.useQuery({ id: applicationId })

  // Real mutations - using the new agentic endpoint
  const generateToolMutation = trpc.llm.generateToolWithTesting.useMutation()
  const createToolMutation = trpc.tools.createFromSpec.useMutation()

  const [intent, setIntent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([])

  const [toolDraft, setToolDraft] = useState({
    name: "",
    description: "",
    httpMethod: "GET" as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: "",
    pathParams: [] as Array<{ name: string; type: string; required: boolean; description: string }>,
    queryParams: [] as Array<{ name: string; type: string; required: boolean; description: string }>,
    requestBody: null as unknown,
    responseSchema: null as unknown,
    errorCases: [] as Array<{ code: number; description: string }>,
    isReadOnly: true,
    hasPII: false,
  })

  const [showSourceDocs, setShowSourceDocs] = useState(false)
  const [sourceDocs, setSourceDocs] = useState<SourceDoc[]>([])
  const [generatedSpec, setGeneratedSpec] = useState<Record<string, unknown> | null>(null)
  const [testPassed, setTestPassed] = useState(false)

  // Get step icon and color
  const getStepIcon = (stepType: IterationStep["type"]) => {
    switch (stepType) {
      case "generate":
        return <Sparkles className="h-4 w-4 text-purple-500" />
      case "test":
        return <Play className="h-4 w-4 text-blue-500" />
      case "fix":
        return <RefreshCw className="h-4 w-4 text-orange-500" />
      case "success":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "question":
        return <AlertTriangle className="h-4 w-4 text-amber-500" />
      default:
        return <Wrench className="h-4 w-4 text-muted-foreground" />
    }
  }

  const handleGenerateTool = async () => {
    if (!intent.trim()) {
      toast.error("Please describe the tool you want to create")
      return
    }

    setIsGenerating(true)
    setConversationHistory([
      { type: "user", message: intent },
      { type: "step", message: "Starting tool generation...", stepType: "generate" },
    ])
    setTestPassed(false)

    try {
      const result = await generateToolMutation.mutateAsync({
        applicationId,
        intent: intent.trim(),
        maxIterations: 3,
      })

      // Add all the iteration steps to the conversation
      const newMessages: ConversationMessage[] = []

      if (result.steps && Array.isArray(result.steps)) {
        for (const step of result.steps) {
          newMessages.push({
            type: "step",
            message: step.message,
            stepType: step.type,
            details: step.details,
          })
        }
      }

      setConversationHistory([
        { type: "user", message: intent },
        ...newMessages,
      ])

      if (!result.success) {
        // Handle different error types
        if (result.error === "no_environment") {
          newMessages.push({
            type: "ai",
            message: "Please add an environment to your application to enable automatic testing. You can do this in the application settings.",
          })
        } else if (result.error === "no_documentation") {
          newMessages.push({
            type: "ai",
            message: "I couldn't find any API documentation for this application. Please upload documentation first.",
          })
        } else if (result.error === "max_iterations") {
          // Still have a spec, just couldn't get tests to pass
          if (result.toolSpec) {
            newMessages.push({
              type: "ai",
              message: "I generated a tool but couldn't get the tests to pass automatically. The tool may still be correct - please review and test manually.",
            })
            processToolSpec(result.toolSpec as unknown as Record<string, unknown>)
            if (result.sources) {
              setSourceDocs(result.sources as SourceDoc[])
              setShowSourceDocs(true)
            }
            setHasGenerated(true)
          }
        }
        setConversationHistory([{ type: "user", message: intent }, ...newMessages])
        setIsGenerating(false)
        return
      }

      // Success! Map the toolSpec to our UI format
      const spec = result.toolSpec as unknown as Record<string, unknown>
      if (spec) {
        processToolSpec(spec)
        setTestPassed(true)

        // Set sources from RAG results
        if (result.sources && result.sources.length > 0) {
          setSourceDocs(result.sources as SourceDoc[])
          setShowSourceDocs(true)
        }

        setHasGenerated(true)

        newMessages.push({
          type: "ai",
          message: `Tool created and verified! It passed testing after ${result.iterations || 1} iteration${(result.iterations || 1) > 1 ? "s" : ""}. Review the draft on the right and save when ready.`,
        })

        toast.success("Tool created and tested!", {
          description: `Verified working in ${result.testResult?.durationMs || 0}ms`,
        })
      }

      setConversationHistory([{ type: "user", message: intent }, ...newMessages])
    } catch (error) {
      console.error("Failed to generate tool:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      setConversationHistory((prev) => [
        ...prev,
        {
          type: "ai",
          message: `Sorry, I encountered an error: ${errorMessage}. Please try again or simplify your request.`,
        },
      ])
    } finally {
      setIsGenerating(false)
    }
  }

  const processToolSpec = (spec: Record<string, unknown>) => {
    setGeneratedSpec(spec)

    const http = spec.http as { method?: string; path?: string } | undefined
    const inputs = spec.inputs as { path?: { properties?: Record<string, unknown>; required?: string[] }; query?: { properties?: Record<string, unknown>; required?: string[] }; body?: unknown } | undefined
    const outputs = spec.outputs as { success?: unknown; errors?: Array<{ status: number; description?: string; code?: string }> } | undefined
    const safety = spec.safety as { readOnly?: boolean; pii?: boolean } | undefined

    // Extract path params from the path template
    const pathParamMatches = http?.path?.match(/\{(\w+)\}/g) || []
    const pathParams = pathParamMatches.map((match: string) => {
      const name = match.replace(/[{}]/g, "")
      const inputSpec = inputs?.path?.properties?.[name] as { type?: string; description?: string } | undefined
      return {
        name,
        type: inputSpec?.type || "string",
        required: inputs?.path?.required?.includes(name) ?? true,
        description: inputSpec?.description || "",
      }
    })

    // Extract query params
    const queryParams = Object.entries(inputs?.query?.properties || {}).map(([name, prop]) => {
      const propTyped = prop as { type?: string; description?: string }
      return {
        name,
        type: propTyped.type || "string",
        required: inputs?.query?.required?.includes(name) ?? false,
        description: propTyped.description || "",
      }
    })

    // Extract error cases
    const errorCases = (outputs?.errors || []).map((e) => ({
      code: e.status,
      description: e.description || e.code || "",
    }))

    setToolDraft({
      name: (spec.title as string) || (spec.name as string) || "",
      description: (spec.description as string) || "",
      httpMethod: (http?.method as "GET" | "POST" | "PUT" | "PATCH" | "DELETE") || "GET",
      path: http?.path || "",
      pathParams,
      queryParams,
      requestBody: inputs?.body || null,
      responseSchema: outputs?.success || null,
      errorCases,
      isReadOnly: safety?.readOnly ?? (http?.method === "GET"),
      hasPII: safety?.pii ?? false,
    })
  }

  const handleSaveAsDraft = async () => {
    if (!generatedSpec) {
      toast.error("No tool to save. Please generate a tool first.")
      return
    }

    try {
      const spec = generatedSpec as Record<string, unknown>
      const http = spec.http as { method?: string; path?: string } | undefined
      const safety = spec.safety as { readOnly?: boolean; pii?: boolean } | undefined

      // Update the spec with any user edits and pass it directly
      const updatedSpec = {
        ...spec,
        applicationId,
        title: toolDraft.name,
        description: toolDraft.description,
        http: {
          ...http,
          method: toolDraft.httpMethod,
          path: toolDraft.path,
        },
        safety: {
          ...safety,
          readOnly: toolDraft.isReadOnly,
          pii: toolDraft.hasPII,
        },
      }

      const result = await createToolMutation.mutateAsync(updatedSpec as any)

      toast.success(testPassed ? "Tool saved and ready!" : "Tool saved as draft", {
        description: testPassed
          ? `${toolDraft.name} has been tested and is ready to publish`
          : `${toolDraft.name} can be edited and tested before publishing`,
      })

      // Navigate to the tool edit page
      router.push(`/applications/${applicationId}/tools/${result.id}/edit`)
    } catch (error) {
      console.error("Failed to save tool:", error)

      const errorMessage = error instanceof Error ? error.message : "Unknown error"

      // Check for validation errors
      if (errorMessage.includes("[") && errorMessage.includes("]")) {
        try {
          const errors = JSON.parse(errorMessage)
          toast.error("Failed to save tool", {
            description: `Validation errors: ${errors.map((e: { message: string }) => e.message).join(", ")}`,
          })
        } catch {
          toast.error("Failed to save tool", { description: errorMessage })
        }
      } else {
        toast.error("Failed to save tool", { description: errorMessage })
      }
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumb */}
        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/applications">Applications</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink href={`/applications/${applicationId}`}>{application?.name || "Application"}</BreadcrumbLink>
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
              <BreadcrumbPage>Create Tool</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Create Tool</h1>
            <p className="mt-2 text-muted-foreground">Describe what you want to do and I'll create and test the API tool for you</p>
          </div>
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_400px] gap-6">
          {/* LEFT PANEL - Conversation */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  AI Tool Builder
                </CardTitle>
                <CardDescription>
                  I'll generate, test, and fix the tool automatically
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conversation Display */}
                {conversationHistory.length > 0 && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3 max-h-[400px] overflow-y-auto">
                    {conversationHistory.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`flex gap-3 ${msg.type === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.type === "step" && (
                          <div className="flex items-start gap-2 w-full">
                            <div className="mt-0.5">{getStepIcon(msg.stepType!)}</div>
                            <div className="flex-1">
                              <p className="text-sm">{msg.message}</p>
                              {msg.details !== undefined && msg.details !== null && (
                                <pre className="mt-1 text-xs text-muted-foreground bg-muted p-2 rounded overflow-x-auto">
                                  {JSON.stringify(msg.details, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        )}
                        {msg.type === "user" && (
                          <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        )}
                        {msg.type === "ai" && (
                          <div className="bg-background border rounded-lg px-4 py-2 max-w-[80%]">
                            <p className="text-sm">{msg.message}</p>
                          </div>
                        )}
                      </div>
                    ))}
                    {isGenerating && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Working...</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Intent Input */}
                <div className="space-y-3">
                  <Label htmlFor="intent">What tool do you want to create?</Label>
                  <Textarea
                    id="intent"
                    placeholder="e.g., Get a pet by its ID from the pet store"
                    value={intent}
                    onChange={(e) => setIntent(e.target.value)}
                    rows={3}
                    disabled={isGenerating}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        handleGenerateTool()
                      }
                    }}
                  />
                </div>

                <Button onClick={handleGenerateTool} disabled={isGenerating || !intent.trim()} className="w-full">
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating and Testing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Tool
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Source Documents */}
            {showSourceDocs && sourceDocs.length > 0 && (
              <Card>
                <CardHeader
                  className="cursor-pointer"
                  onClick={() => setShowSourceDocs(!showSourceDocs)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Documentation Sources ({sourceDocs.length})
                    </CardTitle>
                    {showSourceDocs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </div>
                </CardHeader>
                {showSourceDocs && (
                  <CardContent className="space-y-3">
                    {sourceDocs.map((doc, idx) => (
                      <div key={idx} className="border-l-2 border-primary/20 pl-3 py-1">
                        <p className="text-xs font-medium">{doc.documentTitle || "Document"}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2">{doc.excerpt}</p>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {Math.round(doc.similarity * 100)}% match
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            )}
          </div>

          {/* RIGHT PANEL - Tool Preview */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tool Draft</CardTitle>
                  {testPassed && (
                    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Tested
                    </Badge>
                  )}
                </div>
                <CardDescription>
                  {hasGenerated ? "Review and edit before saving" : "Your tool will appear here"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasGenerated ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Wrench className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p>Describe your tool intent to get started</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={toolDraft.name}
                        onChange={(e) => setToolDraft({ ...toolDraft, name: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={toolDraft.description}
                        onChange={(e) => setToolDraft({ ...toolDraft, description: e.target.value })}
                        rows={2}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="method">HTTP Method</Label>
                        <Select
                          value={toolDraft.httpMethod}
                          onValueChange={(value) => setToolDraft({ ...toolDraft, httpMethod: value as any })}
                        >
                          <SelectTrigger id="method">
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
                        <Label htmlFor="path">Path</Label>
                        <Input
                          id="path"
                          value={toolDraft.path}
                          onChange={(e) => setToolDraft({ ...toolDraft, path: e.target.value })}
                          className="font-mono text-sm"
                        />
                      </div>
                    </div>

                    {toolDraft.pathParams.length > 0 && (
                      <div className="space-y-2">
                        <Label>Path Parameters</Label>
                        <div className="space-y-1">
                          {toolDraft.pathParams.map((param) => (
                            <div key={param.name} className="flex items-center gap-2 text-sm">
                              <code className="bg-muted px-2 py-0.5 rounded">{`{${param.name}}`}</code>
                              <span className="text-muted-foreground">{param.type}</span>
                              {param.required && <Badge variant="secondary" className="text-xs">required</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {toolDraft.queryParams.length > 0 && (
                      <div className="space-y-2">
                        <Label>Query Parameters</Label>
                        <div className="space-y-1">
                          {toolDraft.queryParams.map((param) => (
                            <div key={param.name} className="flex items-center gap-2 text-sm">
                              <code className="bg-muted px-2 py-0.5 rounded">{param.name}</code>
                              <span className="text-muted-foreground">{param.type}</span>
                              {param.required && <Badge variant="secondary" className="text-xs">required</Badge>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <Separator />

                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{toolDraft.isReadOnly ? "Read-only" : "Modifies data"}</span>
                      </div>
                    </div>

                    <Button onClick={handleSaveAsDraft} className="w-full" disabled={createToolMutation.isPending}>
                      {createToolMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>Save {testPassed ? "& Continue" : "as Draft"}</>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
