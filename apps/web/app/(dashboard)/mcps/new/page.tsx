"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { ArrowLeft, ChevronRight, Info, Loader2, Server, FileText, Layers } from "lucide-react"

type McpType = "API" | "DOCUMENTATION" | "HYBRID"

const mcpTypes: { value: McpType; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: "API",
    label: "API",
    description: "Connect to external APIs and services",
    icon: <Server className="h-5 w-5" />,
  },
  {
    value: "DOCUMENTATION",
    label: "Documentation",
    description: "Index and search documentation sources",
    icon: <FileText className="h-5 w-5" />,
  },
  {
    value: "HYBRID",
    label: "Hybrid",
    description: "Combine API tools with documentation",
    icon: <Layers className="h-5 w-5" />,
  },
]

export default function CreateMCPPage() {
  const router = useRouter()

  // Form state
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<McpType | "">("")

  const createMcp = trpc.mcps.create.useMutation({
    onSuccess: (data) => {
      toast.success("MCP created", {
        description: "Now configure your MCP with tools and settings",
      })
      router.push(`/mcps/${data.id}`)
    },
    onError: (error) => {
      toast.error("Failed to create MCP", {
        description: error.message,
      })
    },
  })

  const canCreate = name.trim().length > 0 && name.length <= 255 && type !== ""

  const handleCreate = () => {
    if (!canCreate || !type) return
    createMcp.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      type: type as McpType,
    })
  }

  return (
    <div className="container mx-auto max-w-3xl">
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
            <BreadcrumbPage>Create MCP</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/mcps")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Create New MCP</h1>
            <p className="text-muted-foreground mt-1">
              Configure a Model Context Protocol for your team
            </p>
          </div>
        </div>
      </div>

      {/* Form Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>MCP Details</CardTitle>
              <CardDescription>
                Define the basic information for your MCP
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => router.push("/mcps")}>
              Cancel
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              placeholder="e.g., Customer Support MCP"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
            <p className="text-xs text-muted-foreground">
              {name.length}/255 characters. Choose a descriptive name for your MCP.
            </p>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">
              Type <span className="text-destructive">*</span>
            </Label>
            <Select value={type} onValueChange={(v) => setType(v as McpType)}>
              <SelectTrigger id="type">
                <SelectValue placeholder="Select MCP type" />
              </SelectTrigger>
              <SelectContent>
                {mcpTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      {t.icon}
                      <div>
                        <span className="font-medium">{t.label}</span>
                        <span className="text-muted-foreground ml-2 text-xs">{t.description}</span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe what this MCP does and when to use it..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>

          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Info className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-700 dark:text-blue-400">
              After creating your MCP, you can add tools and configure deployments on the detail page.
            </AlertDescription>
          </Alert>

          {/* Actions */}
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={handleCreate} disabled={!canCreate || createMcp.isPending}>
              {createMcp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create MCP
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
