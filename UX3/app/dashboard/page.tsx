"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { Plus, Server, MoreVertical, Power, PowerOff, Trash2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type MCPStatus = "active" | "draft" | "disabled" | "error"
type MCPType = "API" | "Documentation" | "Hybrid"

interface MCP {
  id: string
  name: string
  creator: string
  description: string
  status: MCPStatus
  type: MCPType
  callCount: number
}

export default function MCPDashboard() {
  const { data: session, status: sessionStatus } = useSession()
  const [mcps, setMcps] = useState<MCP[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "" as MCPType | "",
    description: "",
  })

  const handleCreateMCP = async () => {
    if (!formData.name || !formData.type) return

    setIsCreating(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const newMCP: MCP = {
      id: Math.random().toString(36).substring(7),
      name: formData.name,
      creator: session?.user?.name || "Unknown",
      description: formData.description,
      status: "draft",
      type: formData.type as MCPType,
      callCount: 0,
    }

    setMcps([...mcps, newMCP])
    setIsCreating(false)
    setIsDialogOpen(false)
    setFormData({ name: "", type: "", description: "" })
  }

  const handleToggleStatus = (id: string) => {
    setMcps(
      mcps.map((mcp) =>
        mcp.id === id ? { ...mcp, status: mcp.status === "active" ? "disabled" : ("active" as MCPStatus) } : mcp,
      ),
    )
  }

  const handleDeleteMCP = (id: string) => {
    setMcps(mcps.filter((mcp) => mcp.id !== id))
  }

  const getStatusBadgeVariant = (status: MCPStatus) => {
    switch (status) {
      case "active":
        return "default" // We'll add success variant in globals.css
      case "draft":
        return "secondary"
      case "disabled":
        return "outline"
      case "error":
        return "destructive"
    }
  }

  if (sessionStatus === "loading" || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-6 md:p-8">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">MCPs</h1>
            <p className="text-muted-foreground mt-1">Manage your Model Context Protocol configurations</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New MCP
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create MCP</DialogTitle>
                <DialogDescription>Configure a new Model Context Protocol for your team.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My MCP"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as MCPType })}
                  >
                    <SelectTrigger id="type" className="w-full">
                      <SelectValue placeholder="Select a type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="API">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">API</span>
                          <span className="text-xs text-muted-foreground">Connect to external APIs</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Documentation">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Documentation</span>
                          <span className="text-xs text-muted-foreground">Index documentation sources</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="Hybrid">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">Hybrid</span>
                          <span className="text-xs text-muted-foreground">Combine API and documentation</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Describe what this MCP does..."
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateMCP} disabled={isCreating || !formData.name || !formData.type}>
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create MCP
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create MCP
                  </Button>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>
        ) : (
          /* MCP Grid */
          <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {mcps.map((mcp) => (
              <Card key={mcp.id} className="group hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="rounded-md bg-primary/10 p-2 shrink-0">
                        <Server className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base leading-tight">{mcp.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">by {mcp.creator}</CardDescription>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {mcp.status !== "active" && (
                          <DropdownMenuItem onClick={() => handleToggleStatus(mcp.id)}>
                            <Power className="h-4 w-4 mr-2" />
                            Enable
                          </DropdownMenuItem>
                        )}
                        {mcp.status === "active" && (
                          <DropdownMenuItem onClick={() => handleToggleStatus(mcp.id)}>
                            <PowerOff className="h-4 w-4 mr-2" />
                            Disable
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDeleteMCP(mcp.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-2">{mcp.description || "No description"}</p>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={getStatusBadgeVariant(mcp.status)}
                      className={
                        mcp.status === "active"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                          : ""
                      }
                    >
                      {mcp.status}
                    </Badge>
                    <Badge variant="outline">{mcp.type}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground">{mcp.callCount} calls</span>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
