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
  Package,
  ClipboardList,
  FileText,
  MessageSquare,
  ScrollText,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Briefcase,
  FolderKanban,
  CreditCard,
  Calendar,
  Target,
} from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSidebar } from "@/components/sidebar-context"
import type { UserRole } from "@/types/database"
import { getRoleDisplayName, getRoleBadgeColor } from "@/lib/permissions"
import { motion, AnimatePresence } from "framer-motion"

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
  { name: "HR Administration", href: "/admin/hr", icon: Calendar, roles: ["super_admin", "admin", "lead"] },
  { name: "Finance", href: "/admin/finance", icon: CreditCard, roles: ["super_admin", "admin"] },
  { name: "Inventory", href: "/admin/inventory", icon: Package, roles: ["super_admin", "admin"] },
  { name: "Purchasing", href: "/admin/purchasing", icon: Briefcase, roles: ["super_admin", "admin"] },
  { name: "Project Management", href: "/admin/projects", icon: FolderKanban, roles: ["super_admin", "admin", "lead"] },
  { name: "Task Management", href: "/admin/tasks", icon: ClipboardList, roles: ["super_admin", "admin", "lead"] },
  { name: "Asset Management", href: "/admin/assets", icon: Package, roles: ["super_admin", "admin", "lead"] },
  { name: "Documentation", href: "/admin/documentation", icon: FileText, roles: ["super_admin", "admin", "lead"] },
  { name: "Feedback", href: "/admin/feedback", icon: MessageSquare, roles: ["super_admin", "admin", "lead"] },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText, roles: ["super_admin", "admin", "lead"] },
  { name: "Settings", href: "/admin/settings", icon: Target, roles: ["super_admin"] },
]

export function AdminSidebar({ user, profile }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isCollapsed } = useSidebar()
  const supabase = createClient()

  // Listen for toggle event from navbar
  useEffect(() => {
    const handleToggle = (e: Event) => {
      e.preventDefault()
      e.stopPropagation()
      setIsMobileMenuOpen((prev) => !prev)
    }
    window.addEventListener("toggle-mobile-sidebar", handleToggle)
    document.addEventListener("toggle-mobile-sidebar", handleToggle)
    return () => {
      window.removeEventListener("toggle-mobile-sidebar", handleToggle)
      document.removeEventListener("toggle-mobile-sidebar", handleToggle)
    }
  }, [])

  // Notify navbar of sidebar state changes
  useEffect(() => {
    const event = new CustomEvent("sidebar-state-change", {
      detail: { isOpen: isMobileMenuOpen },
    })
    window.dispatchEvent(event)
  }, [isMobileMenuOpen])

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
      {/* Empty space for logo (moved to navbar) */}
      <div className={cn("transition-[padding] duration-300 ease-in-out", isCollapsed ? "px-2 py-2" : "px-3 py-2")}>
        {/* Logo space maintained but empty */}
      </div>

      {/* Admin Badge & User Profile - Fixed height container */}
      <div
        className={cn(
          "flex min-h-[80px] flex-col border-b py-2.5 transition-[padding,margin] duration-300 ease-in-out",
          isCollapsed ? "mx-0 items-center px-0" : "px-3"
        )}
      >
        {/* Admin Panel Badge - Commented out */}
        {/* <div className={cn("transition-all duration-300 overflow-hidden", isCollapsed ? "max-h-0 opacity-0" : "max-h-10 opacity-100")}>
        <div className="flex items-center gap-2">
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
            <ShieldCheck className="h-3 w-3 mr-1" />
            Admin Panel
          </Badge>
        </div>
        </div> */}

        {/* User Profile - Fixed height container */}
        <div
          className={cn(
            "flex shrink-0 items-center transition-[gap] duration-300 ease-in-out",
            isCollapsed ? "justify-center" : "gap-2.5"
          )}
        >
          <Avatar className={cn("ring-primary/10 shrink-0 ring-2", "h-9 w-9")}>
            <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
              {getInitials(user?.email, profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="min-w-0 flex-1 overflow-hidden"
              >
                <p className="text-foreground truncate text-sm font-semibold whitespace-nowrap">
                  {profile?.first_name && profile?.last_name
                    ? `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
                    : user?.email?.split("@")[0]}
                </p>
                <p className="text-muted-foreground truncate text-xs whitespace-nowrap">
                  {profile?.department || "Staff Member"}
                </p>
                {profile?.role && (
                  <Badge
                    variant="outline"
                    className={cn("mt-0.5 text-xs whitespace-nowrap", getRoleBadgeColor(profile.role))}
                  >
                    {getRoleDisplayName(profile.role)}
                  </Badge>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Leading Departments - Fixed height container */}
        <AnimatePresence mode="wait">
          {!isCollapsed && profile?.lead_departments && profile.lead_departments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="pt-2 text-xs">
                <p className="text-muted-foreground mb-1">Leading:</p>
                <div className="flex flex-wrap gap-1">
                  {profile?.lead_departments?.map((dept) => (
                    <Badge key={dept} variant="outline" className="text-xs">
                      {dept}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-custom flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {filteredNavigation.map((item) => {
          const isActive =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex min-h-[36px] items-center rounded-md transition-[padding,gap,background-color,color] duration-300 ease-in-out",
                isCollapsed ? "justify-center px-2.5 py-2" : "gap-2.5 px-3 py-2",
                "text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <AnimatePresence mode="wait">
                {!isCollapsed && (
                  <motion.span
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: "auto", opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    className="overflow-hidden whitespace-nowrap"
                  >
                    {item.name}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          )
        })}
      </nav>

      {/* Back to Dashboard & Logout */}
      <div className="space-y-1.5 border-t px-2.5 py-2.5">
        <Link href="/dashboard" className="block">
          <Button
            variant="outline"
            className={cn(
              "text-muted-foreground hover:text-foreground min-h-[36px] w-full text-sm transition-[padding,gap] duration-300 ease-in-out",
              isCollapsed ? "justify-center px-2.5" : "justify-start gap-2.5"
            )}
            title={isCollapsed ? "Back to Dashboard" : undefined}
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Back to Dashboard
                </motion.span>
              )}
            </AnimatePresence>
          </Button>
        </Link>
        <Button
          variant="outline"
          className={cn(
            "text-muted-foreground hover:text-foreground min-h-[36px] w-full text-sm transition-[padding,gap] duration-300 ease-in-out",
            isCollapsed ? "justify-center px-2.5" : "justify-start gap-2.5"
          )}
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <AnimatePresence mode="wait">
            {!isCollapsed && (
              <motion.span
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "auto", opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="overflow-hidden whitespace-nowrap"
              >
                Logout
              </motion.span>
            )}
          </AnimatePresence>
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isCollapsed ? 80 : 256,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 30,
        }}
        className="bg-card hidden overflow-hidden border-r lg:fixed lg:top-16 lg:bottom-0 lg:flex lg:flex-col"
      >
        <SidebarContent />
      </motion.aside>

      {/* Mobile Header - Hidden, using navbar instead */}

      {/* Mobile Sidebar */}
      <>
        <div
          className={cn(
            "bg-background/80 fixed inset-0 z-[55] backdrop-blur-sm transition-opacity duration-300 lg:hidden",
            isMobileMenuOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
          )}
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <aside
          className={cn(
            "bg-card fixed inset-y-0 right-0 z-[60] flex w-64 flex-col border-l shadow-xl transition-transform duration-300 ease-out lg:hidden",
            isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          <SidebarContent />
        </aside>
      </>
    </>
  )
}
