"use client"

import type React from "react"

import { useState } from "react"
import { useSession } from "next-auth/react"
import {
  CreditCard,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Users,
  Database,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

type PlanStatus = "active" | "trialing" | "past_due"

interface Plan {
  name: string
  description: string
  price: number
  interval: "monthly" | "annual"
  renewalDate: Date
  status: PlanStatus
}

interface UsageMetric {
  name: string
  icon: React.ElementType
  used: number
  limit: number
  unit: string
  warningThreshold: number
}

interface AvailablePlan {
  id: string
  name: string
  price: number
  interval: "monthly" | "annual"
  features: string[]
  isCurrent: boolean
  isPopular?: boolean
}

interface Invoice {
  id: string
  date: Date
  amount: number
  status: "paid" | "open" | "failed"
  downloadUrl: string
}

export default function BillingUsagePage() {
  const { data: session } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Determine current user's role (for permissions check)
  const currentUserRole = "owner" // In real app, get from session

  // Mock data
  const currentPlan: Plan = {
    name: "Professional",
    description: "Perfect for growing teams and businesses",
    price: 49,
    interval: "monthly",
    renewalDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 15),
    status: "active",
  }

  const usageMetrics: UsageMetric[] = [
    {
      name: "API Calls",
      icon: Zap,
      used: 12500,
      limit: 50000,
      unit: "calls",
      warningThreshold: 80,
    },
    {
      name: "Active Users",
      icon: Users,
      used: 8,
      limit: 25,
      unit: "users",
      warningThreshold: 80,
    },
    {
      name: "Storage Usage",
      icon: Database,
      used: 2.4,
      limit: 10,
      unit: "GB",
      warningThreshold: 85,
    },
  ]

  const availablePlans: AvailablePlan[] = [
    {
      id: "starter",
      name: "Starter",
      price: 19,
      interval: "monthly",
      features: ["10,000 API calls/mo", "5 active users", "2 GB storage", "Email support"],
      isCurrent: false,
    },
    {
      id: "professional",
      name: "Professional",
      price: 49,
      interval: "monthly",
      features: ["50,000 API calls/mo", "25 active users", "10 GB storage", "Priority support", "Advanced analytics"],
      isCurrent: true,
      isPopular: true,
    },
    {
      id: "enterprise",
      name: "Enterprise",
      price: 199,
      interval: "monthly",
      features: [
        "Unlimited API calls",
        "Unlimited users",
        "100 GB storage",
        "24/7 phone support",
        "Custom integrations",
        "SLA guarantee",
      ],
      isCurrent: false,
    },
  ]

  const invoices: Invoice[] = [
    {
      id: "INV-2024-001",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30),
      amount: 49,
      status: "paid",
      downloadUrl: "/invoices/001.pdf",
    },
    {
      id: "INV-2024-002",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 60),
      amount: 49,
      status: "paid",
      downloadUrl: "/invoices/002.pdf",
    },
    {
      id: "INV-2023-012",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * 90),
      amount: 49,
      status: "paid",
      downloadUrl: "/invoices/012.pdf",
    },
  ]

  const getStatusBadge = (status: PlanStatus) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case "trialing":
        return (
          <Badge variant="secondary">
            <TrendingUp className="h-3 w-3 mr-1" />
            Trial
          </Badge>
        )
      case "past_due":
        return (
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Past Due
          </Badge>
        )
    }
  }

  const handleManageSubscription = async () => {
    setIsLoading(true)
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsLoading(false)
    toast.success("Redirecting to billing portal...")
  }

  const handleUpgradePlan = (planId: string) => {
    toast.success(`Upgrading to ${planId} plan...`)
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    toast.success(`Downloading invoice ${invoiceId}...`)
  }

  // Permission check for non-owners
  if (currentUserRole !== "owner") {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-4 mb-4">
            <CreditCard className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Owner Access Required</h3>
          <p className="text-muted-foreground max-w-sm">
            Only account owners can access billing and usage information. Please contact your account owner for any
            billing-related questions.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Current Plan Section */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription className="mt-1">Your active subscription details</CardDescription>
            </div>
            {getStatusBadge(currentPlan.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <div className="flex items-baseline gap-2 mb-2">
              <h3 className="text-3xl font-bold">{currentPlan.name}</h3>
              <span className="text-muted-foreground">
                ${currentPlan.price}/{currentPlan.interval === "monthly" ? "mo" : "yr"}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{currentPlan.description}</p>
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Billing interval:</span>
              <span className="ml-2 font-medium capitalize">{currentPlan.interval}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Next renewal:</span>
              <span className="ml-2 font-medium">
                {currentPlan.renewalDate.toLocaleDateString()} (
                {formatDistanceToNow(currentPlan.renewalDate, { addSuffix: true })})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleManageSubscription} disabled={isLoading}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Manage Subscription
            </Button>
            <Button variant="outline">Upgrade Plan</Button>
          </div>

          <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
            Your usage resets on the first day of each billing cycle
          </div>
        </CardContent>
      </Card>

      {/* Usage Section */}
      <Card>
        <CardHeader>
          <CardTitle>Usage Metrics</CardTitle>
          <CardDescription>Track your current usage against plan limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {usageMetrics.map((metric) => {
            const Icon = metric.icon
            const percentage = (metric.used / metric.limit) * 100
            const isWarning = percentage >= metric.warningThreshold

            return (
              <div key={metric.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{metric.name}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {metric.used.toLocaleString()} / {metric.limit.toLocaleString()} {metric.unit}
                  </span>
                </div>
                <Progress
                  value={percentage}
                  className={isWarning ? "bg-orange-500/20" : undefined}
                />
                {isWarning && (
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    Warning: You've used {percentage.toFixed(0)}% of your limit
                  </p>
                )}
              </div>
            )
          })}
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>Upgrade or downgrade to fit your needs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-3">
            {availablePlans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-lg border p-6 ${
                  plan.isCurrent ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                {plan.isPopular && <Badge className="absolute -top-2 left-4 bg-primary">Most Popular</Badge>}
                <div className="mb-4">
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-muted-foreground">/mo</span>
                  </div>
                </div>
                <ul className="space-y-2 mb-6 text-sm">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                {plan.isCurrent ? (
                  <Button variant="outline" className="w-full bg-transparent" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    variant={plan.isPopular ? "default" : "outline"}
                    className="w-full"
                    onClick={() => handleUpgradePlan(plan.id)}
                  >
                    {plan.price > currentPlan.price ? "Upgrade" : "Downgrade"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Payment Method */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
          <CardDescription>Manage your payment information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 p-4 border rounded-lg">
            <div className="rounded-md bg-muted p-3">
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="font-medium">Visa ending in 4242</div>
              <div className="text-sm text-muted-foreground">Expires 12/2025</div>
            </div>
            <Button variant="outline" size="sm">
              Update
            </Button>
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="font-medium mb-1">Billing Address</div>
            <div>123 Main Street</div>
            <div>San Francisco, CA 94105</div>
            <div>United States</div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice History */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice History</CardTitle>
          <CardDescription>Download past invoices and receipts</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice ID</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-mono text-sm">{invoice.id}</TableCell>
                  <TableCell>{invoice.date.toLocaleDateString()}</TableCell>
                  <TableCell>${invoice.amount.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        invoice.status === "paid"
                          ? "default"
                          : invoice.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                      className={
                        invoice.status === "paid"
                          ? "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20"
                          : ""
                      }
                    >
                      {invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice.id)}>
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
