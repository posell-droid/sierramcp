"use client"

import { Suspense, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Image from "next/image"
import { Loader2, UserPlus, Building2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface InvitationDetails {
  id: string
  email: string
  role: string
  tenantName: string
  inviterName: string | null
  expiresAt: string
}

function AcceptInviteContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAccepting, setIsAccepting] = useState(false)

  useEffect(() => {
    async function fetchInvitation() {
      if (!token) {
        setError("No invitation token provided")
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/invitations/${token}`)
        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Invalid or expired invitation")
          setIsLoading(false)
          return
        }

        const data = await response.json()
        setInvitation(data)
      } catch (err) {
        setError("Failed to load invitation details")
      } finally {
        setIsLoading(false)
      }
    }

    fetchInvitation()
  }, [token])

  const handleAccept = () => {
    setIsAccepting(true)
    // Redirect to WorkOS signup screen for new users
    window.location.href = "/api/auth/workos?screen=sign-up"
  }

  if (isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (error || !invitation) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
          <CardDescription>
            {error || "This invitation link is invalid or has expired."}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-sm text-muted-foreground mb-6">
            Please contact the person who invited you to request a new invitation.
          </p>
          <Button variant="outline" onClick={() => window.location.href = "/login"}>
            Go to Login
          </Button>
        </CardContent>
      </Card>
    )
  }

  const expiresAt = new Date(invitation.expiresAt)
  const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-4">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Image
              src="/images/sierramcp-badge.png"
              alt="SierraMCP"
              width={48}
              height={48}
              className="rounded-lg"
            />
          </div>
        </div>
        <CardTitle className="text-2xl">You're Invited!</CardTitle>
        <CardDescription>
          You've been invited to join a team on SierraMCP
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-muted rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm text-muted-foreground">Organization</p>
              <p className="font-medium">{invitation.tenantName}</p>
            </div>
          </div>
          {invitation.inviterName && (
            <div className="flex items-start gap-3">
              <UserPlus className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Invited by</p>
                <p className="font-medium">{invitation.inviterName}</p>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <div className="h-5 w-5 flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Your role</p>
              <p className="font-medium capitalize">{invitation.role.toLowerCase()}</p>
            </div>
          </div>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          <p>Invitation for <span className="font-medium">{invitation.email}</span></p>
          <p className="text-xs mt-1">Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''}</p>
        </div>

        <Button
          onClick={handleAccept}
          disabled={isAccepting}
          className="w-full h-12 text-base"
          size="lg"
        >
          {isAccepting ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Redirecting...
            </>
          ) : (
            "Accept Invitation"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          By accepting, you'll create an account or sign in with your existing account.
        </p>
      </CardContent>
    </Card>
  )
}

export default function AcceptInvitePage() {
  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Suspense
        fallback={
          <Card className="w-full max-w-md">
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        }
      >
        <AcceptInviteContent />
      </Suspense>
    </div>
  )
}
