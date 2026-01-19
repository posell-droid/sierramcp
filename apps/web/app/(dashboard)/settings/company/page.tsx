"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  Palette,
  Shield,
  Loader2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"
import { formatDistanceToNow } from "date-fns"

const companySizes = [
  { value: "SOLO", label: "Solo (1 person)" },
  { value: "SMALL", label: "Small (2-10 employees)" },
  { value: "MEDIUM", label: "Medium (11-50 employees)" },
  { value: "LARGE", label: "Large (51-200 employees)" },
  { value: "ENTERPRISE", label: "Enterprise (201-1000 employees)" },
  { value: "CORPORATION", label: "Corporation (1000+ employees)" },
]

const industries = [
  "Technology",
  "Healthcare",
  "Finance",
  "Education",
  "Manufacturing",
  "Retail",
  "Media & Entertainment",
  "Professional Services",
  "Government",
  "Non-Profit",
  "Other",
]

const timezones = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
]

const legalEntityTypes = [
  "Sole Proprietorship",
  "Partnership",
  "Limited Liability Company (LLC)",
  "Corporation (C-Corp)",
  "S Corporation (S-Corp)",
  "Non-Profit Organization",
  "Other",
]

export default function CompanySettingsPage() {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState("")

  // Fetch company data and current user
  const { data: company, isLoading, error, refetch } = trpc.tenant.get.useQuery()
  const { data: stats } = trpc.tenant.getStats.useQuery()
  const { data: currentUser } = trpc.users.me.useQuery()

  // Check if current user is owner
  const isOwner = currentUser?.role === "OWNER"

  // Update mutation
  const updateCompany = trpc.tenant.update.useMutation({
    onSuccess: () => {
      toast.success("Company settings updated")
      setHasChanges(false)
      refetch()
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update company settings")
    },
  })

  // Delete tenant mutation
  const deleteTenant = trpc.tenant.delete.useMutation({
    onSuccess: () => {
      toast.success("Organization deleted successfully")
      // Clear session and redirect to login
      window.location.href = "/api/auth/signout"
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete organization")
    },
  })

  const handleDeleteTenant = () => {
    if (deleteConfirmation !== "DELETE") return
    deleteTenant.mutate({ confirmation: "DELETE" })
  }

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    legalName: "",
    description: "",
    industry: "",
    companySize: "",
    timezone: "America/New_York",
    defaultLanguage: "en",
    primaryContactName: "",
    primaryContactEmail: "",
    supportEmail: "",
    phone: "",
    legalAddressLine1: "",
    legalAddressLine2: "",
    legalCity: "",
    legalState: "",
    legalPostalCode: "",
    legalCountry: "",
    operatingAddressLine1: "",
    operatingAddressLine2: "",
    operatingCity: "",
    operatingState: "",
    operatingPostalCode: "",
    operatingCountry: "",
    logoUrl: "",
    primaryColor: "",
    secondaryColor: "",
    emailSenderName: "",
    legalEntityType: "",
    taxId: "",
  })

  // Populate form when data loads
  useEffect(() => {
    if (company) {
      setFormData({
        name: company.name || "",
        legalName: company.legalName || "",
        description: company.description || "",
        industry: company.industry || "",
        companySize: company.companySize || "",
        timezone: company.timezone || "America/New_York",
        defaultLanguage: company.defaultLanguage || "en",
        primaryContactName: company.primaryContactName || "",
        primaryContactEmail: company.primaryContactEmail || "",
        supportEmail: company.supportEmail || "",
        phone: company.phone || "",
        legalAddressLine1: company.legalAddressLine1 || "",
        legalAddressLine2: company.legalAddressLine2 || "",
        legalCity: company.legalCity || "",
        legalState: company.legalState || "",
        legalPostalCode: company.legalPostalCode || "",
        legalCountry: company.legalCountry || "",
        operatingAddressLine1: company.operatingAddressLine1 || "",
        operatingAddressLine2: company.operatingAddressLine2 || "",
        operatingCity: company.operatingCity || "",
        operatingState: company.operatingState || "",
        operatingPostalCode: company.operatingPostalCode || "",
        operatingCountry: company.operatingCountry || "",
        logoUrl: company.logoUrl || "",
        primaryColor: company.primaryColor || "",
        secondaryColor: company.secondaryColor || "",
        emailSenderName: company.emailSenderName || "",
        legalEntityType: company.legalEntityType || "",
        taxId: company.taxId || "",
      })
    }
  }, [company])

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setHasChanges(true)
  }

  const handleSave = () => {
    updateCompany.mutate({
      name: formData.name,
      legalName: formData.legalName || null,
      description: formData.description || null,
      industry: formData.industry || null,
      companySize: formData.companySize as "SOLO" | "SMALL" | "MEDIUM" | "LARGE" | "ENTERPRISE" | "CORPORATION" | null || null,
      timezone: formData.timezone,
      defaultLanguage: formData.defaultLanguage,
      primaryContactName: formData.primaryContactName || null,
      primaryContactEmail: formData.primaryContactEmail || null,
      supportEmail: formData.supportEmail || null,
      phone: formData.phone || null,
      legalAddress: {
        line1: formData.legalAddressLine1 || null,
        line2: formData.legalAddressLine2 || null,
        city: formData.legalCity || null,
        state: formData.legalState || null,
        postalCode: formData.legalPostalCode || null,
        country: formData.legalCountry || null,
      },
      operatingAddress: {
        line1: formData.operatingAddressLine1 || null,
        line2: formData.operatingAddressLine2 || null,
        city: formData.operatingCity || null,
        state: formData.operatingState || null,
        postalCode: formData.operatingPostalCode || null,
        country: formData.operatingCountry || null,
      },
      logoUrl: formData.logoUrl || null,
      primaryColor: formData.primaryColor || null,
      secondaryColor: formData.secondaryColor || null,
      emailSenderName: formData.emailSenderName || null,
      legalEntityType: formData.legalEntityType || null,
      taxId: formData.taxId || null,
    })
  }

  const copyTenantId = () => {
    if (company?.id) {
      navigator.clipboard.writeText(company.id)
      setCopied(true)
      toast.success("Tenant ID copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Failed to load company settings</h3>
          <p className="text-muted-foreground max-w-sm">{error.message}</p>
          <Button onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Save Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Company Settings</h2>
          <p className="text-muted-foreground">Manage your organization's information and preferences</p>
        </div>
        <Button onClick={handleSave} disabled={!hasChanges || updateCompany.isPending}>
          {updateCompany.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
            <p className="text-xs text-muted-foreground">Active Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats?.totalMcps || 0}</div>
            <p className="text-xs text-muted-foreground">MCPs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {company?.createdAt
                ? formatDistanceToNow(new Date(company.createdAt), { addSuffix: false })
                : "-"}
            </div>
            <p className="text-xs text-muted-foreground">Account Age</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList>
          <TabsTrigger value="general" className="gap-2">
            <Building2 className="h-4 w-4" />
            General
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2">
            <Phone className="h-4 w-4" />
            Contact
          </TabsTrigger>
          <TabsTrigger value="addresses" className="gap-2">
            <MapPin className="h-4 w-4" />
            Addresses
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="h-4 w-4" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="compliance" className="gap-2">
            <Shield className="h-4 w-4" />
            Compliance
          </TabsTrigger>
          {isOwner && (
            <TabsTrigger value="danger" className="gap-2 text-destructive data-[state=active]:text-destructive">
              <AlertTriangle className="h-4 w-4" />
              Danger Zone
            </TabsTrigger>
          )}
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Basic information about your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Company Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalName">Legal Name</Label>
                  <Input
                    id="legalName"
                    value={formData.legalName}
                    onChange={(e) => handleChange("legalName", e.target.value)}
                    placeholder="Acme Corporation"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleChange("description", e.target.value)}
                  placeholder="Brief description of your company..."
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => handleChange("industry", value)}
                  >
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companySize">Company Size</Label>
                  <Select
                    value={formData.companySize}
                    onValueChange={(value) => handleChange("companySize", value)}
                  >
                    <SelectTrigger id="companySize">
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                    <SelectContent>
                      {companySizes.map((size) => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(value) => handleChange("timezone", value)}
                  >
                    <SelectTrigger id="timezone">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz.value} value={tz.value}>
                          {tz.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalEntityType">Legal Entity Type</Label>
                  <Select
                    value={formData.legalEntityType}
                    onValueChange={(value) => handleChange("legalEntityType", value)}
                  >
                    <SelectTrigger id="legalEntityType">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {legalEntityTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Information (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle>System Information</CardTitle>
              <CardDescription>Read-only system-managed fields</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tenant ID</Label>
                  <div className="flex gap-2">
                    <Input value={company?.id || ""} disabled className="font-mono text-sm" />
                    <Button variant="outline" size="icon" onClick={copyTenantId}>
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Slug</Label>
                  <Input value={company?.slug || ""} disabled className="font-mono text-sm" />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div>
                    <Badge variant={company?.status === "ACTIVE" ? "default" : "secondary"}>
                      {company?.status || "ACTIVE"}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <div>
                    <Badge variant="outline">{company?.environment || "PRODUCTION"}</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data Residency</Label>
                  <div>
                    <Badge variant="outline">{company?.dataResidency || "us-east-1"}</Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Primary Domain</Label>
                <Input value={company?.primaryDomain || "Not set"} disabled />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contact Tab */}
        <TabsContent value="contact" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Contact Information</CardTitle>
              <CardDescription>Primary contact details for your organization</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryContactName">Primary Contact Name</Label>
                  <Input
                    id="primaryContactName"
                    value={formData.primaryContactName}
                    onChange={(e) => handleChange("primaryContactName", e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primaryContactEmail">Primary Contact Email</Label>
                  <Input
                    id="primaryContactEmail"
                    type="email"
                    value={formData.primaryContactEmail}
                    onChange={(e) => handleChange("primaryContactEmail", e.target.value)}
                    placeholder="john@company.com"
                  />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="supportEmail">Support Email</Label>
                  <Input
                    id="supportEmail"
                    type="email"
                    value={formData.supportEmail}
                    onChange={(e) => handleChange("supportEmail", e.target.value)}
                    placeholder="support@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleChange("phone", e.target.value)}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Addresses Tab */}
        <TabsContent value="addresses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Legal Address</CardTitle>
              <CardDescription>Registered business address</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="legalAddressLine1">Address Line 1</Label>
                <Input
                  id="legalAddressLine1"
                  value={formData.legalAddressLine1}
                  onChange={(e) => handleChange("legalAddressLine1", e.target.value)}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="legalAddressLine2">Address Line 2</Label>
                <Input
                  id="legalAddressLine2"
                  value={formData.legalAddressLine2}
                  onChange={(e) => handleChange("legalAddressLine2", e.target.value)}
                  placeholder="Suite 100"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="legalCity">City</Label>
                  <Input
                    id="legalCity"
                    value={formData.legalCity}
                    onChange={(e) => handleChange("legalCity", e.target.value)}
                    placeholder="San Francisco"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalState">State / Province</Label>
                  <Input
                    id="legalState"
                    value={formData.legalState}
                    onChange={(e) => handleChange("legalState", e.target.value)}
                    placeholder="CA"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalPostalCode">Postal Code</Label>
                  <Input
                    id="legalPostalCode"
                    value={formData.legalPostalCode}
                    onChange={(e) => handleChange("legalPostalCode", e.target.value)}
                    placeholder="94105"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legalCountry">Country</Label>
                  <Input
                    id="legalCountry"
                    value={formData.legalCountry}
                    onChange={(e) => handleChange("legalCountry", e.target.value)}
                    placeholder="United States"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operating Address</CardTitle>
              <CardDescription>Physical office location (if different from legal address)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="operatingAddressLine1">Address Line 1</Label>
                <Input
                  id="operatingAddressLine1"
                  value={formData.operatingAddressLine1}
                  onChange={(e) => handleChange("operatingAddressLine1", e.target.value)}
                  placeholder="456 Office Park"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="operatingAddressLine2">Address Line 2</Label>
                <Input
                  id="operatingAddressLine2"
                  value={formData.operatingAddressLine2}
                  onChange={(e) => handleChange("operatingAddressLine2", e.target.value)}
                  placeholder="Floor 5"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="operatingCity">City</Label>
                  <Input
                    id="operatingCity"
                    value={formData.operatingCity}
                    onChange={(e) => handleChange("operatingCity", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operatingState">State / Province</Label>
                  <Input
                    id="operatingState"
                    value={formData.operatingState}
                    onChange={(e) => handleChange("operatingState", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operatingPostalCode">Postal Code</Label>
                  <Input
                    id="operatingPostalCode"
                    value={formData.operatingPostalCode}
                    onChange={(e) => handleChange("operatingPostalCode", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="operatingCountry">Country</Label>
                  <Input
                    id="operatingCountry"
                    value={formData.operatingCountry}
                    onChange={(e) => handleChange("operatingCountry", e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Brand Settings</CardTitle>
              <CardDescription>Customize your organization's branding</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="logoUrl">Logo URL</Label>
                <Input
                  id="logoUrl"
                  value={formData.logoUrl}
                  onChange={(e) => handleChange("logoUrl", e.target.value)}
                  placeholder="https://example.com/logo.png"
                />
                <p className="text-xs text-muted-foreground">
                  Recommended: Square image, at least 256x256 pixels
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Brand Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      value={formData.primaryColor}
                      onChange={(e) => handleChange("primaryColor", e.target.value)}
                      placeholder="#3B82F6"
                      className="font-mono"
                    />
                    {formData.primaryColor && (
                      <div
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: formData.primaryColor }}
                      />
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Brand Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      value={formData.secondaryColor}
                      onChange={(e) => handleChange("secondaryColor", e.target.value)}
                      placeholder="#10B981"
                      className="font-mono"
                    />
                    {formData.secondaryColor && (
                      <div
                        className="w-10 h-10 rounded border"
                        style={{ backgroundColor: formData.secondaryColor }}
                      />
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="emailSenderName">Email Sender Name</Label>
                <Input
                  id="emailSenderName"
                  value={formData.emailSenderName}
                  onChange={(e) => handleChange("emailSenderName", e.target.value)}
                  placeholder="Acme Inc."
                />
                <p className="text-xs text-muted-foreground">
                  This name will appear as the sender for emails from your organization
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Tax Information</CardTitle>
              <CardDescription>Tax identification for billing purposes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="taxId">Tax ID / VAT Number</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => handleChange("taxId", e.target.value)}
                  placeholder="XX-XXXXXXX"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Status</CardTitle>
              <CardDescription>Legal agreements and compliance certifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Terms of Service</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant={company?.termsAcceptedAt ? "default" : "secondary"}>
                      {company?.termsAcceptedAt ? "Accepted" : "Not Accepted"}
                    </Badge>
                    {company?.termsAcceptedAt && (
                      <span className="text-xs text-muted-foreground">
                        on {new Date(company.termsAcceptedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Privacy Policy</Label>
                  <div className="flex items-center gap-2">
                    <Badge variant={company?.privacyPolicyAcceptedAt ? "default" : "secondary"}>
                      {company?.privacyPolicyAcceptedAt ? "Accepted" : "Not Accepted"}
                    </Badge>
                    {company?.privacyPolicyAcceptedAt && (
                      <span className="text-xs text-muted-foreground">
                        on {new Date(company.privacyPolicyAcceptedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Data Processing Agreement (DPA)</Label>
                <div>
                  <Badge
                    variant={
                      company?.dpaStatus === "SIGNED"
                        ? "default"
                        : company?.dpaStatus === "PENDING"
                        ? "secondary"
                        : "outline"
                    }
                  >
                    {company?.dpaStatus || "NOT_REQUIRED"}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Compliance Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {Array.isArray(company?.complianceTags) && company.complianceTags.length > 0 ? (
                    (company.complianceTags as string[]).map((tag: string) => (
                      <Badge key={tag} variant="outline">
                        {tag}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No compliance tags configured</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab (Owner Only) */}
        {isOwner && (
          <TabsContent value="danger" className="space-y-6">
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive">Delete Organization</CardTitle>
                <CardDescription>
                  Permanently delete this organization and all of its data. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg bg-destructive/10 p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
                    <div className="space-y-2">
                      <p className="font-medium text-destructive">
                        This will permanently delete:
                      </p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                        <li>All {stats?.totalUsers || 0} users and their accounts from the platform</li>
                        <li>All {stats?.totalMcps || 0} MCPs and their configurations</li>
                        <li>All applications, tools, and documents</li>
                        <li>All audit logs and activity history</li>
                        <li>All pending invitations and join requests</li>
                        <li>Any deployed infrastructure will need to be manually cleaned up</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Organization
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Confirmation Modal */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open)
        if (!open) setDeleteConfirmation("")
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Delete Organization
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All data will be lost.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="rounded-lg bg-destructive/10 p-4">
              <p className="text-sm text-destructive font-medium">
                You are about to delete "{company?.name}" and all associated data.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirmation">
                Type <span className="font-mono font-bold">DELETE</span> to confirm
              </Label>
              <Input
                id="delete-confirmation"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Type DELETE to confirm"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmation("")
              }}
              disabled={deleteTenant.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteTenant}
              disabled={deleteConfirmation !== "DELETE" || deleteTenant.isPending}
            >
              {deleteTenant.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Forever
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
