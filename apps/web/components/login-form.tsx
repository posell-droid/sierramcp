"use client"

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import Image from "next/image"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function LoginForm() {
  const searchParams = useSearchParams()
  const [isLoading, setIsLoading] = useState(false)

  // Check for error from WorkOS callback
  const error = searchParams.get("error")
  const errorDetails = searchParams.get("details")

  const handleSignIn = () => {
    setIsLoading(true)
    // Redirect to WorkOS AuthKit - handles email/password, SSO, and social logins
    window.location.href = "/api/auth/workos"
  }

  const getErrorMessage = () => {
    if (!error) return null

    switch (error) {
      case "InvalidCode":
        return errorDetails || "Your sign-in link has expired. Please try again."
      case "NoCode":
        return "Sign-in was cancelled. Please try again."
      case "MissingConfig":
        return "Authentication is not configured. Please contact support."
      case "DatabaseError":
        return "Unable to create your account. Please try again."
      default:
        return errorDetails || "An error occurred during sign-in. Please try again."
    }
  }

  const errorMessage = getErrorMessage()

  return (
    <Card className="w-full max-w-md border-0 shadow-none bg-transparent">
      <CardHeader className="space-y-1 px-0">
        <div className="lg:hidden flex justify-center mb-6">
          <Image
            src="/images/sierramcp-badge.png"
            alt="SierraMCP"
            width={80}
            height={80}
            className="object-contain rounded-lg"
          />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome to SierraMCP</h2>
        <p className="text-sm text-muted-foreground">
          Sign in to access your MCP management dashboard
        </p>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {errorMessage && (
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <Button
            onClick={handleSignIn}
            disabled={isLoading}
            className="w-full h-12 text-base"
            size="lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Redirecting...
              </>
            ) : (
              "Continue"
            )}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Sign in with your email, Google, or company SSO
          </p>
        </div>
      </CardContent>

      <CardFooter className="px-0 pt-4">
        <p className="text-xs text-center text-muted-foreground w-full">
          By continuing, you agree to our{" "}
          <a href="/terms" className="text-primary hover:underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </a>
        </p>
      </CardFooter>
    </Card>
  )
}
