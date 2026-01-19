"use client"

import { useEffect } from "react"
import { Loader2 } from "lucide-react"

/**
 * Reset Password page - DEPRECATED
 * Password reset is now handled by WorkOS.
 * This page redirects to the WorkOS login page where users can click "Forgot password?"
 */
export default function ResetPasswordPage() {
  useEffect(() => {
    // Redirect to WorkOS - it handles password reset
    window.location.href = "/api/auth/workos"
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Redirecting to password reset...
        </p>
      </div>
    </div>
  )
}
