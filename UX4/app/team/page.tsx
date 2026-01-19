"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { UserPlus, MoreVertical, ShieldCheck, UserCircle, Trash2, Mail, Users, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type UserRole = "owner" | "admin" | "user"
type UserStatus = "active" | "requested" | "suspended"

interface TeamMember {
  id: string
  name: string
  email: string
  role: UserRole
  status: UserStatus
  avatar?: string
  lastLoggedIn: Date | null
  joinedOn: Date
}

// Mock data for demonstration
const mockTeamMembers: TeamMember[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    email: "sarah@gatemcp.com",
    role: "owner",
    status: "active",
    avatar: "/professional-woman-diverse.png",
    lastLoggedIn: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    joinedOn: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90), // 90 days ago
  },
  {
    id: "2",
    name: "Michael Chen",
    email: "michael@gatemcp.com",
    role: "admin",
    status: "active",
    avatar: "/professional-man.jpg",
    lastLoggedIn: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    joinedOn: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60), // 60 days ago
  },
  {
    id: "3",
    name: "Emily Rodriguez",
    email: "emily@gatemcp.com",
    role: "user",
    status: "requested",
    joinedOn: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    lastLoggedIn: null,
  },
  {
    id: "4",
    name: "James Wilson",
    email: "james@gatemcp.com",
    role: "user",
    status: "active",
    avatar: "/professional-person.png",
    lastLoggedIn: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3), // 3 days ago
    joinedOn: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 30 days ago
  },
]

export default function TeamPage() {
  const { data: session } = useSession()
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(mockTeamMembers)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<UserRole>("user")

  // Determine current user's role (for permissions check)
  const currentUserRole: UserRole = "owner" // In real app, get from session
  const canManageUsers = currentUserRole === "owner" || currentUserRole === "admin"

  // Sort members: requested first, then by role
  const sortedMembers = [...teamMembers].sort((a, b) => {
    if (a.status === "requested" && b.status !== "requested") return -1
    if (a.status !== "requested" && b.status === "requested") return 1

    const roleOrder: Record<UserRole, number> = { owner: 0, admin: 1, user: 2 }
    return roleOrder[a.role] - roleOrder[b.role]
  })

  const pendingRequests = teamMembers.filter((m) => m.status === "requested")

  const handleInviteUser = async () => {
    setIsLoading(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    toast.success("Invitation sent", {
      description: `Invite sent to ${inviteEmail}`,
    })

    setIsLoading(false)
    setIsInviteDialogOpen(false)
    setInviteEmail("")
    setInviteRole("user")
  }

  const handleApproveUser = async (userId: string, role: UserRole) => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    setTeamMembers((members) =>
      members.map((m) => (m.id === userId ? { ...m, status: "active" as UserStatus, role } : m)),
    )

    const user = teamMembers.find((m) => m.id === userId)
    toast.success("User approved", {
      description: `${user?.name} has been approved as ${role}`,
    })
    setIsLoading(false)
  }

  const handleRejectUser = async (userId: string) => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    setTeamMembers((members) => members.filter((m) => m.id !== userId))

    const user = teamMembers.find((m) => m.id === userId)
    toast.success("Request rejected", {
      description: `${user?.name}'s request has been rejected`,
    })
    setIsLoading(false)
  }

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    setTeamMembers((members) => members.map((m) => (m.id === userId ? { ...m, role: newRole } : m)))

    const user = teamMembers.find((m) => m.id === userId)
    toast.success("Role updated", {
      description: `${user?.name} is now an ${newRole}`,
    })
    setIsLoading(false)
  }

  const handleRemoveUser = async (userId: string) => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    setTeamMembers((members) => members.filter((m) => m.id !== userId))

    const user = teamMembers.find((m) => m.id === userId)
    toast.success("User removed", {
      description: `${user?.name} has been removed from the team`,
    })
    setIsLoading(false)
  }

  const handleResendInvite = async (userId: string) => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 500))

    const user = teamMembers.find((m) => m.id === userId)
    toast.success("Invite resent", {
      description: `Invitation resent to ${user?.email}`,
    })
    setIsLoading(false)
  }

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case "owner":
        return "default"
      case "admin":
        return "secondary"
      case "user":
        return "outline"
    }
  }

  const getStatusBadgeVariant = (status: UserStatus) => {
    switch (status) {
      case "active":
        return "default"
      case "requested":
        return "secondary"
      case "suspended":
        return "destructive"
    }
  }

  const getStatusText = (status: UserStatus) => {
    switch (status) {
      case "active":
        return "Has access"
      case "requested":
        return "Awaiting approval"
      case "suspended":
        return "Access revoked"
    }
  }

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case "owner":
        return <ShieldCheck className="size-3.5" />
      case "admin":
        return <ShieldCheck className="size-3.5" />
      case "user":
        return <UserCircle className="size-3.5" />
    }
  }

  if (isLoading && teamMembers.length === 0) {
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

  // Empty state when only owner exists
  if (teamMembers.length === 1 && teamMembers[0].role === "owner") {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
              <p className="text-muted-foreground mt-1">Manage your team members and their permissions</p>
            </div>
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 size-4" />
                  Invite Team Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite team member</DialogTitle>
                  <DialogDescription>Send an invitation to join your GateMCP team</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div>
                            <div className="font-medium">User</div>
                            <div className="text-muted-foreground text-xs">Standard access to resources</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div>
                            <div className="font-medium">Admin</div>
                            <div className="text-muted-foreground text-xs">Can manage users and settings</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteUser} disabled={!inviteEmail}>
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="bg-card rounded-lg border p-12 text-center">
            <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-primary/10">
              <Users className="size-8 text-primary" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">Build your team</h2>
            <p className="text-muted-foreground mb-6 max-w-md mx-auto">
              You're the only team member right now. Invite colleagues to collaborate on MCPs and manage your enterprise
              workflows together.
            </p>
            <Button onClick={() => setIsInviteDialogOpen(true)}>
              <UserPlus className="mr-2 size-4" />
              Invite Team Member
            </Button>

            <div className="bg-muted/50 mt-8 rounded-lg p-4 text-left max-w-md mx-auto">
              <h3 className="mb-2 font-medium">Team roles</h3>
              <div className="text-muted-foreground space-y-2 text-sm">
                <div className="flex gap-2">
                  <ShieldCheck className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">Owner:</span> Full access including billing and user management
                  </div>
                </div>
                <div className="flex gap-2">
                  <ShieldCheck className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">Admin:</span> Can manage users and settings
                  </div>
                </div>
                <div className="flex gap-2">
                  <UserCircle className="size-4 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-medium">User:</span> Standard access to resources
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
            <p className="text-muted-foreground mt-1">Manage your team members and their permissions</p>
          </div>
          {canManageUsers && (
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 size-4" />
                  Invite Team Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite team member</DialogTitle>
                  <DialogDescription>Send an invitation to join your GateMCP team</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="colleague@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as UserRole)}>
                      <SelectTrigger id="role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">
                          <div>
                            <div className="font-medium">User</div>
                            <div className="text-muted-foreground text-xs">Standard access to resources</div>
                          </div>
                        </SelectItem>
                        <SelectItem value="admin">
                          <div>
                            <div className="font-medium">Admin</div>
                            <div className="text-muted-foreground text-xs">Can manage users and settings</div>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleInviteUser} disabled={!inviteEmail}>
                    Send Invitation
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {pendingRequests.length > 0 && (
          <div className="bg-secondary/50 mb-6 rounded-lg border border-secondary p-4">
            <h3 className="mb-3 font-medium">Pending Requests ({pendingRequests.length})</h3>
            <div className="space-y-2">
              {pendingRequests.map((member) => (
                <div key={member.id} className="bg-card flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatar || "/placeholder.svg"} />
                      <AvatarFallback>
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{member.name}</div>
                      <div className="text-muted-foreground text-sm">{member.email}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproveUser(member.id, "user")}
                      disabled={isLoading}
                    >
                      <Check className="mr-1 size-3.5" />
                      Approve as User
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleApproveUser(member.id, "admin")}
                      disabled={isLoading}
                    >
                      <Check className="mr-1 size-3.5" />
                      Approve as Admin
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectUser(member.id)}
                      disabled={isLoading}
                    >
                      <X className="mr-1 size-3.5" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Logged In</TableHead>
                <TableHead>Joined On</TableHead>
                {canManageUsers && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedMembers
                .filter((member) => member.status !== "requested")
                .map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={member.avatar || "/placeholder.svg"} />
                          <AvatarFallback>
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{member.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                        {getRoleIcon(member.role)}
                        <span className="capitalize">{member.role}</span>
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.status)}>{getStatusText(member.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {member.lastLoggedIn
                        ? formatDistanceToNow(member.lastLoggedIn, {
                            addSuffix: true,
                          })
                        : "Never"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.joinedOn.toLocaleDateString()}</TableCell>
                    {canManageUsers && (
                      <TableCell>
                        {member.role !== "owner" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="size-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {member.status === "active" && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      handleChangeRole(member.id, member.role === "admin" ? "user" : "admin")
                                    }
                                  >
                                    <ShieldCheck className="mr-2 size-4" />
                                    Change to {member.role === "admin" ? "User" : "Admin"}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleResendInvite(member.id)}>
                                    <Mail className="mr-2 size-4" />
                                    Resend Invite
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem variant="destructive" onClick={() => handleRemoveUser(member.id)}>
                                <Trash2 className="mr-2 size-4" />
                                Remove User
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
