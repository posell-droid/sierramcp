"use client"

import { Suspense, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Check,
  AlertCircle,
  Info,
  Lock,
  Settings,
  ShieldCheck,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { toast } from "sonner"

type ConfigFieldType = "string" | "number" | "boolean" | "json"

interface ConfigField {
  id: string
  key: string
  value: string
  type: ConfigFieldType
  required: boolean
  validationHint?: string
}

interface SecretSlot {
  id: string
  name: string
  reference: string
  isMapped: boolean
}

interface PolicyConfig {
  maxRowsPerToolResult: number
  toolTimeoutSeconds: number
  allowedEgressDomains: string[]
}

// Stub hook - replace with trpc.mcps.getConfig.useQuery({ mcpId: id })
function useMCPConfig(mcpId: string) {
  const [data] = useState({
    configFields: [
      {
        id: "1",
        key: "api_base_url",
        value: "https://api.finance.internal",
        type: "string" as ConfigFieldType,
        required: true,
        validationHint: "Must be a valid HTTPS URL",
      },
      {
        id: "2",
        key: "max_retries",
        value: "3",
        type: "number" as ConfigFieldType,
        required: false,
        validationHint: "Integer between 0 and 10",
      },
      {
        id: "3",
        key: "enable_caching",
        value: "true",
        type: "boolean" as ConfigFieldType,
        required: false,
      },
    ],
    secrets: [
      {
        id: "1",
        name: "DATABASE_PASSWORD",
        reference: "arn:aws:secretsmanager:us-east-1:123456789012:secret:finance/db-password",
        isMapped: true,
      },
      {
        id: "2",
        name: "API_KEY",
        reference: "arn:aws:secretsmanager:us-east-1:123456789012:secret:finance/api-key",
        isMapped: true,
      },
      {
        id: "3",
        name: "WEBHOOK_SECRET",
        reference: "",
        isMapped: false,
      },
    ],
    policy: {
      maxRowsPerToolResult: 1000,
      toolTimeoutSeconds: 30,
      allowedEgressDomains: ["api.finance.internal", "*.amazonaws.com", "analytics.company.com"],
    },
  })

  return {
    data,
    isLoading: false,
    error: null,
  }
}

function useMCP(id: string) {
  return {
    data: { id, name: "Finance Analytics" },
    isLoading: false,
  }
}

// Stub hook for updating config
function useUpdateMCPConfig() {
  const mutateAsync = async (payload: unknown) => {
    console.log("[v0] Updating MCP config:", payload)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    toast.success("Configuration updated")
  }

  return {
    mutateAsync,
    isPending: false,
  }
}

// Stub hook for validating config
function useValidateConfig() {
  const mutateAsync = async (payload: unknown) => {
    console.log("[v0] Validating config:", payload)
    await new Promise((resolve) => setTimeout(resolve, 1500))
    // Simulate validation success/failure
    const isValid = Math.random() > 0.3
    return { isValid, errors: isValid ? [] : ["Invalid API base URL", "Max retries out of range"] }
  }

  return {
    mutateAsync,
    isPending: false,
  }
}

function BreadcrumbWrapper({ mcpName, mcpId }: { mcpName: string; mcpId: string }) {
  return (
    <Breadcrumb className="mb-6">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/mcps">MCPs</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink href={`/mcps/${mcpId}`}>{mcpName}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage>Config & Secrets</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default function MCPConfigPage({ params }: { params: { id: string } }) {
  const { id } = params
  const router = useRouter()
  const { data: mcp } = useMCP(id)
  const { data: config, isLoading } = useMCPConfig(id)
  const { mutateAsync: updateConfig, isPending: isUpdating } = useUpdateMCPConfig()
  const { mutateAsync: validateConfig, isPending: isValidating } = useValidateConfig()

  const [configFields, setConfigFields] = useState<ConfigField[]>(config?.configFields || [])
  const [secrets, setSecrets] = useState<SecretSlot[]>(config?.secrets || [])
  const [policy, setPolicy] = useState<PolicyConfig>(
    config?.policy || {
      maxRowsPerToolResult: 1000,
      toolTimeoutSeconds: 30,
      allowedEgressDomains: [],
    },
  )

  const [validationResult, setValidationResult] = useState<{ isValid: boolean; errors: string[] } | null>(null)
  const [secretDialogOpen, setSecretDialogOpen] = useState(false)
  const [selectedSecret, setSelectedSecret] = useState<SecretSlot | null>(null)
  const [tempSecretReference, setTempSecretReference] = useState("")
  const [showSecretValues, setShowSecretValues] = useState<Record<string, boolean>>({})
  const [newDomain, setNewDomain] = useState("")

  const [hasChanges, setHasChanges] = useState(false)

  const handleAddField = () => {
    const newField: ConfigField = {
      id: Math.random().toString(),
      key: "",
      value: "",
      type: "string",
      required: false,
    }
    setConfigFields([...configFields, newField])
    setHasChanges(true)
  }

  const handleRemoveField = (id: string) => {
    setConfigFields(configFields.filter((f) => f.id !== id))
    setHasChanges(true)
  }

  const handleUpdateField = (id: string, updates: Partial<ConfigField>) => {
    setConfigFields(configFields.map((f) => (f.id === id ? { ...f, ...updates } : f)))
    setHasChanges(true)
  }

  const handleMapSecret = (secret: SecretSlot) => {
    setSelectedSecret(secret)
    setTempSecretReference(secret.reference)
    setSecretDialogOpen(true)
  }

  const handleSaveSecretMapping = () => {
    if (!selectedSecret) return

    setSecrets(
      secrets.map((s) =>
        s.id === selectedSecret.id ? { ...s, reference: tempSecretReference, isMapped: !!tempSecretReference } : s,
      ),
    )
    setSecretDialogOpen(false)
    setSelectedSecret(null)
    setTempSecretReference("")
    setHasChanges(true)
    toast.success("Secret mapping updated")
  }

  const handleAddDomain = () => {
    if (newDomain.trim() && !policy.allowedEgressDomains.includes(newDomain.trim())) {
      setPolicy({
        ...policy,
        allowedEgressDomains: [...policy.allowedEgressDomains, newDomain.trim()],
      })
      setNewDomain("")
      setHasChanges(true)
    }
  }

  const handleRemoveDomain = (domain: string) => {
    setPolicy({
      ...policy,
      allowedEgressDomains: policy.allowedEgressDomains.filter((d) => d !== domain),
    })
    setHasChanges(true)
  }

  const handleValidate = async () => {
    const result = await validateConfig({ configFields, secrets, policy })
    setValidationResult(result)
  }

  const handleSaveChanges = async () => {
    await updateConfig({ configFields, secrets, policy })
    setHasChanges(false)
    setValidationResult(null)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-muted/30 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-64 bg-muted rounded" />
            <div className="h-96 bg-muted rounded" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="h-6 w-64 bg-muted rounded animate-pulse mb-6" />}>
          <BreadcrumbWrapper mcpName={mcp?.name || "MCP"} mcpId={id} />
        </Suspense>

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Configuration & Secrets</h1>
              <p className="text-muted-foreground mt-1">
                Manage environment variables, secrets, and runtime policies for this MCP
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Configuration Fields Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Configuration Fields</CardTitle>
                  <CardDescription>Key-value pairs for runtime configuration</CardDescription>
                </div>
                <Button onClick={handleAddField} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {configFields.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No configuration fields yet. Click &quot;Add Field&quot; to get started.</p>
                </div>
              ) : (
                configFields.map((field) => (
                  <div key={field.id} className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/30">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3">
                        <Label className="text-xs text-muted-foreground mb-1">Key</Label>
                        <Input
                          placeholder="config_key"
                          value={field.key}
                          onChange={(e) => handleUpdateField(field.id, { key: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-4">
                        <Label className="text-xs text-muted-foreground mb-1">Value</Label>
                        <Input
                          placeholder="config_value"
                          value={field.value}
                          onChange={(e) => handleUpdateField(field.id, { value: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Label className="text-xs text-muted-foreground mb-1">Type</Label>
                        <Select
                          value={field.type}
                          onValueChange={(value) => handleUpdateField(field.id, { type: value as ConfigFieldType })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="string">String</SelectItem>
                            <SelectItem value="number">Number</SelectItem>
                            <SelectItem value="boolean">Boolean</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-2 flex items-end">
                        <div className="flex items-center gap-2 h-9">
                          <Switch
                            checked={field.required}
                            onCheckedChange={(checked) => handleUpdateField(field.id, { required: checked })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveField(field.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {field.validationHint && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        {field.validationHint}
                      </p>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Secrets Section */}
          <Card>
            <CardHeader>
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Secrets
                </CardTitle>
                <CardDescription>Sensitive credentials stored as AWS Secrets Manager references</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <ShieldCheck className="h-4 w-4" />
                <AlertDescription>
                  Secrets are never stored directly in your configuration. Instead, they reference secure storage in AWS
                  Secrets Manager. Your MCP runtime will resolve these references at deployment time.
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {secrets.map((secret) => (
                  <div key={secret.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium font-mono text-sm">{secret.name}</span>
                        {secret.isMapped ? (
                          <Badge variant="secondary" className="bg-green-500/10 text-green-700 border-green-500/20">
                            <Check className="h-3 w-3 mr-1" />
                            Mapped
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Not Mapped
                          </Badge>
                        )}
                      </div>
                      {secret.reference && (
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground font-mono">
                            {showSecretValues[secret.id] ? secret.reference : "arn:aws:secretsmanager:•••••••"}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              setShowSecretValues({ ...showSecretValues, [secret.id]: !showSecretValues[secret.id] })
                            }
                          >
                            {showSecretValues[secret.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                          </Button>
                        </div>
                      )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleMapSecret(secret)}>
                      Change mapping
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Policy Controls Section */}
          <Card>
            <CardHeader>
              <CardTitle>Runtime Policy Controls</CardTitle>
              <CardDescription>Security and operational limits for this MCP</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxRows">Max rows per tool result</Label>
                  <Input
                    id="maxRows"
                    type="number"
                    value={policy.maxRowsPerToolResult}
                    onChange={(e) => {
                      setPolicy({ ...policy, maxRowsPerToolResult: Number.parseInt(e.target.value) || 0 })
                      setHasChanges(true)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Limits the size of result sets returned by tools</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout">Tool timeout (seconds)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={policy.toolTimeoutSeconds}
                    onChange={(e) => {
                      setPolicy({ ...policy, toolTimeoutSeconds: Number.parseInt(e.target.value) || 0 })
                      setHasChanges(true)
                    }}
                  />
                  <p className="text-xs text-muted-foreground">Maximum execution time for any tool call</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <Label>Allowed egress domains</Label>
                <p className="text-xs text-muted-foreground">
                  Control which external domains this MCP can connect to. Use wildcards like *.example.com
                </p>

                <div className="flex gap-2">
                  <Input
                    placeholder="api.example.com or *.example.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddDomain()
                      }
                    }}
                  />
                  <Button onClick={handleAddDomain} disabled={!newDomain.trim()}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {policy.allowedEgressDomains.map((domain) => (
                    <Badge key={domain} variant="secondary" className="flex items-center gap-1 pl-2 pr-1">
                      {domain}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 hover:bg-transparent"
                        onClick={() => handleRemoveDomain(domain)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  {policy.allowedEgressDomains.length === 0 && (
                    <p className="text-sm text-muted-foreground">No egress restrictions configured</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Validation Section */}
          <Card>
            <CardHeader>
              <CardTitle>Configuration Validation</CardTitle>
              <CardDescription>Validate your configuration before saving changes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                onClick={handleValidate}
                disabled={isValidating}
                variant="outline"
                className="w-full sm:w-auto bg-transparent"
              >
                {isValidating ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Validating...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Validate configuration
                  </>
                )}
              </Button>

              {validationResult && (
                <Alert variant={validationResult.isValid ? "default" : "destructive"}>
                  {validationResult.isValid ? (
                    <>
                      <Check className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Configuration is valid</strong>
                        <br />
                        All fields pass validation checks. You can safely save these changes.
                      </AlertDescription>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Validation errors found:</strong>
                        <ul className="mt-2 ml-4 list-disc space-y-1">
                          {validationResult.errors.map((error, i) => (
                            <li key={i} className="text-sm">
                              {error}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </>
                  )}
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Sticky Footer */}
          {hasChanges && (
            <div className="fixed bottom-0 left-0 right-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
              <div className="mx-auto max-w-7xl px-6 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">You have unsaved changes</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setConfigFields(config?.configFields || [])
                        setSecrets(config?.secrets || [])
                        setPolicy(
                          config?.policy || {
                            maxRowsPerToolResult: 1000,
                            toolTimeoutSeconds: 30,
                            allowedEgressDomains: [],
                          },
                        )
                        setHasChanges(false)
                        setValidationResult(null)
                        toast.info("Changes discarded")
                      }}
                    >
                      Discard
                    </Button>
                    <Button onClick={handleSaveChanges} disabled={isUpdating}>
                      {isUpdating ? (
                        <>
                          <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          Saving...
                        </>
                      ) : (
                        "Save changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secret Mapping Dialog */}
        <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Map Secret</DialogTitle>
              <DialogDescription>Enter the AWS Secrets Manager ARN for {selectedSecret?.name}</DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="secretArn">AWS Secrets Manager ARN</Label>
                <Input
                  id="secretArn"
                  placeholder="arn:aws:secretsmanager:region:account:secret:name"
                  value={tempSecretReference}
                  onChange={(e) => setTempSecretReference(e.target.value)}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">The ARN must grant read access to your MCP&apos;s IAM role</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSecretDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveSecretMapping} disabled={!tempSecretReference.trim()}>
                Save mapping
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
