"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, formatName } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  LayoutDashboard,
  Users,
  Laptop,
  ClipboardList,
  FileText,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Briefcase,
} from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/permissions"

interface AdminSidebarProps {
  user?: {
    email?: string
    user_metadata?: {
      first_name?: string
      last_name?: string
    }
  }
  profile?: {
    first_name?: string
    last_name?: string
    department?: string
    role?: UserRole
    lead_departments?: string[]
  }
}

const adminNavigation = [
  { name: "Admin Dashboard", href: "/admin", icon: LayoutDashboard, roles: ["super_admin", "admin", "lead"] },
  { name: "Staff Management", href: "/admin/staff", icon: Users, roles: ["super_admin", "admin"] },
  { name: "Device Management", href: "/admin/devices", icon: Laptop, roles: ["super_admin", "admin"] },
  { name: "Task Management", href: "/admin/tasks", icon: ClipboardList, roles: ["super_admin", "admin", "lead"] },
  { name: "Documentation", href: "/admin/documentation", icon: FileText, roles: ["super_admin", "admin", "lead"] },
  { name: "Job Descriptions", href: "/admin/job-descriptions", icon: Briefcase, roles: ["super_admin", "admin", "lead"] },
  { name: "Feedback", href: "/admin/feedback", icon: MessageSquare, roles: ["super_admin", "admin", "lead"] },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, roles: ["super_admin", "admin", "lead"] },
]

export function AdminSidebar({ user, profile }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const supabase = createClient()

  const getInitials = (email?: string, firstName?: string, lastName?: string): string => {
    if (firstName && lastName) {
      return (firstName[0] + lastName[0]).toUpperCase()
    }
    if (!email) return "U"

    const localPart = email.split("@")[0]
    const parts = localPart.split(".")

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }

    return localPart.substring(0, 2).toUpperCase()
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.push("/auth/login")
  }

  const canAccessRoute = (requiredRoles: string[]) => {
    if (!profile?.role) return false
    return requiredRoles.includes(profile.role)
  }

  const filteredNavigation = adminNavigation.filter((item) => canAccessRoute(item.roles))

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b">
        <Image src="/acob-logo.webp" alt="ACOB Lighting" width={150} height={150} />
      </div>

      {/* Admin Badge & User Profile */}
      <div className="px-6 py-6 border-b space-y-4">
        <div className="flex items-center gap-2">
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Admin Panel
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          <Avatar className="h-12 w-12 ring-2 ring-primary/10">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
              {getInitials(user?.email, profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {profile?.first_name && profile?.last_name
                ? `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
                : user?.email?.split("@")[0]}
            </p>
            {profile?.role && (
              <Badge variant="outline" className={cn("text-xs mt-1", getRoleBadgeColor(profile.role))}>
                {getRoleDisplayName(profile.role)}
              </Badge>
            )}
          </div>
        </div>

        {profile?.lead_departments && profile.lead_departments.length > 0 && (
          <div className="pt-2 text-xs">
            <p className="text-muted-foreground mb-1">Leading:</p>
            <div className="flex flex-wrap gap-1">
              {profile.lead_departments.map((dept) => (
                <Badge key={dept} variant="outline" className="text-xs">
                  {dept}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {filteredNavigation.map((item) => {
          const isActive = item.href === "/admin" 
            ? pathname === "/admin"
            : pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* Back to Portal & Logout */}
      <div className="px-4 py-4 border-t space-y-2">
        <Link href="/dashboard">
          <Button variant="outline" className="w-full justify-start gap-3">
            <LayoutDashboard className="h-5 w-5" />
            Back to Portal
          </Button>
        </Link>
        <Button
          variant="outline"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Logout
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-card border-r">
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Image src="/acob-logo.webp" alt="ACOB Lighting" width={120} height={120} />
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 text-xs">
              Admin
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="h-10 w-10"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-xl flex flex-col">
            <SidebarContent />
          </aside>
        </>
      )}
    </>
  )
}
