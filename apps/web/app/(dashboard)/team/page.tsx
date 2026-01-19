"use client"

import { useState } from "react"
import { UserPlus, MoreVertical, ShieldCheck, UserCircle, Trash2, Mail, Users, Check, X, Loader2, AlertCircle, UserCheck, UserX } from "lucide-react"
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
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"
import { trpc } from "@/lib/trpc"

type DbRole = "OWNER" | "ADMIN" | "MEMBER" | "READONLY"
type DbStatus = "ACTIVE" | "INVITED" | "SUSPENDED"

interface OwnershipTransferInfo {
  userId: string
  userName: string
  mcpCount: number
  applicationCount: number
  toolCount: number
}

export default function TeamPage() {
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState<"ADMIN" | "MEMBER" | "READONLY">("MEMBER")
  const [ownershipTransfer, setOwnershipTransfer] = useState<OwnershipTransferInfo | null>(null)

  // Get current user to check permissions
  const { data: currentUser, isLoading: isLoadingUser } = trpc.users.me.useQuery()

  // Get team members
  const { data: teamMembers, isLoading: isLoadingTeam, error: teamError, refetch: refetchTeam } = trpc.users.list.useQuery()

  // Get pending invitations
  const { data: invitations, refetch: refetchInvitations } = trpc.users.listInvitations.useQuery(undefined, {
    enabled: currentUser?.role === "OWNER" || currentUser?.role === "ADMIN",
  })

  // Get pending join requests
  const { data: joinRequests, refetch: refetchJoinRequests } = trpc.users.listJoinRequests.useQuery(undefined, {
    enabled: currentUser?.role === "OWNER" || currentUser?.role === "ADMIN",
  })

  // Mutations
  const inviteUser = trpc.users.invite.useMutation({
    onSuccess: () => {
      toast.success("Invitation sent", {
        description: `Invite sent to ${inviteEmail}`,
      })
      setIsInviteDialogOpen(false)
      setInviteEmail("")
      setInviteRole("MEMBER")
      refetchInvitations()
    },
    onError: (error) => {
      toast.error("Failed to send invitation", {
        description: error.message,
      })
    },
  })

  const updateRole = trpc.users.updateRole.useMutation({
    onSuccess: (user) => {
      toast.success("Role updated", {
        description: `${user.name || user.email} is now ${user.role.toLowerCase()}`,
      })
      refetchTeam()
    },
    onError: (error) => {
      toast.error("Failed to update role", {
        description: error.message,
      })
    },
  })

  const removeUser = trpc.users.remove.useMutation({
    onSuccess: () => {
      toast.success("User removed")
      setOwnershipTransfer(null)
      refetchTeam()
    },
    onError: (error) => {
      // Check if this is an ownership transfer required error
      try {
        const errorData = JSON.parse(error.message)
        if (errorData.type === "OWNERSHIP_TRANSFER_REQUIRED") {
          // Store the info but don't show toast - dialog will handle it
          return
        }
      } catch {
        // Not a JSON error, show normal error
      }
      toast.error("Failed to remove user", {
        description: error.message,
      })
    },
  })

  const cancelInvitation = trpc.users.cancelInvitation.useMutation({
    onSuccess: () => {
      toast.success("Invitation cancelled")
      refetchInvitations()
    },
    onError: (error) => {
      toast.error("Failed to cancel invitation", {
        description: error.message,
      })
    },
  })

  const resendInvitation = trpc.users.resendInvitation.useMutation({
    onSuccess: (data) => {
      toast.success("Invitation resent", {
        description: `New invitation sent to ${data.email}`,
      })
      refetchInvitations()
    },
    onError: (error) => {
      toast.error("Failed to resend invitation", {
        description: error.message,
      })
    },
  })

  const approveJoinRequest = trpc.users.approveJoinRequest.useMutation({
    onSuccess: (data) => {
      toast.success("Request approved", {
        description: `${data.email} has joined the team`,
      })
      refetchJoinRequests()
      refetchTeam()
    },
    onError: (error) => {
      toast.error("Failed to approve request", {
        description: error.message,
      })
    },
  })

  const denyJoinRequest = trpc.users.denyJoinRequest.useMutation({
    onSuccess: (data) => {
      toast.success("Request denied", {
        description: `Request from ${data.email} has been denied`,
      })
      refetchJoinRequests()
    },
    onError: (error) => {
      toast.error("Failed to deny request", {
        description: error.message,
      })
    },
  })

  // Determine current user's role for permissions
  const currentUserRole = currentUser?.role || "MEMBER"
  const canManageUsers = currentUserRole === "OWNER" || currentUserRole === "ADMIN"
  const isOwner = currentUserRole === "OWNER"

  // Sort members: owners first, then admins, then members
  const sortedMembers = [...(teamMembers || [])].sort((a, b) => {
    const roleOrder: Record<DbRole, number> = { OWNER: 0, ADMIN: 1, MEMBER: 2, READONLY: 3 }
    return roleOrder[a.role] - roleOrder[b.role]
  })

  const handleInviteUser = () => {
    if (!inviteEmail) return
    inviteUser.mutate({ email: inviteEmail, role: inviteRole })
  }

  const handleChangeRole = (userId: string, newRole: "ADMIN" | "MEMBER" | "READONLY") => {
    updateRole.mutate({ userId, role: newRole })
  }

  const handleRemoveUser = (userId: string, userName: string) => {
    removeUser.mutate({ userId }, {
      onError: (error) => {
        try {
          const errorData = JSON.parse(error.message)
          if (errorData.type === "OWNERSHIP_TRANSFER_REQUIRED") {
            setOwnershipTransfer({
              userId,
              userName,
              mcpCount: errorData.mcpCount,
              applicationCount: errorData.applicationCount,
              toolCount: errorData.toolCount,
            })
            return
          }
        } catch {
          // Not a JSON error
        }
      }
    })
  }

  const handleConfirmRemoveWithTransfer = () => {
    if (ownershipTransfer) {
      removeUser.mutate({ userId: ownershipTransfer.userId, transferOwnership: true })
    }
  }

  const handleCancelInvitation = (invitationId: string) => {
    cancelInvitation.mutate({ invitationId })
  }

  const handleResendInvitation = (invitationId: string) => {
    resendInvitation.mutate({ invitationId })
  }

  const handleApproveJoinRequest = (requestId: string) => {
    approveJoinRequest.mutate({ requestId, role: "MEMBER" })
  }

  const handleDenyJoinRequest = (requestId: string) => {
    denyJoinRequest.mutate({ requestId })
  }

  const getRoleBadgeVariant = (role: DbRole) => {
    switch (role) {
      case "OWNER":
        return "default"
      case "ADMIN":
        return "secondary"
      default:
        return "outline"
    }
  }

  const getStatusBadgeVariant = (status: DbStatus) => {
    switch (status) {
      case "ACTIVE":
        return "default"
      case "INVITED":
        return "secondary"
      case "SUSPENDED":
        return "destructive"
    }
  }

  const getStatusText = (status: DbStatus) => {
    switch (status) {
      case "ACTIVE":
        return "Has access"
      case "INVITED":
        return "Invited"
      case "SUSPENDED":
        return "Access revoked"
    }
  }

  const getRoleIcon = (role: DbRole) => {
    switch (role) {
      case "OWNER":
      case "ADMIN":
        return <ShieldCheck className="size-3.5" />
      default:
        return <UserCircle className="size-3.5" />
    }
  }

  const isLoading = isLoadingUser || isLoadingTeam

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-32 mb-2" />
            <Skeleton className="h-5 w-64" />
          </div>
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="bg-card rounded-lg border p-4 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (teamError) {
    return (
      <div className="bg-card rounded-lg border p-12 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertCircle className="size-8 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">Failed to load team</h2>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          {teamError.message}
        </p>
        <Button onClick={() => refetchTeam()}>Try Again</Button>
      </div>
    )
  }

  // Empty state when only owner exists
  if (teamMembers && teamMembers.length === 1 && teamMembers[0].role === "OWNER") {
    return (
      <div>
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
                <DialogDescription>Send an invitation to join your SierraMCP team</DialogDescription>
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
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "ADMIN" | "MEMBER" | "READONLY")}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">
                        <div>
                          <div className="font-medium">Member</div>
                          <div className="text-muted-foreground text-xs">Standard access to resources</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="ADMIN">
                        <div>
                          <div className="font-medium">Admin</div>
                          <div className="text-muted-foreground text-xs">Can manage users and settings</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="READONLY">
                        <div>
                          <div className="font-medium">Read Only</div>
                          <div className="text-muted-foreground text-xs">View-only access</div>
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
                <Button onClick={handleInviteUser} disabled={!inviteEmail || inviteUser.isPending}>
                  {inviteUser.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Join Requests - also show in empty state */}
        {joinRequests && joinRequests.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-950/30 mb-6 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
            <h3 className="mb-3 font-medium flex items-center gap-2">
              <UserCheck className="size-4 text-amber-600" />
              Join Requests ({joinRequests.length})
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              These users signed up with your company domain and are requesting to join.
            </p>
            <div className="space-y-2">
              {joinRequests.map((request) => (
                <div key={request.id} className="bg-card flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={request.user.avatarUrl || undefined} />
                      <AvatarFallback>
                        {(request.user.name || request.user.email).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{request.user.name || request.user.email}</div>
                      <div className="text-muted-foreground text-sm">
                        {request.user.email} · Requested {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDenyJoinRequest(request.id)}
                      disabled={denyJoinRequest.isPending || approveJoinRequest.isPending}
                    >
                      <UserX className="mr-1 size-3.5" />
                      Deny
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleApproveJoinRequest(request.id)}
                      disabled={denyJoinRequest.isPending || approveJoinRequest.isPending}
                    >
                      <UserCheck className="mr-1 size-3.5" />
                      Approve
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Pending Invitations - also show in empty state */}
        {invitations && invitations.length > 0 && (
          <div className="bg-secondary/50 mb-6 rounded-lg border border-secondary p-4">
            <h3 className="mb-3 font-medium">Pending Invitations ({invitations.length})</h3>
            <div className="space-y-2">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="bg-card flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {invitation.email.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{invitation.email}</div>
                      <div className="text-muted-foreground text-sm">
                        Invited as {invitation.role.toLowerCase()} · Expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleResendInvitation(invitation.id)}
                      disabled={resendInvitation.isPending || cancelInvitation.isPending}
                    >
                      <Mail className="mr-1 size-3.5" />
                      Resend
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCancelInvitation(invitation.id)}
                      disabled={cancelInvitation.isPending || resendInvitation.isPending}
                    >
                      <X className="mr-1 size-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
                  <span className="font-medium">Member:</span> Standard access to resources
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
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
                <DialogDescription>Send an invitation to join your SierraMCP team</DialogDescription>
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
                  <Select value={inviteRole} onValueChange={(value) => setInviteRole(value as "ADMIN" | "MEMBER" | "READONLY")}>
                    <SelectTrigger id="role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MEMBER">
                        <div>
                          <div className="font-medium">Member</div>
                          <div className="text-muted-foreground text-xs">Standard access to resources</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="ADMIN">
                        <div>
                          <div className="font-medium">Admin</div>
                          <div className="text-muted-foreground text-xs">Can manage users and settings</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="READONLY">
                        <div>
                          <div className="font-medium">Read Only</div>
                          <div className="text-muted-foreground text-xs">View-only access</div>
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
                <Button onClick={handleInviteUser} disabled={!inviteEmail || inviteUser.isPending}>
                  {inviteUser.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Join Requests - people requesting to join via domain matching */}
      {canManageUsers && joinRequests && joinRequests.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/30 mb-6 rounded-lg border border-amber-200 dark:border-amber-800 p-4">
          <h3 className="mb-3 font-medium flex items-center gap-2">
            <UserCheck className="size-4 text-amber-600" />
            Join Requests ({joinRequests.length})
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            These users signed up with your company domain and are requesting to join.
          </p>
          <div className="space-y-2">
            {joinRequests.map((request) => (
              <div key={request.id} className="bg-card flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={request.user.avatarUrl || undefined} />
                    <AvatarFallback>
                      {(request.user.name || request.user.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{request.user.name || request.user.email}</div>
                    <div className="text-muted-foreground text-sm">
                      {request.user.email} · Requested {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleDenyJoinRequest(request.id)}
                    disabled={denyJoinRequest.isPending || approveJoinRequest.isPending}
                  >
                    <UserX className="mr-1 size-3.5" />
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApproveJoinRequest(request.id)}
                    disabled={denyJoinRequest.isPending || approveJoinRequest.isPending}
                  >
                    <UserCheck className="mr-1 size-3.5" />
                    Approve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Invitations */}
      {canManageUsers && invitations && invitations.length > 0 && (
        <div className="bg-secondary/50 mb-6 rounded-lg border border-secondary p-4">
          <h3 className="mb-3 font-medium">Pending Invitations ({invitations.length})</h3>
          <div className="space-y-2">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="bg-card flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {invitation.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-muted-foreground text-sm">
                      Invited as {invitation.role.toLowerCase()} · Expires {formatDistanceToNow(new Date(invitation.expiresAt), { addSuffix: true })}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleResendInvitation(invitation.id)}
                    disabled={resendInvitation.isPending || cancelInvitation.isPending}
                  >
                    <Mail className="mr-1 size-3.5" />
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCancelInvitation(invitation.id)}
                    disabled={cancelInvitation.isPending || resendInvitation.isPending}
                  >
                    <X className="mr-1 size-3.5" />
                    Cancel
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
              <TableHead>Joined</TableHead>
              {canManageUsers && <TableHead className="w-12"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedMembers.map((member) => (
              <TableRow key={member.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback>
                        {(member.name || member.email)
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{member.name || member.email.split("@")[0]}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{member.email}</TableCell>
                <TableCell>
                  <Badge variant={getRoleBadgeVariant(member.role)} className="gap-1">
                    {getRoleIcon(member.role)}
                    <span className="capitalize">{member.role.toLowerCase()}</span>
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={getStatusBadgeVariant(member.status)}>{getStatusText(member.status)}</Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {member.lastLoginAt
                    ? formatDistanceToNow(new Date(member.lastLoginAt), {
                        addSuffix: true,
                      })
                    : "Never"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {new Date(member.createdAt).toLocaleDateString()}
                </TableCell>
                {canManageUsers && (
                  <TableCell>
                    {member.role !== "OWNER" && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          {member.status === "ACTIVE" && (
                            <>
                              {member.role !== "ADMIN" && (
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(member.id, "ADMIN")}
                                  disabled={updateRole.isPending}
                                >
                                  <ShieldCheck className="mr-2 size-4" />
                                  Make Admin
                                </DropdownMenuItem>
                              )}
                              {member.role !== "MEMBER" && (
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(member.id, "MEMBER")}
                                  disabled={updateRole.isPending}
                                >
                                  <UserCircle className="mr-2 size-4" />
                                  Make Member
                                </DropdownMenuItem>
                              )}
                              {member.role !== "READONLY" && (
                                <DropdownMenuItem
                                  onClick={() => handleChangeRole(member.id, "READONLY")}
                                  disabled={updateRole.isPending}
                                >
                                  <UserCircle className="mr-2 size-4" />
                                  Make Read Only
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {isOwner && (
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemoveUser(member.id, member.name || member.email)}
                              disabled={removeUser.isPending}
                            >
                              <Trash2 className="mr-2 size-4" />
                              Remove User
                            </DropdownMenuItem>
                          )}
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

      {/* Ownership Transfer Confirmation Dialog */}
      <Dialog open={!!ownershipTransfer} onOpenChange={(open) => !open && setOwnershipTransfer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Ownership Required</DialogTitle>
            <DialogDescription>
              {ownershipTransfer?.userName} has created resources that need to be transferred before removal.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-3">
              The following resources will be transferred to you:
            </p>
            <ul className="space-y-2 text-sm">
              {ownershipTransfer?.mcpCount ? (
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {ownershipTransfer.mcpCount} MCP{ownershipTransfer.mcpCount !== 1 ? "s" : ""}
                </li>
              ) : null}
              {ownershipTransfer?.applicationCount ? (
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {ownershipTransfer.applicationCount} Application{ownershipTransfer.applicationCount !== 1 ? "s" : ""}
                </li>
              ) : null}
              {ownershipTransfer?.toolCount ? (
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  {ownershipTransfer.toolCount} Tool{ownershipTransfer.toolCount !== 1 ? "s" : ""}
                </li>
              ) : null}
            </ul>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOwnershipTransfer(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmRemoveWithTransfer}
              disabled={removeUser.isPending}
            >
              {removeUser.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Transfer & Remove User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
