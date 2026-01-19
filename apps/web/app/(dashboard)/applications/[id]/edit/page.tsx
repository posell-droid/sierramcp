"use client"

import { useState, useRef, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { ArrowLeft, Upload, Loader2, Trash2, AppWindow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

export default function EditApplicationPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: application, isLoading, refetch } = trpc.applications.get.useQuery({ id })

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  const [initialized, setInitialized] = useState(false)

  // Initialize form when data first loads (only once)
  useEffect(() => {
    if (application && !initialized) {
      setName(application.name)
      setDescription(application.description || "")
      setLogoPreview(application.logoUrl || application.template?.logoUrl || null)
      setInitialized(true)
    }
  }, [application, initialized])

  const updateApplication = trpc.applications.update.useMutation({
    onSuccess: () => {
      toast.success("Application updated")
      refetch()
      router.push(`/applications/${id}`)
    },
    onError: (error) => {
      toast.error("Failed to update application", {
        description: error.message,
      })
    },
  })

  const getLogoUploadUrl = trpc.applications.getLogoUploadUrl.useMutation()
  const updateLogo = trpc.applications.updateLogo.useMutation({
    onSuccess: () => {
      refetch()
    },
  })

  const handleNameChange = (value: string) => {
    setName(value)
    setHasChanges(true)
  }

  const handleDescriptionChange = (value: string) => {
    setDescription(value)
    setHasChanges(true)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type", {
        description: "Please upload a JPEG, PNG, GIF, WebP, or SVG image",
      })
      return
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large", {
        description: "Please upload an image smaller than 5MB",
      })
      return
    }

    setIsUploading(true)

    try {
      // Get presigned upload URL
      const { uploadUrl, logoUrl } = await getLogoUploadUrl.mutateAsync({
        applicationId: id,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      })

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload file")
      }

      // Update application with new logo URL
      await updateLogo.mutateAsync({
        applicationId: id,
        logoUrl,
      })

      setLogoPreview(logoUrl)
      toast.success("Logo uploaded successfully")
    } catch (error) {
      console.error("Upload error:", error)
      toast.error("Failed to upload logo", {
        description: error instanceof Error ? error.message : "Unknown error",
      })
    } finally {
      setIsUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    try {
      await updateLogo.mutateAsync({
        applicationId: id,
        logoUrl: null,
      })
      setLogoPreview(null)
      toast.success("Logo removed")
    } catch (error) {
      toast.error("Failed to remove logo")
    }
  }

  const handleSave = () => {
    if (!application) return

    // Only include fields that actually changed
    const updates: { id: string; name?: string; description?: string } = { id }

    const trimmedName = name.trim()
    const trimmedDescription = description.trim()

    // Only send name if it changed and is not empty
    if (trimmedName && trimmedName !== application.name) {
      updates.name = trimmedName
    }

    // Only send description if it changed (can be empty to clear it)
    if (trimmedDescription !== (application.description || "")) {
      updates.description = trimmedDescription || undefined
    }

    // Don't make a request if nothing changed
    if (!updates.name && updates.description === undefined) {
      toast.info("No changes to save")
      return
    }

    updateApplication.mutate(updates)
  }

  const handleCancel = () => {
    router.push(`/applications/${id}`)
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-2xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!application) {
    return (
      <div className="container mx-auto max-w-2xl">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold">Application not found</h2>
          <p className="text-muted-foreground mt-2">The application you're looking for doesn't exist.</p>
          <Button onClick={() => router.push("/applications")} className="mt-4">
            Back to Applications
          </Button>
        </div>
      </div>
    )
  }

  // Get display logo: custom logo > template logo > fallback
  const displayLogo = logoPreview || application.logoUrl || application.template?.logoUrl

  return (
    <div className="container mx-auto max-w-2xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/applications">Applications</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/applications/${id}`}>{application.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Edit</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Edit Application</h1>
          <p className="text-muted-foreground mt-1">Update application details and branding</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Logo Section */}
        <Card>
          <CardHeader>
            <CardTitle>Logo</CardTitle>
            <CardDescription>
              Upload a custom logo for your application. Recommended size: 256x256 pixels.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24 rounded-lg">
                <AvatarImage src={displayLogo || undefined} className="object-cover" />
                <AvatarFallback className="rounded-lg text-2xl">
                  <AppWindow className="h-10 w-10" />
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 space-y-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  {(application.logoUrl || logoPreview) && (
                    <Button
                      variant="outline"
                      onClick={handleRemoveLogo}
                      disabled={isUploading}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  JPEG, PNG, GIF, WebP, or SVG. Max 5MB.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Details Section */}
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
            <CardDescription>Basic information about your application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={name || application.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Application name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description || application.description || ""}
                onChange={(e) => handleDescriptionChange(e.target.value)}
                placeholder="Describe what this application does..."
                rows={4}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateApplication.isPending || (!hasChanges && !name)}
          >
            {updateApplication.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
