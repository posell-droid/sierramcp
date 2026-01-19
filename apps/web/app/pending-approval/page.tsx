"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Building2, LogOut, RefreshCw, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { trpc } from "@/lib/trpc"

export default function PendingApprovalPage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  // Get current user and their join request status
  const { data: user, isLoading: isLoadingUser, refetch } = trpc.users.me.useQuery()
  const { data: joinRequest, isLoading: isLoadingRequest } = trpc.users.myJoinRequest.useQuery(undefined, {
    // Only fetch if user exists but has no tenant
    enabled: !!user && !user.tenantId,
  })

  // If user has a tenant, re-authenticate to get fresh session with tenantId
  useEffect(() => {
    if (user?.tenantId) {
      // Redirect through WorkOS to get a new JWT with the tenantId
      // This avoids the stale session issue where JWT has no tenant
      window.location.href = "/api/auth/workos"
    }
  }, [user?.tenantId])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await fetch("/api/auth/signout", { method: "POST" })
      router.push("/login")
    } catch (error) {
      console.error("Logout failed:", error)
      setIsLoggingOut(false)
    }
  }

  const handleRefresh = () => {
    refetch()
  }

  const isLoading = isLoadingUser || isLoadingRequest

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
            <Skeleton className="h-8 w-48 mx-auto mb-2" />
            <Skeleton className="h-4 w-64 mx-auto" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  // User already has a tenant - shouldn't be here
  if (user?.tenantId) {
    return null
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
          </div>
          <CardTitle className="text-2xl">Approval Pending</CardTitle>
          <CardDescription>
            Your request to join is being reviewed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {joinRequest ? (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">{joinRequest.tenant.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Your company already has an account. An admin will review your request to join.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="font-medium">Request Submitted</p>
                  <p className="text-sm text-muted-foreground">
                    We've notified the account administrators. You'll receive an email once your request is approved.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <p>Signed in as <span className="font-medium">{user?.email}</span></p>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={handleRefresh} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Check Status
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Signing out..." : "Sign out"}
            </Button>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs text-center text-muted-foreground">
              Need help? Contact your company's SierraMCP administrator or reach out to{" "}
              <a href="mailto:support@sierramcp.com" className="text-primary hover:underline">
                support@sierramcp.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
