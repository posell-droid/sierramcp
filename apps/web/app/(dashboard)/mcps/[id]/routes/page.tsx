"use client"

import type React from "react"

import { useState, Suspense } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Plus,
  MoreHorizontal,
  Edit,
  Power,
  TestTube,
  CheckCircle2,
  AlertCircle,
  Slack,
  MessageSquare,
  Bot,
  Users,
  Hash,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"

// Types
type Platform = "Slack" | "Teams"
type BotProfile = {
  id: string
  name: string
  icon: string
  description: string
}

type Route = {
  id: string
  platform: Platform
  workspace: string
  channels: string[]
  botProfile: string
  deploymentTarget: string
  allowedUsersGroups: string[]
  model?: string
  enabled: boolean
}

// Stub hooks
function useMCP(id: string) {
  return {
    data: { id, name: "Finance Analytics" },
    isLoading: false,
  }
}

function useBotProfiles() {
  const [data] = useState<BotProfile[]>([
    {
      id: "1",
      name: "Finance Bot",
      icon: "💰",
      description: "Handles finance-related queries and reporting",
    },
    {
      id: "2",
      name: "Analytics Assistant",
      icon: "📊",
      description: "Provides data analytics and insights",
    },
  ])
  return { data, isLoading: false }
}

function useRoutes() {
  const [data] = useState<Route[]>([
    {
      id: "1",
      platform: "Slack",
      workspace: "acme-corp",
      channels: ["#finance", "#reports"],
      botProfile: "Finance Bot",
      deploymentTarget: "finance-prod",
      allowedUsersGroups: ["finance-team", "executives"],
      model: "gpt-4",
      enabled: true,
    },
    {
      id: "2",
      platform: "Teams",
      workspace: "Acme Corp",
      channels: ["Finance Team"],
      botProfile: "Analytics Assistant",
      deploymentTarget: "finance-staging",
      allowedUsersGroups: ["all-employees"],
      enabled: false,
    },
  ])
  return { data, isLoading: false }
}

// Breadcrumb wrapper component
function BreadcrumbNav({ mcpName, mcpId }: { mcpName: string; mcpId: string }) {
  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/mcps">MCPs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/mcps/${mcpId}`}>{mcpName}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Routes</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function RoutesPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: mcp, isLoading: mcpLoading } = useMCP(id)
  const { data: botProfiles, isLoading: profilesLoading } = useBotProfiles()
  const { data: routes, isLoading: routesLoading } = useRoutes()

  // Bot Profile Dialog state
  const [createBotDialogOpen, setCreateBotDialogOpen] = useState(false)
  const [botName, setBotName] = useState("")
  const [botIcon, setBotIcon] = useState("")
  const [botDescription, setBotDescription] = useState("")

  // Route Wizard state
  const [routeDialogOpen, setRouteDialogOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>("Slack")
  const [selectedWorkspace, setSelectedWorkspace] = useState("")
  const [selectedChannels, setSelectedChannels] = useState<string[]>([])
  const [selectedBotProfile, setSelectedBotProfile] = useState("")
  const [selectedDeployment, setSelectedDeployment] = useState("")
  const [allowedGroups, setAllowedGroups] = useState<string[]>([])
  const [newGroup, setNewGroup] = useState("")
  const [selectedModel, setSelectedModel] = useState("")

  const isLoading = mcpLoading || profilesLoading || routesLoading

  const handleCreateBotProfile = () => {
    toast.success("Bot profile created successfully")
    setCreateBotDialogOpen(false)
    resetBotForm()
  }

  const resetBotForm = () => {
    setBotName("")
    setBotIcon("")
    setBotDescription("")
  }

  const handleCreateRoute = () => {
    toast.success("Route created successfully")
    setRouteDialogOpen(false)
    resetRouteWizard()
  }

  const resetRouteWizard = () => {
    setWizardStep(1)
    setSelectedPlatform("Slack")
    setSelectedWorkspace("")
    setSelectedChannels([])
    setSelectedBotProfile("")
    setSelectedDeployment("")
    setAllowedGroups([])
    setSelectedModel("")
  }

  const handleAction = (action: string, route: Route, e: React.MouseEvent) => {
    e.stopPropagation()
    switch (action) {
      case "test":
        toast.info("Test message sent to channel")
        break
      case "edit":
        toast.info("Edit route coming soon")
        break
      case "disable":
        toast.success("Route disabled")
        break
      case "enable":
        toast.success("Route enabled")
        break
    }
  }

  const handleToggleChannel = (channel: string) => {
    setSelectedChannels((prev) => (prev.includes(channel) ? prev.filter((c) => c !== channel) : [...prev, channel]))
  }

  const handleToggleGroup = (group: string) => {
    setAllowedGroups((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]))
  }

  const handleAddGroup = () => {
    if (newGroup.trim() && !allowedGroups.includes(newGroup.trim())) {
      setAllowedGroups([...allowedGroups, newGroup.trim()])
      setNewGroup("")
    }
  }

  const canContinueStep1 = true // Platform is always selected (defaults to Slack)
  const canContinueStep2 = selectedWorkspace !== "" && selectedChannels.length > 0
  const canContinueStep3 = selectedBotProfile !== "" && selectedDeployment !== ""
  const canContinueStep4 = allowedGroups.length > 0

  // Mock data for wizard
  const workspaces = ["acme-corp", "acme-dev", "acme-staging"]
  const channels = ["#finance", "#reports", "#analytics", "#general", "#random"]
  const deployments = ["finance-prod", "finance-staging", "finance-dev"]
  const groups = ["finance-team", "executives", "analysts", "all-employees"]
  const models = ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus"]

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-64 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Breadcrumbs wrapped in Suspense */}
        <Suspense fallback={<div className="h-6 mb-6" />}>
          <BreadcrumbNav mcpName={mcp?.name || "MCP"} mcpId={id} />
        </Suspense>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Routes</h1>
          <p className="text-muted-foreground">
            Configure chat routing for Slack and Teams to connect users with your MCP deployment
          </p>
        </div>

        {/* Warning Callout */}
        <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
          <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-amber-700 dark:text-amber-300">
            If a channel has no route configured, the bot replies with setup instructions.
          </AlertDescription>
        </Alert>

        {/* Bot Profiles Section */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Bot Profiles</CardTitle>
                <CardDescription>Manage bot personalities and behavior for different use cases</CardDescription>
              </div>
              <Button onClick={() => setCreateBotDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Bot Profile
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              {botProfiles?.map((profile) => (
                <Card key={profile.id}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="text-3xl">{profile.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{profile.name}</h4>
                      <p className="text-sm text-muted-foreground">{profile.description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Routes Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Routes</CardTitle>
                <CardDescription>Active chat routes connecting users to your MCP server</CardDescription>
              </div>
              <Button onClick={() => setRouteDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Route
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {routes && routes.length > 0 ? (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Platform</TableHead>
                      <TableHead>Workspace</TableHead>
                      <TableHead>Channels</TableHead>
                      <TableHead>Bot Profile</TableHead>
                      <TableHead>Deployment</TableHead>
                      <TableHead>Allowed Users/Groups</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Enabled</TableHead>
                      <TableHead className="w-[70px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.map((route) => (
                      <TableRow key={route.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {route.platform === "Slack" ? (
                              <Slack className="h-4 w-4 text-purple-600" />
                            ) : (
                              <MessageSquare className="h-4 w-4 text-blue-600" />
                            )}
                            {route.platform}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{route.workspace}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {route.channels.slice(0, 2).map((channel) => (
                              <Badge key={channel} variant="secondary" className="text-xs">
                                {channel}
                              </Badge>
                            ))}
                            {route.channels.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{route.channels.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4 text-muted-foreground" />
                            {route.botProfile}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {route.deploymentTarget}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {route.allowedUsersGroups.slice(0, 2).map((group) => (
                              <Badge key={group} variant="secondary" className="text-xs">
                                <Users className="h-3 w-3 mr-1" />
                                {group}
                              </Badge>
                            ))}
                            {route.allowedUsersGroups.length > 2 && (
                              <Badge variant="secondary" className="text-xs">
                                +{route.allowedUsersGroups.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {route.model ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {route.model}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Default</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Switch checked={route.enabled} />
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={(e) => handleAction("test", route, e)}>
                                <TestTube className="h-4 w-4 mr-2" />
                                Test
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => handleAction("edit", route, e)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => handleAction(route.enabled ? "disable" : "enable", route, e)}
                              >
                                <Power className="h-4 w-4 mr-2" />
                                {route.enabled ? "Disable" : "Enable"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Hash className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No routes configured</h3>
                <p className="text-muted-foreground mb-4 max-w-md">
                  Add your first route to connect Slack or Teams channels to your MCP deployment
                </p>
                <Button onClick={() => setRouteDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Route
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Bot Profile Dialog */}
        <Dialog open={createBotDialogOpen} onOpenChange={setCreateBotDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Bot Profile</DialogTitle>
              <DialogDescription>Define a bot personality for your chat interface</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="bot-name">Bot Name</Label>
                <Input
                  id="bot-name"
                  placeholder="e.g., Finance Bot"
                  value={botName}
                  onChange={(e) => setBotName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-icon">Icon Emoji</Label>
                <Input
                  id="bot-icon"
                  placeholder="e.g., 💰"
                  value={botIcon}
                  onChange={(e) => setBotIcon(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bot-description">Description</Label>
                <Textarea
                  id="bot-description"
                  placeholder="Describe what this bot does..."
                  value={botDescription}
                  onChange={(e) => setBotDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateBotDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateBotProfile} disabled={!botName || !botIcon}>
                Create Profile
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Route Wizard Dialog */}
        <Dialog open={routeDialogOpen} onOpenChange={setRouteDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Route - Step {wizardStep} of 5</DialogTitle>
              <DialogDescription>
                {wizardStep === 1 && "Choose the chat platform"}
                {wizardStep === 2 && "Select workspace and channels"}
                {wizardStep === 3 && "Choose bot profile and deployment target"}
                {wizardStep === 4 && "Configure permissions"}
                {wizardStep === 5 && "Review and save"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Step 1: Platform */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <Label>Select Platform</Label>
                  <div className="grid gap-3">
                    <Card
                      className={`cursor-pointer transition-all ${
                        selectedPlatform === "Slack"
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedPlatform("Slack")}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <Slack className="h-8 w-8 text-purple-600" />
                          <div>
                            <h4 className="font-medium">Slack</h4>
                            <p className="text-sm text-muted-foreground">Connect to Slack workspace</p>
                          </div>
                        </div>
                        {selectedPlatform === "Slack" && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </CardContent>
                    </Card>
                    <Card
                      className={`cursor-pointer transition-all ${
                        selectedPlatform === "Teams"
                          ? "border-primary ring-2 ring-primary/20"
                          : "hover:border-primary/50"
                      }`}
                      onClick={() => setSelectedPlatform("Teams")}
                    >
                      <CardContent className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                          <MessageSquare className="h-8 w-8 text-blue-600" />
                          <div>
                            <h4 className="font-medium">Microsoft Teams</h4>
                            <p className="text-sm text-muted-foreground">Connect to Teams organization</p>
                          </div>
                        </div>
                        {selectedPlatform === "Teams" && <CheckCircle2 className="h-5 w-5 text-primary" />}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Step 2: Workspace + Channels */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="workspace">{selectedPlatform === "Slack" ? "Workspace" : "Organization"}</Label>
                    <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
                      <SelectTrigger id="workspace">
                        <SelectValue placeholder="Select workspace..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workspaces.map((ws) => (
                          <SelectItem key={ws} value={ws}>
                            {ws}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Channels (select multiple)</Label>
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        {channels.map((channel) => (
                          <div key={channel} className="flex items-center space-x-2">
                            <Checkbox
                              id={channel}
                              checked={selectedChannels.includes(channel)}
                              onCheckedChange={() => handleToggleChannel(channel)}
                            />
                            <label
                              htmlFor={channel}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {channel}
                            </label>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <p className="text-xs text-muted-foreground">
                      Selected: {selectedChannels.length} channel{selectedChannels.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 3: Bot Profile + Deployment */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bot-profile">Bot Profile</Label>
                    <Select value={selectedBotProfile} onValueChange={setSelectedBotProfile}>
                      <SelectTrigger id="bot-profile">
                        <SelectValue placeholder="Select bot profile..." />
                      </SelectTrigger>
                      <SelectContent>
                        {botProfiles?.map((profile) => (
                          <SelectItem key={profile.id} value={profile.name}>
                            <div className="flex items-center gap-2">
                              <span>{profile.icon}</span>
                              <span>{profile.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="deployment">Deployment Target</Label>
                    <Select value={selectedDeployment} onValueChange={setSelectedDeployment}>
                      <SelectTrigger id="deployment">
                        <SelectValue placeholder="Select deployment..." />
                      </SelectTrigger>
                      <SelectContent>
                        {deployments.map((dep) => (
                          <SelectItem key={dep} value={dep}>
                            {dep}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="model">Model Override (optional)</Label>
                    <Select value={selectedModel} onValueChange={setSelectedModel}>
                      <SelectTrigger id="model">
                        <SelectValue placeholder="Use default model..." />
                      </SelectTrigger>
                      <SelectContent>
                        {models.map((model) => (
                          <SelectItem key={model} value={model}>
                            {model}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Leave empty to use deployment default</p>
                  </div>
                </div>
              )}

              {/* Step 4: Permissions */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Allowed Groups/Users</Label>
                    <Card>
                      <CardContent className="p-3 space-y-2">
                        {groups.map((group) => (
                          <div key={group} className="flex items-center space-x-2">
                            <Checkbox
                              id={group}
                              checked={allowedGroups.includes(group)}
                              onCheckedChange={() => handleToggleGroup(group)}
                            />
                            <label
                              htmlFor={group}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                            >
                              {group}
                            </label>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                    <p className="text-xs text-muted-foreground">
                      Selected: {allowedGroups.length} group{allowedGroups.length !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Add Custom Group/User</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter group or user email..."
                        value={newGroup}
                        onChange={(e) => setNewGroup(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            handleAddGroup()
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={handleAddGroup}>
                        Add
                      </Button>
                    </div>
                  </div>

                  {allowedGroups.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {allowedGroups.map((group) => (
                        <Badge key={group} variant="secondary">
                          {group}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Step 5: Review */}
              {wizardStep === 5 && (
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Route Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform:</span>
                        <div className="flex items-center gap-2">
                          {selectedPlatform === "Slack" ? (
                            <Slack className="h-4 w-4 text-purple-600" />
                          ) : (
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                          )}
                          <span className="font-medium">{selectedPlatform}</span>
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Workspace:</span>
                        <span className="font-medium">{selectedWorkspace}</span>
                      </div>
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">Channels:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                          {selectedChannels.map((ch) => (
                            <Badge key={ch} variant="secondary" className="text-xs">
                              {ch}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bot Profile:</span>
                        <span className="font-medium">{selectedBotProfile}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Deployment:</span>
                        <Badge variant="outline" className="font-mono text-xs">
                          {selectedDeployment}
                        </Badge>
                      </div>
                      {selectedModel && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Model:</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {selectedModel}
                          </Badge>
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <span className="text-muted-foreground">Allowed:</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-xs">
                          {allowedGroups.map((group) => (
                            <Badge key={group} variant="secondary" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {group}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Alert className="border-blue-500/50 bg-blue-500/10">
                    <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-700 dark:text-blue-300">
                      Your route will be active immediately after creation. Users in the allowed groups will be able to
                      interact with the bot in the selected channels.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>

            <DialogFooter>
              <div className="flex justify-between w-full">
                <div>
                  {wizardStep > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => setWizardStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4 | 5)}
                    >
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setRouteDialogOpen(false)}>
                    Cancel
                  </Button>
                  {wizardStep < 5 ? (
                    <Button
                      onClick={() => setWizardStep((s) => Math.min(5, s + 1) as 1 | 2 | 3 | 4 | 5)}
                      disabled={
                        (wizardStep === 1 && !canContinueStep1) ||
                        (wizardStep === 2 && !canContinueStep2) ||
                        (wizardStep === 3 && !canContinueStep3) ||
                        (wizardStep === 4 && !canContinueStep4)
                      }
                    >
                      Continue
                    </Button>
                  ) : (
                    <Button onClick={handleCreateRoute}>Save Route</Button>
                  )}
                </div>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
