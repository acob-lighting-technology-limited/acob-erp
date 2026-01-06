"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, formatName } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  LayoutDashboard,
  User,
  MessageSquare,
  FileSignature,
  Droplet,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  ClipboardList,
  FileText,
  Briefcase,
  Package,
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  CreditCard,
  Calendar,
  Clock,
  Target,
} from "lucide-react"
import Image from "next/image"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSidebar } from "./sidebar-context"
import { motion, AnimatePresence } from "framer-motion"

interface SidebarProps {
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
    is_admin?: boolean
    role?: string
  }
  isAdmin?: boolean
}

const navigation = [
  { name: "Home", href: "/profile", icon: LayoutDashboard }, // Renamed Profile to Home, changed icon to Dashboard icon, points to /profile
  // Removed original Dashboard entry
  { name: "Job Description", href: "/job-description", icon: Briefcase },
  { name: "My Projects", href: "/projects", icon: FolderKanban },
  { name: "My Tasks", href: "/tasks", icon: ClipboardList },
  { name: "My Assets", href: "/assets", icon: Package },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "Documentation", href: "/documentation", icon: FileText },
  { name: "Feedback", href: "/feedback", icon: MessageSquare },
  { name: "Signature", href: "/signature", icon: FileSignature },
  { name: "Watermark", href: "/watermark", icon: Droplet },
]

const hrNavigation = [
  { name: "My Leave", href: "/dashboard/leave", icon: Calendar },
  { name: "My Attendance", href: "/dashboard/attendance", icon: Clock },
  { name: "My Goals", href: "/dashboard/goals", icon: Target },
]

const adminNavigation = [{ name: "Admin Dashboard", href: "/admin", icon: ShieldCheck }]

export function Sidebar({ user, profile, isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isCollapsed, setIsCollapsed } = useSidebar()

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
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.push("/auth/login")
  }

  const SidebarContent = () => (
    <>
      {/* Empty space for logo (moved to navbar) */}
      <div className={cn("transition-[padding] duration-300 ease-in-out", isCollapsed ? "px-2 py-2" : "px-3 py-2")}>
        {/* Logo space maintained but empty */}
      </div>

      {/* Admin Dashboard Indicator */}
      {pathname?.startsWith("/admin") && (
        <div
          className={cn(
            "bg-primary/10 border-primary/20 mx-2 mb-2 rounded-lg border p-1.5 transition-[padding] duration-300 ease-in-out",
            isCollapsed ? "px-1.5" : "px-2"
          )}
        >
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="text-primary h-3.5 w-3.5 flex-shrink-0" />
            <AnimatePresence mode="wait">
              {!isCollapsed && (
                <motion.span
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "auto", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="text-primary overflow-hidden text-xs font-semibold whitespace-nowrap"
                >
                  Admin Mode
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* User Profile Section */}
      <div
        className={cn(
          "border-b py-2.5 transition-[padding,margin] duration-300 ease-in-out",
          isCollapsed ? "mx-auto" : "px-3"
        )}
      >
        <div className="flex items-center gap-2.5">
          <Avatar className={cn("ring-primary/10 h-9 w-9 flex-shrink-0 ring-2")}>
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
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="scrollbar-custom flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {/* Admin Dashboard - Show at top if user has admin access */}
        {(isAdmin || profile?.role === "lead" || profile?.role === "admin" || profile?.role === "super_admin") && (
          <>
            {adminNavigation.map((item) => {
              const isActive = pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center rounded-md transition-[padding,gap,background-color,color] duration-300 ease-in-out",
                    isCollapsed ? "justify-center px-2.5 py-2" : "gap-2.5 px-3 py-2",
                    "min-h-[36px] text-sm font-medium",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
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
            {/* Divider after admin section */}
            <div
              className={cn(
                "my-1.5 border-t transition-[margin] duration-300 ease-in-out",
                isCollapsed ? "mx-1.5" : "mx-0"
              )}
            />
          </>
        )}

        {/* Regular Navigation */}
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center rounded-md transition-[padding,gap,background-color,color] duration-300 ease-in-out",
                isCollapsed ? "justify-center px-2.5 py-2" : "gap-2.5 px-3 py-2",
                "min-h-[36px] text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
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

        {/* HR Section Divider */}
        <div
          className={cn(
            "my-1.5 border-t transition-[margin] duration-300 ease-in-out",
            isCollapsed ? "mx-1.5" : "mx-0"
          )}
        />

        {/* HR Navigation */}
        {hrNavigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + "/")
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center rounded-md transition-[padding,gap,background-color,color] duration-300 ease-in-out",
                isCollapsed ? "justify-center px-2.5 py-2" : "gap-2.5 px-3 py-2",
                "min-h-[36px] text-sm font-medium",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-4 w-4 flex-shrink-0" />
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

      {/* Logout Button */}
      <div className="border-t px-2.5 py-2.5">
        <Button
          variant="outline"
          className={cn(
            "text-muted-foreground hover:text-foreground min-h-[36px] w-full text-sm transition-[padding,gap] duration-300 ease-in-out",
            isCollapsed ? "justify-center px-2.5" : "justify-start gap-2.5"
          )}
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
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
