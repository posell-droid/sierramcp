"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Building2, LogOut, Mail, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function BusinessEmailRequiredPage() {
  const router = useRouter()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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

  const handleTryAgain = async () => {
    setIsLoggingOut(true)
    try {
      await fetch("/api/auth/signout", { method: "POST" })
      router.push("/login")
    } catch (error) {
      console.error("Logout failed:", error)
      setIsLoggingOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <Building2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-2xl">Business Email Required</CardTitle>
          <CardDescription>
            SierraMCP is designed for teams and organizations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium">Personal email addresses not supported</p>
                <p className="text-sm text-muted-foreground mt-1">
                  To create a new organization, please sign up with your company email address
                  (e.g., you@yourcompany.com). Personal email providers like Gmail, Yahoo,
                  Outlook, and others are not supported for new accounts.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-primary/5 rounded-lg p-4 border border-primary/10">
            <p className="text-sm font-medium text-primary mb-2">Have an invitation?</p>
            <p className="text-sm text-muted-foreground">
              If a colleague invited you, you can still join their organization with any email
              address. Ask them to send you an invitation link.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={handleTryAgain} disabled={isLoggingOut} className="w-full">
              <ArrowRight className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Redirecting..." : "Try with Business Email"}
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
              Questions? Contact us at{" "}
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
