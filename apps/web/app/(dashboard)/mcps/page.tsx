"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { trpc } from "@/lib/trpc"
import { Plus, Server, MoreVertical, Power, PowerOff, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type McpStatus = "DRAFT" | "ACTIVE" | "DISABLED" | "ERROR"

export default function MCPDashboard() {
  const router = useRouter()
  const { data: session, status: sessionStatus } = useSession()

  const { data, isLoading, refetch } = trpc.mcps.list.useQuery()

  const enableMcp = trpc.mcps.enable.useMutation({
    onSuccess: () => refetch(),
  })

  const disableMcp = trpc.mcps.disable.useMutation({
    onSuccess: () => refetch(),
  })

  const deleteMcp = trpc.mcps.delete.useMutation({
    onSuccess: () => refetch(),
  })

  const getStatusBadgeClasses = (status: McpStatus) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
      case "DRAFT":
        return ""
      case "DISABLED":
        return ""
      case "ERROR":
        return ""
      default:
        return ""
    }
  }

  const getStatusBadgeVariant = (status: McpStatus) => {
    switch (status) {
      case "ACTIVE":
        return "default"
      case "DRAFT":
        return "secondary"
      case "DISABLED":
        return "outline"
      case "ERROR":
        return "destructive"
      default:
        return "secondary"
    }
  }

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const mcps = data?.items || []

  return (
    <div className="container mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">MCPs</h1>
          <p className="text-muted-foreground mt-1">Manage your Model Context Protocol configurations</p>
        </div>
        <Button onClick={() => router.push("/mcps/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New MCP
        </Button>
      </div>

      {/* Empty State */}
      {mcps.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-4">
              <Server className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No MCPs yet</h3>
            <p className="text-muted-foreground mb-4">Get started by creating your first MCP</p>
            <Button onClick={() => router.push("/mcps/new")}>
              <Plus className="h-4 w-4 mr-2" />
              Create MCP
            </Button>
          </CardContent>
        </Card>
      ) : (
        /* MCP Grid */
        <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {mcps.map((mcp) => (
            <Card
              key={mcp.id}
              className="group hover:shadow-lg transition-shadow cursor-pointer hover:border-primary/50"
              onClick={() => router.push(`/mcps/${mcp.id}`)}
            >
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="rounded-md bg-primary/10 p-2 shrink-0">
                      <Server className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base leading-tight">{mcp.name}</CardTitle>
                      <CardDescription className="text-xs mt-0.5">
                        by {mcp.createdBy.name || mcp.createdBy.email}
                      </CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {mcp.status !== "ACTIVE" && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); enableMcp.mutate({ id: mcp.id }); }}>
                          <Power className="h-4 w-4 mr-2" />
                          Enable
                        </DropdownMenuItem>
                      )}
                      {mcp.status === "ACTIVE" && (
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); disableMcp.mutate({ id: mcp.id }); }}>
                          <PowerOff className="h-4 w-4 mr-2" />
                          Disable
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => { e.stopPropagation(); deleteMcp.mutate({ id: mcp.id }); }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {mcp.description || "No description"}
                </p>
              </CardContent>
              <CardFooter className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge
                    variant={getStatusBadgeVariant(mcp.status)}
                    className={getStatusBadgeClasses(mcp.status)}
                  >
                    {mcp.status.toLowerCase()}
                  </Badge>
                  <Badge variant="outline">
                    {mcp.type === "DOCUMENTATION" ? "Docs" : mcp.type === "HYBRID" ? "Hybrid" : "API"}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">{mcp._count.usageEvents} calls</span>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
