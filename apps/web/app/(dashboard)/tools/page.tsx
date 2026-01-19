"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Search, MoreVertical, Eye, Pencil, Trash2, TestTube, Wrench, ExternalLink } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { trpc } from "@/lib/trpc"

type ToolStatus = "DRAFT" | "TESTED" | "PUBLISHED" | "DEPRECATED"

function getStatusBadgeVariant(status: ToolStatus) {
  switch (status) {
    case "PUBLISHED":
      return "default"
    case "DRAFT":
      return "secondary"
    case "TESTED":
      return "outline"
    case "DEPRECATED":
      return "outline"
  }
}

function getStatusBadgeClass(status: ToolStatus) {
  if (status === "PUBLISHED") {
    return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
  }
  return ""
}

export default function ToolsListPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")

  // Fetch all applications with their tools
  const { data: applications, isLoading } = trpc.applications.list.useQuery()

  // Flatten tools from all applications
  const allTools = applications?.items?.flatMap((app) =>
    (app.tools || []).map((tool) => ({
      ...tool,
      applicationId: app.id,
      applicationName: app.name,
    }))
  ) || []

  // Filter tools
  const filteredTools = allTools.filter((tool) => {
    const matchesSearch =
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.applicationName.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "all" || tool.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const deleteTool = trpc.tools.delete.useMutation({
    onSuccess: () => {
      toast.success("Tool deleted")
    },
    onError: (error) => {
      toast.error("Failed to delete tool", { description: error.message })
    },
  })

  const handleAction = (action: string, tool: typeof allTools[0], event: React.MouseEvent) => {
    event.stopPropagation()

    switch (action) {
      case "view":
        router.push(`/applications/${tool.applicationId}/tools/${tool.id}`)
        break
      case "edit":
        router.push(`/applications/${tool.applicationId}/tools/${tool.id}/edit`)
        break
      case "test":
        toast.info("Test runner opening...", {
          description: `Running test for ${tool.title}`,
        })
        router.push(`/applications/${tool.applicationId}/tools/${tool.id}/edit`)
        break
      case "delete":
        if (tool.status !== "DRAFT") {
          toast.error("Cannot delete published tool", {
            description: "Only draft tools can be deleted",
          })
          return
        }
        deleteTool.mutate({ id: tool.id })
        break
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

  if (allTools.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
              <p className="text-muted-foreground mt-1">
                API tools for your AI agents to interact with external services
              </p>
            </div>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No tools created yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Tools are created within applications. Create an application first, then add tools to it.
              </p>
              <Button onClick={() => router.push("/applications")}>
                <Plus className="h-4 w-4 mr-2" />
                Go to Applications
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Tools</h1>
            <p className="text-muted-foreground mt-1">
              All tools across your applications
            </p>
          </div>
        </div>

        <div className="mb-6 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tools or applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="TESTED">Tested</SelectItem>
              <SelectItem value="PUBLISHED">Published</SelectItem>
              <SelectItem value="DEPRECATED">Deprecated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tool</TableHead>
                <TableHead>Application</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No tools found matching your search
                  </TableCell>
                </TableRow>
              ) : (
                filteredTools.map((tool) => (
                  <TableRow
                    key={tool.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/applications/${tool.applicationId}/tools/${tool.id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{tool.title}</div>
                        <div className="text-xs text-muted-foreground font-mono">{tool.name}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/applications/${tool.applicationId}`}
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {tool.applicationName}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">
                        {tool.httpMethod}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(tool.status as ToolStatus)}
                        className={getStatusBadgeClass(tool.status as ToolStatus)}
                      >
                        {tool.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(new Date(tool.updatedAt), { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleAction("view", tool, e)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleAction("edit", tool, e)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleAction("test", tool, e)}>
                            <TestTube className="h-4 w-4 mr-2" />
                            Test
                          </DropdownMenuItem>
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
