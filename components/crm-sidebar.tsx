"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  LayoutDashboard,
  Users,
  Target,
  Calendar,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  FileText,
} from "lucide-react"

interface CRMSidebarProps {
  user: any
  profile: any
}

const crmNavigation = [
  {
    name: "Dashboard",
    href: "/admin/crm",
    icon: LayoutDashboard,
  },
  {
    name: "Contacts",
    href: "/admin/crm/contacts",
    icon: Users,
  },
  {
    name: "Opportunities",
    href: "/admin/crm/opportunities",
    icon: Target,
  },
  {
    name: "Activities",
    href: "/admin/crm/activities",
    icon: Calendar,
  },
  {
    name: "Reports",
    href: "/admin/crm/reports",
    icon: BarChart3,
  },
]

export function CRMSidebar({ user, profile }: CRMSidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className={cn("bg-card flex flex-col border-r transition-all duration-300", collapsed ? "w-16" : "w-64")}>
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Building2 className="text-primary h-6 w-6" />
            <span className="text-lg font-semibold">CRM</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className={cn("h-8 w-8", collapsed && "mx-auto")}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {crmNavigation.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  collapsed && "justify-center px-2",
                  isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {/* Divider */}
        <div className="my-4 border-t" />

        {/* Back to Admin */}
        <Link
          href="/admin"
          className={cn(
            "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
            collapsed && "justify-center px-2"
          )}
        >
          <LayoutDashboard className={cn("h-5 w-5", !collapsed && "mr-3")} />
          {!collapsed && <span>Back to Admin</span>}
        </Link>
      </ScrollArea>

      {/* User Profile */}
      <div className="border-t p-4">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {getInitials(profile?.full_name || user?.email || "U")}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium">{profile?.full_name || "User"}</p>
              <p className="text-muted-foreground truncate text-xs">{profile?.role || "employee"}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
