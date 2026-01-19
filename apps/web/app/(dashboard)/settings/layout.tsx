"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { User, CreditCard, Building2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const settingsNavigation = [
  {
    name: "Profile",
    href: "/settings/profile",
    icon: User,
  },
  {
    name: "Company",
    href: "/settings/company",
    icon: Building2,
  },
  {
    name: "Billing & Usage",
    href: "/settings/billing",
    icon: CreditCard,
  },
]

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account settings and preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Navigation */}
        <aside className="lg:w-64 shrink-0">
          <nav className="space-y-1">
            {settingsNavigation.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive
                        ? "bg-accent text-accent-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.name}
                  </Button>
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  )
}
