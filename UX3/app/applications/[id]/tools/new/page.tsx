"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sparkles, Loader2, FileText, ChevronDown, ChevronRight, Shield } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

function useCreateTool() {
  const mutateAsync = async (payload: any) => {
    console.log("[v0] Creating tool:", payload)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return { id: `tool_${Math.random().toString(36).substring(7)}` }
  }

  return {
    mutateAsync,
    isPending: false,
  }
}

export default function NewToolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: applicationId } = use(params)
  const router = useRouter()
  const { mutateAsync: createTool, isPending } = useCreateTool()

  const [intent, setIntent] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [hasGenerated, setHasGenerated] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<Array<{ type: "user" | "ai"; message: string }>>([])
  const [refinementInput, setRefinementInput] = useState("")

  const [toolDraft, setToolDraft] = useState({
    name: "",
    description: "",
    httpMethod: "GET" as "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
    path: "",
    pathParams: [] as Array<{ name: string; type: string; required: boolean; description: string }>,
    queryParams: [] as Array<{ name: string; type: string; required: boolean; description: string }>,
    requestBody: null as any,
    responseSchema: null as any,
    errorCases: [] as Array<{ code: number; description: string }>,
    isReadOnly: true,
    hasPII: false,
  })

  const [showSourceDocs, setShowSourceDocs] = useState(false)
  const [sourceDocs] = useState([
    { endpoint: "/api/customers/{id}", snippet: "Retrieve a customer by their unique identifier..." },
    { endpoint: "/api/customers", snippet: "Returns paginated list of customers with filtering options..." },
  ])

  const handleGenerateTool = async () => {
    if (!intent.trim()) {
      toast.error("Please describe the tool you want to create")
      return
    }

    setIsGenerating(true)
    setConversationHistory([{ type: "user", message: intent }])

    // Simulate AI search and generation
    await new Promise((resolve) => setTimeout(resolve, 800))
    setConversationHistory((prev) => [...prev, { type: "ai", message: "Searching documentation..." }])

    await new Promise((resolve) => setTimeout(resolve, 1200))
    setConversationHistory((prev) => [
      ...prev,
      { type: "ai", message: "Found relevant endpoints. Generating tool definition..." },
    ])

    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Generate mock tool draft
    setToolDraft({
      name: "Get Customer by ID",
      description:
        "Retrieves detailed customer information including contact details, account status, and preferences using their unique identifier.",
      httpMethod: "GET",
      path: "/customers/{id}",
      pathParams: [
        {
          name: "id",
          type: "string",
          required: true,
          description: "Unique customer identifier",
        },
      ],
      queryParams: [
        {
          name: "expand",
          type: "string",
          required: false,
          description: "Comma-separated list of related resources to include",
        },
      ],
      requestBody: null,
      responseSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
          status: { type: "string" },
        },
      },
      errorCases: [
        { code: 404, description: "Customer not found" },
        { code: 403, description: "Insufficient permissions" },
      ],
      isReadOnly: true,
      hasPII: true,
    })

    setHasGenerated(true)
    setIsGenerating(false)
    setConversationHistory((prev) => [
      ...prev,
      { type: "ai", message: "Tool generated successfully. Review the draft on the right." },
    ])
  }

  const handleRefineTool = async () => {
    if (!refinementInput.trim()) return

    setIsGenerating(true)
    setConversationHistory((prev) => [...prev, { type: "user", message: refinementInput }])
    setRefinementInput("")

    await new Promise((resolve) => setTimeout(resolve, 1500))
    setConversationHistory((prev) => [...prev, { type: "ai", message: "Tool updated based on your feedback." }])
    setIsGenerating(false)

    toast.success("Tool refined", { description: "Check the updated draft on the right" })
  }

  const handleSaveAsDraft = async () => {
    if (!toolDraft.name || !toolDraft.path) {
      toast.error("Please complete the required fields")
      return
    }

    try {
      const result = await createTool({
        applicationId,
        ...toolDraft,
        status: "DRAFT",
      })

      toast.success("Tool saved as draft", {
        description: `${toolDraft.name} can be edited and tested before publishing`,
      })

      router.push(`/applications/${applicationId}/tools/${result.id}`)
    } catch (error) {
      toast.error("Failed to save tool")
    }
  }

  const handleDiscard = () => {
    router.push(`/applications/${applicationId}/tools`)
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/applications/${applicationId}/tools`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Create Tool</h1>
              <p className="text-muted-foreground mt-1">
                Describe what you need and we'll generate the tool definition
              </p>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* LEFT PANEL - Intent & AI Assist */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Describe the tool you want</CardTitle>
                <CardDescription>We'll use your uploaded API documentation to generate a tool</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Intent Input */}
                {!hasGenerated && (
                  <>
                    <Textarea
                      placeholder={`Get customer by ID\nList invoices for an account\nCreate a support ticket`}
                      value={intent}
                      onChange={(e) => setIntent(e.target.value)}
                      rows={6}
                      className="resize-none"
                      disabled={isGenerating}
                    />
                    <Button onClick={handleGenerateTool} disabled={isGenerating || !intent.trim()} className="w-full">
                      {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Tool
                    </Button>
                  </>
                )}

                {/* Conversation History */}
                {hasGenerated && (
                  <div className="space-y-4">
                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {conversationHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-lg text-sm ${
                            item.type === "user" ? "bg-primary/10 text-foreground" : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <p className="font-medium text-xs mb-1">{item.type === "user" ? "You" : "AI"}</p>
                          <p>{item.message}</p>
                        </div>
                      ))}
                    </div>

                    <Separator />

                    {/* Refinement Input */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Refine the tool...</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g., Add a filter parameter for status"
                          value={refinementInput}
                          onChange={(e) => setRefinementInput(e.target.value)}
                          disabled={isGenerating}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault()
                              handleRefineTool()
                            }
                          }}
                        />
                        <Button onClick={handleRefineTool} disabled={isGenerating || !refinementInput.trim()} size="sm">
                          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send"}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - Tool Draft */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Tool Draft</CardTitle>
                  {hasGenerated && (
                    <div className="flex gap-2">
                      {toolDraft.isReadOnly && (
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="mr-1 h-3 w-3" />
                          Read-only
                        </Badge>
                      )}
                      {toolDraft.hasPII && (
                        <Badge variant="outline" className="text-xs">
                          PII
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                <CardDescription>
                  {hasGenerated
                    ? "Review and edit the generated tool definition"
                    : "Generate a tool to see the draft here"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {!hasGenerated && (
                  <div className="py-12 text-center text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Tool draft will appear here after generation</p>
                  </div>
                )}

                {hasGenerated && (
                  <>
                    {/* Editable Fields */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="toolName">Tool Name</Label>
                        <Input
                          id="toolName"
                          value={toolDraft.name}
                          onChange={(e) => setToolDraft({ ...toolDraft, name: e.target.value })}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="toolDescription">Description</Label>
                        <Textarea
                          id="toolDescription"
                          value={toolDraft.description}
                          onChange={(e) => setToolDraft({ ...toolDraft, description: e.target.value })}
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="httpMethod">HTTP Method</Label>
                          <Select
                            value={toolDraft.httpMethod}
                            onValueChange={(value) => setToolDraft({ ...toolDraft, httpMethod: value as any })}
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
                          <Label htmlFor="endpointPath">Endpoint Path</Label>
                          <Input
                            id="endpointPath"
                            value={toolDraft.path}
                            onChange={(e) => setToolDraft({ ...toolDraft, path: e.target.value })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-muted-foreground text-xs">Authentication</Label>
                        <p className="text-sm bg-muted p-2 rounded">Inherited from environment</p>
                      </div>
                    </div>

                    <Separator />

                    {/* Inputs */}
                    <div className="space-y-3">
                      <h3 className="font-medium text-sm">Inputs</h3>
                      {toolDraft.pathParams.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Path Parameters</p>
                          {toolDraft.pathParams.map((param, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded">
                              <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">
                                {param.name}
                              </code>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">{param.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Type: {param.type} {param.required && "• Required"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {toolDraft.queryParams.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">Query Parameters</p>
                          {toolDraft.queryParams.map((param, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-sm bg-muted/50 p-2 rounded">
                              <code className="font-mono text-xs bg-background px-1.5 py-0.5 rounded">
                                {param.name}
                              </code>
                              <div className="flex-1">
                                <p className="text-xs text-muted-foreground">{param.description}</p>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  Type: {param.type} {param.required && "• Required"}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <Separator />

                    {/* Outputs */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">Outputs</h3>
                      </div>
                      <div className="space-y-2">
                        <details className="group">
                          <summary className="flex items-center gap-2 cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                            <ChevronRight className="h-4 w-4 group-open:rotate-90 transition-transform" />
                            Success Response Schema
                          </summary>
                          <pre className="mt-2 p-3 bg-muted/50 rounded text-xs overflow-x-auto font-mono">
                            {JSON.stringify(toolDraft.responseSchema, null, 2)}
                          </pre>
                        </details>

                        {toolDraft.errorCases.length > 0 && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Error Cases</p>
                            {toolDraft.errorCases.map((error, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs bg-muted/50 p-2 rounded">
                                <Badge variant="outline" className="text-xs">
                                  {error.code}
                                </Badge>
                                <span className="text-muted-foreground">{error.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <Separator />

                    {/* Source Documentation */}
                    <div className="space-y-2">
                      <button
                        onClick={() => setShowSourceDocs(!showSourceDocs)}
                        className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                      >
                        {showSourceDocs ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        Source Documentation
                      </button>

                      {showSourceDocs && (
                        <div className="space-y-2 pl-6">
                          {sourceDocs.map((doc, idx) => (
                            <div key={idx} className="space-y-1 text-xs">
                              <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{doc.endpoint}</code>
                              <p className="text-muted-foreground">{doc.snippet}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Footer Actions */}
            {hasGenerated && (
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleDiscard} disabled={isPending}>
                  Discard
                </Button>
                <Button onClick={handleSaveAsDraft} disabled={isPending} className="flex-1">
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save as Draft
                </Button>
                <Button disabled className="flex-1">
                  Publish
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
