"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, Check, Search, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import { trpc } from "@/lib/trpc"

type SetupMode = "template" | "custom"

interface Template {
  id: string
  slug: string
  name: string
  category: string
  description: string | null
  logoUrl: string | null
  authTypes: string[]
  docsUrl: string | null
}

export default function NewApplicationPage() {
  const router = useRouter()

  // tRPC queries and mutations
  const { data: templates = [], isLoading: templatesLoading } = trpc.applications.listTemplates.useQuery()
  const { data: categories = [] } = trpc.applications.getTemplateCategories.useQuery()

  const createApplication = trpc.applications.create.useMutation({
    onSuccess: (data) => {
      toast.success("Application created", {
        description: "Now configure your environments to connect to the API",
      })
      router.push(`/applications/${data.id}`)
    },
    onError: (error) => {
      toast.error("Failed to create application", {
        description: error.message,
      })
    },
  })

  // Setup mode
  const [setupMode, setSetupMode] = useState<SetupMode>("template")
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [customName, setCustomName] = useState("")
  const [customDescription, setCustomDescription] = useState("")

  // Filters for template mode
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState<string>("All")

  // Filter templates
  const filteredTemplates = (templates as Template[]).filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.description || "").toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = categoryFilter === "All" || t.category === categoryFilter
    return matchesSearch && matchesCategory
  })

  const canCreate = setupMode === "template" ? selectedTemplate !== null : customName.trim() !== ""

  const handleCreate = async () => {
    createApplication.mutate({
      name: setupMode === "template" ? selectedTemplate?.name || "" : customName,
      description: setupMode === "template" ? selectedTemplate?.description || undefined : customDescription || undefined,
      templateId: setupMode === "template" ? selectedTemplate?.id : undefined,
    })
  }

  return (
    <div className="container mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-2">
          <Button variant="ghost" size="icon" onClick={() => router.push("/applications")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">New Application</h1>
            <p className="text-muted-foreground mt-1">Connect a system to build tools and deploy MCP servers</p>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Choose Application Type</CardTitle>
              <CardDescription>
                Select a template or create a custom application
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => router.push("/applications")}>
              Cancel
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-6">
            <Tabs value={setupMode} onValueChange={(v) => setSetupMode(v as SetupMode)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="template">From Template</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>

              <TabsContent value="template" className="space-y-4 mt-6">
                {/* Filters */}
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search templates..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">All Categories</SelectItem>
                      {categories.map((category: string) => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Template Grid */}
                {templatesLoading ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {filteredTemplates.map((template) => (
                      <Card
                        key={template.id}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedTemplate?.id === template.id ? "border-primary ring-2 ring-primary/20" : ""
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <Avatar className="size-10 rounded-md">
                              <AvatarImage src={template.logoUrl || "/placeholder.svg"} />
                              <AvatarFallback className="rounded-md text-xs">
                                {template.name.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold text-sm leading-tight">{template.name}</h4>
                                  <p className="text-xs text-muted-foreground mt-0.5">{template.category}</p>
                                </div>
                                {selectedTemplate?.id === template.id && (
                                  <Check className="h-5 w-5 text-primary shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {template.description}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-2">
                                {template.authTypes.map((authType) => (
                                  <Badge key={authType} variant="secondary" className="text-xs">
                                    {authType.replace("_", " ")}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="custom" className="space-y-4 mt-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">
                      Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="name"
                      placeholder="My Application"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Describe what this application does..."
                      rows={4}
                      value={customDescription}
                      onChange={(e) => setCustomDescription(e.target.value)}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            {/* Actions */}
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={handleCreate} disabled={!canCreate || createApplication.isPending}>
                {createApplication.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Application
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
