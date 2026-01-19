"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"

/**
 * Verify Email page - DEPRECATED
 * Email verification is now handled by WorkOS.
 * This page redirects to the login page.
 */
export default function VerifyEmailPage() {
  useEffect(() => {
    // Redirect to login - WorkOS handles email verification
    window.location.href = "/login"
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Redirecting to sign in...
        </p>
      </div>
    </div>
  )
}
