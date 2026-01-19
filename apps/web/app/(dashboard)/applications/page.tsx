"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Plus, Search, MoreVertical, Eye, Pencil, Power, PowerOff, Trash2, AppWindow, Loader2 } from "lucide-react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { trpc } from "@/lib/trpc"

type ApplicationStatus = "DRAFT" | "CONFIGURING" | "ACTIVE" | "DISABLED" | "ERROR"

interface Application {
  id: string
  name: string
  description: string | null
  logoUrl: string | null
  status: ApplicationStatus
  updatedAt: string | Date
  template: {
    name: string
    category: string
    logoUrl: string | null
  } | null
  _count: {
    environments: number
    documents: number
    tools: number
  }
}

export default function ApplicationsPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("All")
  const [typeFilter, setTypeFilter] = useState<string>("All")
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [applicationToDelete, setApplicationToDelete] = useState<Application | null>(null)

  const { data: applicationsData, isLoading, refetch } = trpc.applications.list.useQuery()

  const activateApplication = trpc.applications.activate.useMutation({
    onSuccess: () => {
      refetch()
      toast.success("Application enabled")
    },
  })

  const disableApplication = trpc.applications.disable.useMutation({
    onSuccess: () => {
      refetch()
      toast.success("Application disabled")
    },
  })

  const deleteApplication = trpc.applications.delete.useMutation({
    onSuccess: () => {
      refetch()
      setIsDeleteDialogOpen(false)
      setApplicationToDelete(null)
      toast.success("Application deleted")
    },
    onError: (error) => {
      toast.error("Failed to delete application", {
        description: error.message,
      })
    },
  })

  const applications = applicationsData?.items || []

  const handleRowClick = (id: string) => {
    router.push(`/applications/${id}`)
  }

  const handleAction = (action: string, app: Application, event: React.MouseEvent) => {
    event.stopPropagation()

    switch (action) {
      case "view":
        router.push(`/applications/${app.id}`)
        break
      case "edit":
        router.push(`/applications/${app.id}/edit`)
        break
      case "disable":
        disableApplication.mutate({ id: app.id })
        break
      case "enable":
        activateApplication.mutate({ id: app.id })
        break
      case "delete":
        setApplicationToDelete(app)
        setIsDeleteDialogOpen(true)
        break
    }
  }

  // Filter applications
  const filteredApplications = applications.filter((app: Application) => {
    const matchesSearch = app.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === "All" || app.status === statusFilter.toUpperCase()
    const appType = app.template ? "Template" : "Custom"
    const matchesType = typeFilter === "All" || appType === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const getStatusBadgeVariant = (status: ApplicationStatus) => {
    switch (status) {
      case "ACTIVE":
        return "default"
      case "DRAFT":
        return "secondary"
      case "CONFIGURING":
        return "outline"
      case "DISABLED":
        return "outline"
      case "ERROR":
        return "destructive"
    }
  }

  const getTypeBadgeVariant = (hasTemplate: boolean) => {
    return hasTemplate ? "secondary" : "outline"
  }

  const formatStatus = (status: ApplicationStatus) => {
    return status.charAt(0) + status.slice(1).toLowerCase()
  }

  // Build document summary string
  const getDocsSummary = (app: Application) => {
    const count = app._count.documents
    return `${count} doc${count !== 1 ? "s" : ""}`
  }

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Empty state when no applications exist
  if (!applications || applications.length === 0) {
    return (
      <div className="container mx-auto">
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
    )
  }

  return (
    <div className="container mx-auto">
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
              filteredApplications.map((app: Application) => (
                <TableRow key={app.id} className="cursor-pointer" onClick={() => handleRowClick(app.id)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="size-10 rounded-md">
                        <AvatarImage src={app.logoUrl || app.template?.logoUrl || "/placeholder.svg"} />
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
                    <Badge variant={getTypeBadgeVariant(!!app.template)}>
                      {app.template ? "Template" : "Custom"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={getStatusBadgeVariant(app.status)}
                      className={
                        app.status === "ACTIVE"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                          : ""
                      }
                    >
                      {formatStatus(app.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{app._count.environments}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{getDocsSummary(app)}</TableCell>
                  <TableCell className="text-muted-foreground">{app._count.tools}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDistanceToNow(new Date(app.updatedAt), { addSuffix: true })}
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
                        {app.status !== "DISABLED" ? (
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

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Application</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Are you sure you want to delete <strong>{applicationToDelete?.name}</strong>? This action cannot be undone.
                </p>
                {applicationToDelete && (applicationToDelete._count.environments > 0 || applicationToDelete._count.documents > 0 || applicationToDelete._count.tools > 0) && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
                    <p className="font-medium text-destructive mb-2">The following items will also be deleted:</p>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      {applicationToDelete._count.environments > 0 && (
                        <li>• {applicationToDelete._count.environments} environment{applicationToDelete._count.environments !== 1 ? "s" : ""} (including credentials)</li>
                      )}
                      {applicationToDelete._count.documents > 0 && (
                        <li>• {applicationToDelete._count.documents} document{applicationToDelete._count.documents !== 1 ? "s" : ""} (and all embeddings)</li>
                      )}
                      {applicationToDelete._count.tools > 0 && (
                        <li>• {applicationToDelete._count.tools} tool{applicationToDelete._count.tools !== 1 ? "s" : ""}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setApplicationToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => applicationToDelete && deleteApplication.mutate({ id: applicationToDelete.id })}
              disabled={deleteApplication.isPending}
            >
              {deleteApplication.isPending ? "Deleting..." : "Delete Application"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
