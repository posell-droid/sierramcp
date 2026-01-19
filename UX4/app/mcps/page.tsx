"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, MoreVertical, Eye, Package, Upload, Trash2 } from "lucide-react"
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

type MCPStatus = "Draft" | "Published"

interface MCP {
  id: string
  name: string
  description: string
  toolsCount: number
  latestVersion: string
  lastUpdated: Date
  status: MCPStatus
  departmentTag?: string
}

// Stub hook - easy to replace with trpc.mcps.list.useQuery()
function useMCPsList() {
  const [data] = useState<MCP[]>([
    {
      id: "1",
      name: "Customer Support MCP",
      description: "Knowledge base search and ticket management tools for customer support teams",
      toolsCount: 8,
      latestVersion: "v1.2.0",
      lastUpdated: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      status: "Published",
      departmentTag: "Support",
    },
    {
      id: "2",
      name: "Sales Intelligence MCP",
      description: "CRM integration, lead qualification, and pipeline management",
      toolsCount: 12,
      latestVersion: "v2.1.5",
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      status: "Published",
      departmentTag: "Sales",
    },
    {
      id: "3",
      name: "DevOps Toolkit MCP",
      description: "Deployment, monitoring, and infrastructure management tools",
      toolsCount: 15,
      latestVersion: "v0.8.2",
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
      status: "Draft",
      departmentTag: "Engineering",
    },
    {
      id: "4",
      name: "Analytics MCP",
      description: "Real-time metrics, reporting, and data visualization tools",
      toolsCount: 6,
      latestVersion: "v1.0.1",
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
      status: "Published",
      departmentTag: "Analytics",
    },
    {
      id: "5",
      name: "Internal Knowledge MCP",
      description: "Company documentation, policies, and internal wiki search",
      toolsCount: 4,
      latestVersion: "v0.3.0",
      lastUpdated: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      status: "Draft",
    },
  ])

  return {
    data,
    isLoading: false,
    error: null,
  }
}

export default function MCPsPage() {
  const router = useRouter()
  const { data: mcps, isLoading } = useMCPsList()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [departmentFilter, setDepartmentFilter] = useState<string>("All")

  const handleRowClick = (id: string) => {
    router.push(`/mcps/${id}`)
  }

  const handleAction = (action: string, mcp: MCP, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent row click

    switch (action) {
      case "view":
        router.push(`/mcps/${mcp.id}`)
        break
      case "publish":
        toast.success("MCP published", {
          description: `${mcp.name} ${mcp.latestVersion} is now published`,
        })
        break
      case "delete":
        toast.success("MCP deleted", {
          description: `${mcp.name} has been removed`,
        })
        break
    }
  }

  // Filter MCPs
  const filteredMCPs =
    mcps?.filter((mcp) => {
      const matchesSearch = mcp.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "All" || mcp.status === statusFilter
      const matchesDepartment =
        departmentFilter === "All" || !mcp.departmentTag || mcp.departmentTag === departmentFilter
      return matchesSearch && matchesStatus && matchesDepartment
    }) || []

  // Get unique department tags
  const departments = Array.from(new Set(mcps?.map((mcp) => mcp.departmentTag).filter(Boolean) || []))

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

  // Empty state when no MCPs exist
  if (!mcps || mcps.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">MCPs</h1>
              <p className="text-muted-foreground mt-1">Package tools into deployable MCP servers</p>
            </div>
            <Button onClick={() => router.push("/mcps/new")}>
              <Plus className="mr-2 size-4" />
              Create MCP
            </Button>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No MCPs yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Create your first MCP to package tools into a deployable server
              </p>
              <Button onClick={() => router.push("/mcps/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create your first MCP
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
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">MCPs</h1>
            <p className="text-muted-foreground mt-1">Package tools into deployable MCP servers</p>
          </div>
          <Button onClick={() => router.push("/mcps/new")}>
            <Plus className="mr-2 size-4" />
            Create MCP
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search MCPs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Status</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
              <SelectItem value="Published">Published</SelectItem>
            </SelectContent>
          </Select>
          {departments.length > 0 && (
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* MCPs Table */}
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Tools</TableHead>
                <TableHead>Latest Version</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMCPs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    No MCPs found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredMCPs.map((mcp) => (
                  <TableRow key={mcp.id} className="cursor-pointer" onClick={() => handleRowClick(mcp.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="rounded-md bg-primary/10 p-2">
                          <Package className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium">{mcp.name}</div>
                          {mcp.departmentTag && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              {mcp.departmentTag}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground text-sm line-clamp-1 max-w-md">{mcp.description}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-muted-foreground">{mcp.toolsCount}</div>
                    </TableCell>
                    <TableCell>
                      <code className="text-sm font-mono text-muted-foreground">{mcp.latestVersion}</code>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(mcp.lastUpdated, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={mcp.status === "Published" ? "default" : "secondary"}
                        className={
                          mcp.status === "Published"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                            : ""
                        }
                      >
                        {mcp.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleAction("view", mcp, e)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {mcp.status === "Draft" && (
                            <DropdownMenuItem onClick={(e) => handleAction("publish", mcp, e)}>
                              <Upload className="h-4 w-4 mr-2" />
                              Publish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => handleAction("delete", mcp, e)}
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
