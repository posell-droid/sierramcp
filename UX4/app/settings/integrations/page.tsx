"use client"
import { useState } from "react"
import Link from "next/link"
import {
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Plug,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type ConnectionStatus = "connected" | "disconnected" | "error"

interface SlackIntegration {
  status: ConnectionStatus
  workspaceName: string | null
  workspaceId: string | null
  installedBy: string | null
  installedDate: Date | null
  scopes: string[]
  webhookHealth: {
    lastEventTimestamp: Date | null
    retryCount: number
    signatureVerification: "passing" | "failing" | "unknown"
  }
}

export default function IntegrationsSettingsPage() {
  const [isConnecting, setIsConnecting] = useState(false)
  const [scopesExpanded, setScopesExpanded] = useState(false)

  // Mock Slack integration data
  const [slackIntegration] = useState<SlackIntegration>({
    status: "connected",
    workspaceName: "GateMCP Workspace",
    workspaceId: "T1234567890",
    installedBy: "john.doe@gatemcp.com",
    installedDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45), // 45 days ago
    scopes: [
      "chat:write",
      "channels:read",
      "channels:history",
      "users:read",
      "app_mentions:read",
      "commands",
      "im:history",
      "im:write",
    ],
    webhookHealth: {
      lastEventTimestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
      retryCount: 0,
      signatureVerification: "passing",
    },
  })

  const getStatusBadge = (status: ConnectionStatus) => {
    switch (status) {
      case "connected":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Connected
          </Badge>
        )
      case "disconnected":
        return (
          <Badge variant="secondary">
            <XCircle className="h-3 w-3 mr-1" />
            Not Connected
          </Badge>
        )
      case "error":
        return (
          <Badge variant="destructive">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Error
          </Badge>
        )
    }
  }

  const getHealthBadge = (verification: "passing" | "failing" | "unknown") => {
    switch (verification) {
      case "passing":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Healthy
          </Badge>
        )
      case "failing":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Failing
          </Badge>
        )
      case "unknown":
        return <Badge variant="secondary">Unknown</Badge>
    }
  }

  const handleConnectSlack = async () => {
    setIsConnecting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsConnecting(false)
    toast.success("Redirecting to Slack authorization...")
  }

  const handleReinstall = async () => {
    setIsConnecting(true)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    setIsConnecting(false)
    toast.success("Slack integration refreshed")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight mb-1">Integrations</h2>
        <p className="text-muted-foreground">Connect external services to extend GateMCP functionality</p>
      </div>

      {/* Slack Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-[oklch(0.298_0.082_257.288)]/10 p-3">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor">
                  <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                </svg>
              </div>
              <div>
                <CardTitle>Slack</CardTitle>
                <CardDescription>Connect your Slack workspace to route conversations</CardDescription>
              </div>
            </div>
            {getStatusBadge(slackIntegration.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {slackIntegration.status === "connected" ? (
            <>
              {/* Connection Details */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Workspace:</span>
                    <div className="font-medium mt-1">{slackIntegration.workspaceName}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Workspace ID:</span>
                    <div className="font-mono text-xs mt-1">{slackIntegration.workspaceId}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Installed by:</span>
                    <div className="font-medium mt-1">{slackIntegration.installedBy}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Installed:</span>
                    <div className="font-medium mt-1">
                      {slackIntegration.installedDate?.toLocaleDateString()} (
                      {formatDistanceToNow(slackIntegration.installedDate!, { addSuffix: true })})
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Permissions/Scopes */}
              <div className="space-y-3">
                <button
                  onClick={() => setScopesExpanded(!scopesExpanded)}
                  className="flex items-center justify-between w-full text-sm font-medium hover:text-primary transition-colors"
                >
                  <span>Permissions ({slackIntegration.scopes.length} scopes)</span>
                  {scopesExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {scopesExpanded && (
                  <div className="grid grid-cols-2 gap-2">
                    {slackIntegration.scopes.map((scope) => (
                      <div key={scope} className="text-xs font-mono bg-muted/50 px-3 py-2 rounded-md border">
                        {scope}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Webhook Health */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Webhook & Events Health</span>
                  {getHealthBadge(slackIntegration.webhookHealth.signatureVerification)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Last event:</span>
                    <div className="font-medium mt-1">
                      {slackIntegration.webhookHealth.lastEventTimestamp
                        ? formatDistanceToNow(slackIntegration.webhookHealth.lastEventTimestamp, {
                            addSuffix: true,
                          })
                        : "No events yet"}
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Retry count:</span>
                    <div className="font-medium mt-1">{slackIntegration.webhookHealth.retryCount}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Signature verification:</span>
                    <div className="font-medium mt-1 capitalize">
                      {slackIntegration.webhookHealth.signatureVerification}
                    </div>
                  </div>
                </div>

                {slackIntegration.webhookHealth.retryCount > 5 && (
                  <div className="rounded-md bg-orange-500/10 border border-orange-500/20 p-3 text-sm text-orange-700 dark:text-orange-400">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-medium mb-1">High retry count detected</div>
                        <div className="text-xs">
                          Your webhook endpoint may be experiencing issues. Consider reinstalling the integration.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" onClick={handleReinstall} disabled={isConnecting}>
                  {isConnecting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reinstall
                </Button>
                <Link href="/mcps/finance-analytics/routes">
                  <Button variant="outline">
                    Manage Routes
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>

              {/* Help Text */}
              <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                <div className="font-medium mb-1">About Slack Integration Security</div>
                <p>
                  GateMCP stores only the OAuth token and workspace metadata. All message content is processed in
                  real-time and not persisted. Signature verification ensures authentic Slack requests.
                </p>
              </div>
            </>
          ) : (
            <>
              {/* Not Connected State */}
              <div className="text-center py-8">
                <div className="rounded-full bg-muted p-4 mb-4 inline-block">
                  <svg viewBox="0 0 24 24" className="h-8 w-8" fill="currentColor">
                    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Connect Slack Workspace</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Connect your Slack workspace to enable AI-powered chat routing and bot interactions across your
                  channels.
                </p>
                <Button onClick={handleConnectSlack} disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>Connect Slack</>
                  )}
                </Button>
              </div>

              <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
                <div className="font-medium mb-1">What happens when you connect?</div>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>You'll be redirected to Slack to authorize GateMCP</li>
                  <li>We'll request minimal permissions needed for chat routing</li>
                  <li>You can configure routes and bot profiles after connection</li>
                </ul>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Future Integrations Placeholder */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <Plug className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">More Integrations Coming Soon</h3>
          <p className="text-muted-foreground max-w-sm">
            Microsoft Teams, Discord, and other platform integrations are in development.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
