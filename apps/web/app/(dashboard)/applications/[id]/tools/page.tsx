"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, MoreVertical, Pencil, Trash2, TestTube, Wrench } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { ChevronRight } from "lucide-react"
import { trpc } from "@/lib/trpc"

type ToolStatus = "Draft" | "Published"
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH"
type SafetyLevel = "Read-only" | "Write"

interface Tool {
  id: string
  name: string
  httpMethod: HttpMethod
  endpointPath: string
  status: ToolStatus
  safety: SafetyLevel
  updatedAt: Date
}

function ToolsBreadcrumb({ applicationId, applicationName }: { applicationId: string; applicationName?: string }) {
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
          <BreadcrumbPage>Tools</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function ToolsListPage({ params }: { params: { id: string } }) {
  const applicationId = params.id
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")

  // Fetch real data from tRPC
  const { data: application } = trpc.applications.get.useQuery({ id: applicationId })
  const { data: toolsData, isLoading, refetch } = trpc.tools.list.useQuery({ applicationId })
  const deleteMutation = trpc.tools.delete.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  // Map backend data to our Tool interface
  const toolItems = toolsData?.items ?? []
  const tools: Tool[] = toolItems.map((t) => {
    const spec = t.spec as { http?: { method?: string; path?: string }; safety?: { readOnly?: boolean } } | null
    return {
      id: t.id,
      name: t.title || t.name,
      httpMethod: (spec?.http?.method || "GET") as HttpMethod,
      endpointPath: spec?.http?.path || "/",
      status: (t.status === "PUBLISHED" ? "Published" : "Draft") as ToolStatus,
      safety: (spec?.safety?.readOnly !== false ? "Read-only" : "Write") as SafetyLevel,
      updatedAt: new Date(t.updatedAt),
    }
  })

  const handleRowClick = (toolId: string) => {
    router.push(`/applications/${applicationId}/tools/${toolId}/edit`)
  }

  const handleAction = async (action: string, tool: Tool, event: React.MouseEvent) => {
    event.stopPropagation()

    switch (action) {
      case "edit":
        router.push(`/applications/${applicationId}/tools/${tool.id}/edit`)
        break
      case "test":
        toast.success("Test started", {
          description: `Running test for ${tool.name}`,
        })
        break
      case "publish":
        toast.success("Tool published", {
          description: `${tool.name} is now published`,
        })
        break
      case "delete":
        try {
          await deleteMutation.mutateAsync({ id: tool.id })
          toast.success("Tool deleted", {
            description: `${tool.name} has been removed`,
          })
        } catch (error) {
          toast.error("Failed to delete tool", {
            description: error instanceof Error ? error.message : "Unknown error",
          })
        }
        break
    }
  }

  const filteredTools = tools?.filter((tool) => tool.name.toLowerCase().includes(searchTerm.toLowerCase())) || []

  const getHttpMethodColor = (method: HttpMethod) => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-10 w-48 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  if (!tools || tools.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<div className="h-6 mb-6" />}>
            <div className="mb-6">
              <ToolsBreadcrumb applicationId={applicationId} applicationName={application?.name} />
            </div>
          </Suspense>

          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
              <p className="text-muted-foreground mt-1">API tools generated from your application's documentation</p>
            </div>
            <Button onClick={() => router.push(`/applications/${applicationId}/tools/new`)}>
              <Plus className="mr-2 size-4" />
              Create Tool
            </Button>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No tools yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Create your first tool from API documentation using natural language.
              </p>
              <Button onClick={() => router.push(`/applications/${applicationId}/tools/new`)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Tool
              </Button>
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
            <ToolsBreadcrumb applicationId={applicationId} applicationName={application?.name} />
          </div>
        </Suspense>

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
            <p className="text-muted-foreground mt-1">API tools generated from your application's documentation</p>
          </div>
          <Button onClick={() => router.push(`/applications/${params.id}/tools/new`)}>
            <Plus className="mr-2 size-4" />
            Create Tool
          </Button>
        </div>

        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool Name</TableHead>
                <TableHead>HTTP Method</TableHead>
                <TableHead>Endpoint Path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Safety</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No tools found matching your search
                  </TableCell>
                </TableRow>
              ) : (
                filteredTools.map((tool) => (
                  <TableRow
                    key={tool.id}
                    className="cursor-pointer"
                    onClick={() => handleRowClick(tool.id)}
                    style={{ opacity: tool.status === "Draft" ? 0.7 : 1 }}
                  >
                    <TableCell>
                      <div className="font-medium">{tool.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getHttpMethodColor(tool.httpMethod)}>
                        {tool.httpMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm text-muted-foreground font-mono">{tool.endpointPath}</code>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={tool.status === "Published" ? "default" : "secondary"}
                        className={
                          tool.status === "Published"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                            : ""
                        }
                      >
                        {tool.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {tool.safety}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(tool.updatedAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleAction("edit", tool, e)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleAction("test", tool, e)}>
                            <TestTube className="h-4 w-4 mr-2" />
                            Test
                          </DropdownMenuItem>
                          {tool.status === "Draft" && (
                            <DropdownMenuItem onClick={(e) => handleAction("publish", tool, e)}>
                              <Plus className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => handleAction("delete", tool, e)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
