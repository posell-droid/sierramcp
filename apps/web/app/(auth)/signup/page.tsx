"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"

/**
 * Signup page - redirects to WorkOS AuthKit
 * WorkOS handles both new and existing users in the same flow
 */
export default function SignupPage() {
  const router = useRouter()

  useEffect(() => {
    // Redirect to WorkOS AuthKit which handles signup automatically
    window.location.href = "/api/auth/workos"
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Redirecting to sign up...
        </p>
      </div>
    </div>
  )
}
