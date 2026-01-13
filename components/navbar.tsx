"use client"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  LogOut,
  Menu,
  X,
  User,
  MessageSquare,
  LayoutDashboard,
  FileSignature,
  ShieldCheck,
  Droplet,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { NotificationBell } from "@/components/notification-bell"
import { UniversalSearch } from "@/components/universal-search"
import Image from "next/image"
import { useSidebarSafe } from "@/components/sidebar-context"
import { useTheme } from "next-themes"
import { ThemeToggle } from "@/components/ui/theme-toggle"

interface NavbarProps {
  user?: {
    email?: string
    user_metadata?: {
      first_name?: string
    }
  }
  isAdmin?: boolean
}

export function Navbar({ user, isAdmin = false }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const { resolvedTheme } = useTheme()

  // Get sidebar context safely (returns null if not available)
  const sidebarContext = useSidebarSafe()
  const { isCollapsed, setIsCollapsed } = sidebarContext || { isCollapsed: false, setIsCollapsed: () => {} }

  // Default to light logo for SSR to prevent hydration mismatch
  const logoSrc = !mounted
    ? "/acob-logo-light.webp"
    : resolvedTheme === "dark"
      ? "/acob-logo-dark.webp"
      : "/acob-logo-light.webp"

  useEffect(() => {
    setMounted(true)
  }, [])

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarStateChange = (e: Event) => {
      const customEvent = e as CustomEvent
      setIsSidebarOpen(customEvent.detail?.isOpen ?? false)
    }
    window.addEventListener("sidebar-state-change", handleSidebarStateChange)
    return () => {
      window.removeEventListener("sidebar-state-change", handleSidebarStateChange)
    }
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.push("/auth/login")
  }

  // Extract initials from email (e.g., "i.chibuikem@..." -> "IC")
  const getInitials = (email?: string): string => {
    if (!email) return "U"

    const localPart = email.split("@")[0] // Get part before @
    const parts = localPart.split(".") // Split by dot

    if (parts.length >= 2) {
      // Get first letter of first part and first letter of second part
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }

    // Fallback: just use first two letters
    return localPart.substring(0, 2).toUpperCase()
  }

  return (
    <nav className="border-border bg-background fixed top-0 right-0 left-0 z-50 w-full overflow-visible border-b">
      <div className="flex h-16 w-full max-w-full items-center overflow-visible">
        {/* Left side - Collapse Button and Logo (aligned with sidebar edge) */}
        {sidebarContext && (
          <div className="hidden h-full items-center lg:flex">
            <Button
              variant="ghost"
              size="icon"
              className="h-full w-10 rounded-none"
              onClick={() => setIsCollapsed(!isCollapsed)}
              title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
            </Button>
            <Link href="/dashboard" className="flex h-full items-center px-4">
              <Image
                key={logoSrc}
                src={logoSrc}
                alt="ACOB Lighting"
                width={150}
                height={150}
                priority
                className="h-8 w-auto"
              />
            </Link>
          </div>
        )}

        {/* Mobile - Logo only */}
        <div className="flex items-center gap-2 px-4 lg:hidden">
          <Link href="/dashboard" className="flex items-center">
            <Image
              key={logoSrc}
              src={logoSrc}
              alt="ACOB Lighting"
              width={150}
              height={150}
              priority
              className="h-8 w-auto"
            />
          </Link>
        </div>

        {/* Right side - search, notifications and user menu */}
        <div className="flex flex-1 items-center justify-end gap-2 overflow-visible px-2 sm:gap-4 sm:px-4 lg:px-8">
          <div className="hidden max-w-md flex-1 items-center gap-4 md:flex">{isAdmin && <UniversalSearch />}</div>
          <div className="hidden items-center gap-4 overflow-visible md:flex">
            <NotificationBell isAdmin={isAdmin} />
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 lg:h-11 lg:w-11">
                  <Avatar className="h-10 w-10 lg:h-11 lg:w-11">
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold lg:text-base">
                      {getInitials(user?.email)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm leading-none font-medium">Account</p>
                    <p className="text-muted-foreground text-xs leading-none">{user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="cursor-pointer">
                    <LayoutDashboard className="mr-2 h-4 w-4" />
                    Dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/feedback" className="cursor-pointer">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Feedback
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/signature" className="cursor-pointer">
                    <FileSignature className="mr-2 h-4 w-4" />
                    Signature
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/watermark" className="cursor-pointer">
                    <Droplet className="mr-2 h-4 w-4" />
                    Watermark
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex cursor-pointer items-center">
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Admin
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden"
            onClick={() => {
              // If sidebar context exists, toggle the sidebar instead of navbar menu
              if (sidebarContext) {
                const event = new CustomEvent("toggle-mobile-sidebar")
                window.dispatchEvent(event)
              } else {
                setIsOpen(!isOpen)
              }
            }}
          >
            {sidebarContext && isSidebarOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu - Only show if no sidebar context */}
      {isOpen && !sidebarContext && (
        <div className="border-border space-y-2 border-t py-4 md:hidden">
          <div className={`flex items-center px-4 py-2 mb-2${isCollapsed ? "" : "gap-3"}`}>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {getInitials(user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <p className="text-sm font-medium">Account</p>
              <p className="text-muted-foreground text-xs">{user?.email}</p>
            </div>
          </div>
          <Link href="/dashboard" className="hover:bg-accent flex items-center gap-2 rounded px-4 py-2 text-sm">
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link href="/profile" className="hover:bg-accent flex items-center gap-2 rounded px-4 py-2 text-sm">
            <User className="h-4 w-4" />
            Profile
          </Link>
          <Link href="/feedback" className="hover:bg-accent flex items-center gap-2 rounded px-4 py-2 text-sm">
            <MessageSquare className="h-4 w-4" />
            Feedback
          </Link>
          <Link href="/signature" className="hover:bg-accent flex items-center gap-2 rounded px-4 py-2 text-sm">
            <FileSignature className="h-4 w-4" />
            Signature
          </Link>
          <Link href="/watermark" className="hover:bg-accent flex items-center gap-2 rounded px-4 py-2 text-sm">
            <Droplet className="h-4 w-4" />
            Watermark
          </Link>
          {isAdmin && (
            <>
              <div className="border-border my-2 border-t"></div>
              <Link href="/admin" className="hover:bg-accent flex items-center gap-2 rounded px-4 py-2 text-sm">
                <ShieldCheck className="h-4 w-4" />
                Admin
              </Link>
            </>
          )}
          <div className="border-border my-2 border-t"></div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="w-full justify-start">
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      )}
    </nav>
  )
}
