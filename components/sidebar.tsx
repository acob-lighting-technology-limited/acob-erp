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
  Laptop,
  ClipboardList,
  FileText,
  Briefcase,
  Package,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import Image from "next/image"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSidebar } from "./sidebar-context"

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
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Job Description", href: "/job-description", icon: Briefcase },
  { name: "My Tasks", href: "/tasks", icon: ClipboardList },
  { name: "My Devices", href: "/devices", icon: Laptop },
  { name: "My Assets", href: "/assets", icon: Package },
  { name: "Documentation", href: "/documentation", icon: FileText },
  { name: "Feedback", href: "/feedback", icon: MessageSquare },
  { name: "Signature", href: "/signature", icon: FileSignature },
  { name: "Watermark", href: "/watermark", icon: Droplet },
]

export function Sidebar({ user, profile, isAdmin }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { isCollapsed, setIsCollapsed } = useSidebar()

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
      <div className={cn("", isCollapsed ? "px-2 py-8" : "px-6 py-8")}>
        {/* Logo space maintained but empty */}
      </div>

      {/* User Profile Section */}
      <div className={cn(
        "border-b transition-all duration-300 py-6",
        isCollapsed ? "mx-auto" : "px-6"
      )}>
        <div className="flex items-center gap-3">
          <Avatar className={cn("ring-2 ring-primary/10 transition-all duration-300 flex-shrink-0 h-12 w-12")}>
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
              {getInitials(user?.email, profile?.first_name, profile?.last_name)}
            </AvatarFallback>
          </Avatar>
          <div className={cn(
            "transition-all duration-300 overflow-hidden",
            isCollapsed 
              ? "w-0 opacity-0 max-w-0" 
              : "w-auto opacity-100 max-w-full flex-1 min-w-0"
          )}>
            <div className={cn("transition-all duration-300 overflow-hidden", isCollapsed ? "max-h-0 opacity-0" : "max-h-20 opacity-100")}>
              <p className="text-sm font-semibold text-foreground truncate whitespace-nowrap">
                {profile?.first_name && profile?.last_name
                  ? `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
                  : user?.email?.split("@")[0]}
              </p>
              <p className="text-xs text-muted-foreground truncate whitespace-nowrap">{profile?.department || "Staff Member"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center rounded-lg transition-all duration-300",
                isCollapsed
                  ? "justify-center px-3 py-3"
                  : "gap-3 px-4 py-3",
                "text-sm font-medium min-h-[44px]",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span className={cn("transition-all duration-300 overflow-hidden whitespace-nowrap", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 ml-0")}>{item.name}</span>
            </Link>
          )
        })}

        {(isAdmin || profile?.role === "lead" || profile?.role === "admin" || profile?.role === "super_admin") && (
          <>
            <div className={cn("transition-all duration-300 overflow-hidden", isCollapsed ? "h-0 opacity-0" : "h-auto opacity-100")}>
              <div className="pt-4 pb-2">
                <p className="px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Admin</p>
              </div>
            </div>
            <Link
              href="/admin"
              onClick={() => setIsMobileMenuOpen(false)}
              className={cn(
                "flex items-center rounded-lg transition-all duration-300 min-h-[44px]",
                isCollapsed
                  ? "justify-center px-3 py-3"
                  : "gap-3 px-4 py-3",
                "text-sm font-medium",
                pathname === "/admin"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
              title={isCollapsed ? "Admin Dashboard" : undefined}
            >
              <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              <span className={cn("transition-all duration-300 overflow-hidden whitespace-nowrap", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 ml-0")}>Admin Dashboard</span>
            </Link>
          </>
        )}
      </nav>

      {/* Logout Button */}
      <div className="px-4 py-4 border-t">
        <Button
          variant="outline"
          className={cn(
            "w-full text-muted-foreground hover:text-foreground transition-all duration-300 min-h-[44px]",
            isCollapsed ? "justify-center px-3" : "justify-start gap-3"
          )}
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className={cn("transition-all duration-300 overflow-hidden whitespace-nowrap", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100 ml-0")}>Logout</span>
        </Button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 bg-card border-r transition-all duration-300",
          isCollapsed ? "lg:w-20" : "lg:w-64"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-card border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <Image src="/acob-logo.webp" alt="ACOB Lighting" width={120} height={120} />
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
      <>
        <div
          className={cn(
            "lg:hidden fixed inset-0 bg-background/80 backdrop-blur-sm z-40 transition-opacity duration-300",
            isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <aside 
          className={cn(
            "lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-card border-r shadow-xl flex flex-col transition-transform duration-300 ease-out",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Close button for mobile */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b">
            <Image src="/acob-logo.webp" alt="ACOB Lighting" width={100} height={100} />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsMobileMenuOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <SidebarContent />
        </aside>
      </>
    </>
  )
}
