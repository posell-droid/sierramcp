import { Suspense } from "react"
import Image from "next/image"
import { LoginForm } from "@/components/login-form"
import { Loader2 } from "lucide-react"

function LoginFormWrapper() {
  return <LoginForm />
}

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left side - Login Form */}
      <div className="flex items-center justify-center p-8 bg-background">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <LoginFormWrapper />
        </Suspense>
      </div>

      {/* Right side - Branding */}
      <div className="hidden lg:flex items-center justify-center bg-primary text-primary-foreground p-12">
        <div className="max-w-md text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-32 h-32 bg-background rounded-2xl flex items-center justify-center shadow-lg">
              <Image
                src="/images/sierramcp-badge.png"
                alt="SierraMCP"
                width={112}
                height={112}
                className="object-contain rounded-xl"
              />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Welcome to SierraMCP</h1>
          <p className="text-lg text-primary-foreground/90 leading-relaxed">
            Enterprise grade MCP management system. Built with trust, visibility, and reliability to power Agentic Workflows.
          </p>
          <div className="pt-8 grid grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold">99.9%</div>
              <div className="text-sm text-primary-foreground/80">Uptime</div>
            </div>
            <div>
              <div className="text-3xl font-bold">256-bit</div>
              <div className="text-sm text-primary-foreground/80">Encryption</div>
            </div>
            <div>
              <div className="text-3xl font-bold">24/7</div>
              <div className="text-sm text-primary-foreground/80">Support</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
