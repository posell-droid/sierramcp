"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, MoreVertical, Eye, Pencil, Power, PowerOff, Trash2, AppWindow } from "lucide-react"
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type ApplicationType = "Template" | "Custom"
type ApplicationStatus = "Draft" | "Configuring" | "Active" | "Disabled" | "Error"

interface Application {
  id: string
  name: string
  description?: string
  type: ApplicationType
  status: ApplicationStatus
  environmentsCount: number
  docsSummary: string
  toolsCount: number
  updatedAt: Date
  logoUrl?: string
}

// Stub hook - easy to replace with trpc.applications.list.useQuery()
function useApplicationsList() {
  const [data] = useState<Application[]>([
    {
      id: "1",
      name: "Customer Support Bot",
      description: "AI-powered customer support with knowledge base integration",
      type: "Template",
      status: "Active",
      environmentsCount: 3,
      docsSummary: "12 completed, 0 processing",
      toolsCount: 8,
      updatedAt: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
      logoUrl: "/customer-support-bot-icon.jpg",
    },
    {
      id: "2",
      name: "Sales Assistant",
      description: "CRM integration and lead qualification system",
      type: "Custom",
      status: "Active",
      environmentsCount: 2,
      docsSummary: "8 completed, 0 processing",
      toolsCount: 12,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      logoUrl: "/sales-assistant-icon.jpg",
    },
    {
      id: "3",
      name: "Documentation Assistant",
      description: "Technical documentation search and code examples",
      type: "Template",
      status: "Configuring",
      environmentsCount: 1,
      docsSummary: "5 completed, 2 processing",
      toolsCount: 4,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    },
    {
      id: "4",
      name: "Product Analytics",
      description: "Real-time analytics and reporting system",
      type: "Custom",
      status: "Draft",
      environmentsCount: 0,
      docsSummary: "0 completed, 0 processing",
      toolsCount: 0,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      logoUrl: "/analytics-icon.png",
    },
    {
      id: "5",
      name: "Internal Knowledge Base",
      description: "Company-wide documentation and policy search",
      type: "Custom",
      status: "Error",
      environmentsCount: 1,
      docsSummary: "15 completed, 1 processing",
      toolsCount: 6,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 12), // 12 hours ago
    },
  ])

  return {
    data,
    isLoading: false,
    error: null,
  }
}

export default function ApplicationsPage() {
  const router = useRouter()
  const { data: applications, isLoading } = useApplicationsList()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [typeFilter, setTypeFilter] = useState<string>("All")

  const handleRowClick = (id: string) => {
    router.push(`/applications/${id}`)
  }

  const handleAction = (action: string, app: Application, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent row click

    switch (action) {
      case "view":
        router.push(`/applications/${app.id}`)
        break
      case "edit":
        router.push(`/applications/${app.id}/edit`)
        break
      case "disable":
        toast.success("Application disabled", {
          description: `${app.name} has been disabled`,
        })
        break
      case "enable":
        toast.success("Application enabled", {
          description: `${app.name} has been enabled`,
        })
        break
      case "delete":
        toast.success("Application deleted", {
          description: `${app.name} has been removed`,
        })
        break
    }
  }

  // Filter applications
  const filteredApplications =
    applications?.filter((app) => {
      const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === "All" || app.status === statusFilter
      const matchesType = typeFilter === "All" || app.type === typeFilter
      return matchesSearch && matchesStatus && matchesType
    }) || []

  const getStatusBadgeVariant = (status: ApplicationStatus) => {
    switch (status) {
      case "Active":
        return "default"
      case "Draft":
        return "secondary"
      case "Configuring":
        return "outline"
      case "Disabled":
        return "outline"
      case "Error":
        return "destructive"
    }
  }

  const getTypeBadgeVariant = (type: ApplicationType) => {
    return type === "Template" ? "secondary" : "outline"
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

  // Empty state when no applications exist
  if (!applications || applications.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
              <p className="text-muted-foreground mt-1">Manage connected systems and documentation</p>
            </div>
            <Button onClick={() => router.push("/applications/new")}>
              <Plus className="mr-2 size-4" />
              New Application
            </Button>
          </div>

          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-full bg-muted p-4 mb-4">
                <AppWindow className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">No applications yet</h3>
              <p className="text-muted-foreground mb-4 max-w-md">
                Get started by creating your first application to connect systems and documentation
              </p>
              <Button onClick={() => router.push("/applications/new")}>
                <Plus className="h-4 w-4 mr-2" />
                Create Application
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
            <h1 className="text-3xl font-semibold tracking-tight">Applications</h1>
            <p className="text-muted-foreground mt-1">Manage connected systems and documentation</p>
          </div>
          <Button onClick={() => router.push("/applications/new")}>
            <Plus className="mr-2 size-4" />
            New Application
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search applications..."
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
              <SelectItem value="Configuring">Configuring</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Disabled">Disabled</SelectItem>
              <SelectItem value="Error">Error</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Types</SelectItem>
              <SelectItem value="Template">Template</SelectItem>
              <SelectItem value="Custom">Custom</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Applications Table */}
        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environments</TableHead>
                <TableHead>Docs</TableHead>
                <TableHead>Tools</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredApplications.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                    No applications found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredApplications.map((app) => (
                  <TableRow key={app.id} className="cursor-pointer" onClick={() => handleRowClick(app.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10 rounded-md">
                          <AvatarImage src={app.logoUrl || "/placeholder.svg"} />
                          <AvatarFallback className="rounded-md">
                            <AppWindow className="size-5" />
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="font-medium">{app.name}</div>
                          {app.description && (
                            <div className="text-muted-foreground text-sm line-clamp-1">{app.description}</div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getTypeBadgeVariant(app.type)}>{app.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusBadgeVariant(app.status)}
                        className={
                          app.status === "Active"
                            ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                            : ""
                        }
                      >
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{app.environmentsCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{app.docsSummary}</TableCell>
                    <TableCell className="text-muted-foreground">{app.toolsCount}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDistanceToNow(app.updatedAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => handleAction("view", app, e)}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleAction("edit", app, e)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {app.status !== "Disabled" ? (
                            <DropdownMenuItem onClick={(e) => handleAction("disable", app, e)}>
                              <PowerOff className="h-4 w-4 mr-2" />
                              Disable
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={(e) => handleAction("enable", app, e)}>
                              <Power className="h-4 w-4 mr-2" />
                              Enable
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={(e) => handleAction("delete", app, e)}
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
