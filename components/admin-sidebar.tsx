"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn, formatName, getInitials } from "@/lib/utils"
import { StaffAvatar } from "@/components/ui/staff-avatar"
import { useStaffAvatars } from "@/hooks/use-staff-avatars"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, ChevronRight, LogOut, Settings, ShieldCheck, User, Building2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useSidebar } from "@/components/sidebar-context"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import type { UserRole } from "@/types/database"
import type { DeptConsole } from "@/lib/dept/consoles"
import { getRoleDisplayName } from "@/lib/permissions"
import { motion } from "framer-motion"
import { normalizeDepartmentName } from "@/shared/departments"
import { findActiveBranchHref } from "@/lib/nav/match"
import { usePendingRsvpCount } from "@/components/events/use-events"
import type { NavChild } from "@/lib/nav/types"
import { canAccessRouteV2, resolveAdminRouteKeyV2, type AccessContextV2 } from "@/lib/admin/policy-v2"
import { useDepartmentCode } from "@/hooks/use-department-code"
import { usePublishNavPages } from "@/lib/nav/page-index"
import { depsChanged } from "@/lib/utils/deps-changed"
import {
  buildDeptNavigation,
  normalizeAdminRoutes,
  type NavItem,
  adminNavigation,
  adminSections,
  ADMIN_ROUTE_ALIASES,
} from "./admin-sidebar-nav"

interface AdminSidebarProps {
  user?: {
    email?: string
    user_metadata?: {
      first_name?: string
      last_name?: string
    }
  }
  profile?: {
    id?: string
    first_name?: string
    last_name?: string
    department?: string
    role?: UserRole
    is_department_lead?: boolean
    admin_routes?: string[] | null
    lead_departments?: string[]
  }
  adminScopeMode?: "global" | "lead"
  /**
   * When set, the sidebar knows it is rendered inside the /dept/[deptId]/ shell.
   * Used to:
   *  1. Switch nav links to /dept/[id]/... hrefs so navigation stays in the dept shell.
   *  2. Show a "Go to Admin" link in the account dropdown for admin-like users.
   */
  deptId?: string
  /**
   * Admin shell only: the dept consoles this lead may open. Each is listed in
   * the account dropdown so an admin+lead can jump to any dept shell they hold.
   */
  deptConsoles?: DeptConsole[]
  /** Admin shell only: the viewer is the MD or an MD's Desk delegate. */
  showMdDesk?: boolean
}

export function AdminSidebar({
  user,
  profile,
  adminScopeMode = "global",
  deptId,
  deptConsoles = [],
  showMdDesk = false,
}: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const { isCollapsed } = useSidebar()
  const staffAvatars = useStaffAvatars()
  const accountAvatarUrl = profile?.id ? staffAvatars[profile.id] : undefined
  const { data: pendingRsvps } = usePendingRsvpCount()
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

  const [openSections, setOpenSections] = useState<Set<string>>(new Set())
  const [openSubSections, setOpenSubSections] = useState<Set<string>>(new Set())
  const departmentCode = useDepartmentCode(profile?.department)

  const toggleSection = (href: string) => {
    setOpenSections((prev) => {
      if (prev.has(href)) return new Set<string>()
      return new Set<string>([href])
    })
  }

  const toggleSubSection = (href: string) => {
    setOpenSubSections((prev) => {
      if (prev.has(href)) return new Set<string>()
      return new Set<string>([href])
    })
  }

  // Open the sections holding the current page — adjusted during render, not in an effect.
  const [expandedFor, setExpandedFor] = useState<readonly unknown[] | null>(null)
  const expandedForNext = [pathname, deptId] as const
  if (depsChanged(expandedFor, expandedForNext)) {
    setExpandedFor(expandedForNext)
    if (pathname) {
      // Use dept nav when in dept shell so the correct parent sections auto-expand.
      const nav = deptId ? buildDeptNavigation(deptId) : adminNavigation
      for (const item of nav) {
        if (!item.children) continue
        for (const child of item.children) {
          const childActive = pathname === child.href || pathname.startsWith(child.href + "/")
          if (childActive) {
            setOpenSections((prev) => new Set([...prev, item.href]))
          }
          if (child.children) {
            const grandchildActive = child.children.some(
              (gc) => pathname === gc.href || pathname.startsWith(gc.href + "/")
            )
            if (grandchildActive) {
              setOpenSections((prev) => new Set([...prev, item.href]))
              setOpenSubSections((prev) => new Set([...prev, child.href]))
            }
          }
        }
      }
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    toast.success("Logged out successfully")
    router.push("/auth/login")
  }

  const adminRoutes = useMemo(() => normalizeAdminRoutes(profile?.admin_routes), [profile?.admin_routes])
  const accessContext = useMemo<AccessContextV2 | null>(() => {
    if (!profile?.role) return null
    const managedDepartmentSet = new Set<string>()
    if (profile.department) {
      managedDepartmentSet.add(normalizeDepartmentName(profile.department))
    }
    for (const department of profile.lead_departments || []) {
      managedDepartmentSet.add(normalizeDepartmentName(department))
    }

    return {
      baseRole: String(profile.role).toLowerCase(),
      isDepartmentLead: Boolean(profile.is_department_lead),
      isAdminLike: ["developer", "admin", "super_admin"].includes(String(profile.role).toLowerCase()),
      adminRoutes,
      actingContext:
        adminScopeMode === "lead" ||
        (!["developer", "admin", "super_admin"].includes(String(profile.role).toLowerCase()) &&
          Boolean(profile.is_department_lead))
          ? "department_lead"
          : "global_admin",
      managedDepartments: Array.from(managedDepartmentSet),
    }
  }, [
    adminRoutes,
    adminScopeMode,
    profile?.department,
    profile?.is_department_lead,
    profile?.lead_departments,
    profile?.role,
  ])

  const canAccessRoute = (requiredRoles: string[], href: string) => {
    if (!profile?.role || !accessContext) return false
    // Legacy role arrays are no longer authoritative under RBAC V2.
    // Use centralized policy evaluation so department leads with base role "employee"
    // still see allowed admin routes.
    void requiredRoles
    return canAccessRouteV2(accessContext, resolveAdminRouteKeyV2(href))
  }

  // In the dept shell use dept-scoped hrefs; roles[] is empty so canAccessRoute
  // is bypassed — access is already guarded by requireDeptScope on the server.
  const activeNavigation = deptId ? buildDeptNavigation(deptId) : adminNavigation

  /**
   * Children and grandchildren carry their own grantable route keys (a nested
   * "Inventory" resolves to inventory.main, not to its parent's key), so they
   * are filtered individually rather than inheriting the parent's visibility.
   * A branch survives if it is reachable itself or if any descendant is; when
   * only a descendant is reachable, the branch link retargets to it so the
   * parent never points at a page the viewer is blocked from.
   */
  const filterNavChildren = (children: NavChild[] | undefined): NavChild[] | undefined => {
    if (!children) return undefined
    const kept: NavChild[] = []
    for (const child of children) {
      const grandchildren = child.children?.filter((gc) => canAccessRoute([], gc.href))
      const selfAllowed = canAccessRoute([], child.href)
      if (!selfAllowed && !grandchildren?.length) continue
      kept.push({
        ...child,
        href: selfAllowed ? child.href : grandchildren![0].href,
        retargeted: !selfAllowed,
        children: grandchildren?.length ? grandchildren : undefined,
      })
    }
    return kept.length ? kept : undefined
  }

  const filteredNavigation = deptId
    ? activeNavigation
    : activeNavigation.reduce<NavItem[]>((acc, item) => {
        if (item.href === "/admin/md-desk" && !showMdDesk) return acc
        const children = filterNavChildren(item.children)
        const selfAllowed = canAccessRoute(item.roles, item.href)
        if (!selfAllowed && !children) return acc
        const badge = item.href === "/admin/events" && pendingRsvps && pendingRsvps > 0 ? pendingRsvps : undefined
        acc.push({
          ...item,
          href: selfAllowed ? item.href : children![0].href,
          retargeted: !selfAllowed,
          children,
          badge,
        })
        return acc
      }, [])

  const groupedNavigation = adminSections
    .map((section) => ({
      ...section,
      items: filteredNavigation.filter((item) => item.section === section.key),
    }))
    .filter((section) => section.items.length > 0)
  // The navbar search offers these pages too, so it never lists one the viewer cannot open.
  usePublishNavPages(groupedNavigation)

  const activeTopLevelHref = useMemo(() => {
    const shellRoot = deptId ? `/dept/${deptId}` : "/admin"
    return findActiveBranchHref(activeNavigation, pathname, ADMIN_ROUTE_ALIASES, (href) => href === shellRoot)
  }, [pathname, activeNavigation, deptId])

  // True for roles that can access the /admin shell (developer / admin / super_admin).
  const isAdminLikeUser = ["developer", "admin", "super_admin"].includes(String(profile?.role || "").toLowerCase())

  // After Phase 6, pure leads no longer enter /admin.
  // The isLead flag here only applies to admin+lead users in the admin shell.
  const isLead = Boolean(
    profile?.is_department_lead || (profile?.lead_departments && profile.lead_departments.length > 0)
  )

  const accountName =
    profile?.first_name && profile?.last_name
      ? `${formatName(profile.first_name)} ${formatName(profile.last_name)}`
      : user?.email?.split("@")[0] || "Account"
  const accountDepartment = profile?.department
    ? `${departmentCode || formatName(profile.department)}${isLead ? " (Lead)" : ""}`
    : null
  const accountRole = profile?.role ? getRoleDisplayName(profile.role) : null

  const sidebarJSX = (
    <>
      {/* Empty space for logo (moved to navbar) */}
      <div className={cn("transition-[padding] duration-300 ease-in-out", isCollapsed ? "px-2 py-2" : "px-3 py-2")}>
        {/* Logo space maintained but empty */}
      </div>

      {/* Navigation */}
      <nav className="scrollbar-custom flex-1 space-y-0.5 overflow-y-auto px-2.5 py-3">
        {groupedNavigation.map((section) => (
          <div key={section.key} className="space-y-0.5">
            {isCollapsed ? (
              // Collapsed the headings are gone, so a rule stands in for them —
              // otherwise the rail is one undifferentiated column of icons.
              section.key !== "overview" && (
                <div className="mx-1.5 my-1.5 border-t border-[var(--admin-sidebar-border)]" />
              )
            ) : (
              <p className="text-muted-foreground px-3 pt-1 pb-1 text-xs font-semibold">{section.label}</p>
            )}
            {section.items.map((item) => {
              const hasChildren = !isCollapsed && item.children && item.children.length > 0
              const isOpen = openSections.has(item.href)
              const highlighted = item.href === activeTopLevelHref
              const activeCls =
                "bg-[var(--admin-primary)] text-white shadow-sm dark:text-[var(--admin-primary-foreground)]"
              const inactiveCls =
                "text-muted-foreground hover:bg-[var(--admin-accent-soft)] hover:text-[var(--admin-primary)]"

              return (
                <div key={item.name}>
                  {hasChildren ? (
                    <div
                      className={cn(
                        "flex min-h-9 items-center rounded-md text-sm font-medium transition-colors duration-150",
                        highlighted ? activeCls : inactiveCls
                      )}
                    >
                      {item.retargeted ? (
                        <button
                          type="button"
                          onClick={() => toggleSection(item.href)}
                          className="flex flex-1 items-center gap-2.5 px-3 py-2 text-left"
                          aria-expanded={isOpen}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 overflow-hidden whitespace-nowrap">{item.name}</span>
                        </button>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex flex-1 items-center gap-2.5 px-3 py-2"
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          <span className="flex-1 overflow-hidden whitespace-nowrap">{item.name}</span>
                        </Link>
                      )}
                      <button
                        onClick={() => toggleSection(item.href)}
                        className="flex items-center px-2 py-2"
                        aria-label={isOpen ? "Collapse" : "Expand"}
                      >
                        <ChevronRight
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
                            isOpen && "rotate-90"
                          )}
                        />
                      </button>
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex min-h-9 items-center rounded-md transition-[padding,gap,background-color,color] duration-300 ease-in-out",
                            isCollapsed ? "justify-center px-2.5 py-2" : "gap-2.5 px-3 py-2",
                            "text-sm font-medium",
                            highlighted ? activeCls : inactiveCls
                          )}
                        >
                          <span className="relative inline-flex items-center">
                            <item.icon className="h-4 w-4 shrink-0" />
                            {isCollapsed && item.badge != null && item.badge > 0 && (
                              <span className="ring-background absolute -top-1 -right-1 flex h-2 w-2 rounded-full bg-rose-500 ring-2">
                                <span className="sr-only">{item.badge} pending</span>
                              </span>
                            )}
                          </span>
                          <span
                            className={cn(
                              "overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-300 ease-in-out",
                              isCollapsed ? "max-w-0 opacity-0" : "max-w-full opacity-100"
                            )}
                          >
                            {item.name}
                          </span>
                          {!isCollapsed && item.badge != null && item.badge > 0 && (
                            <span
                              className={cn(
                                "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tracking-tight",
                                highlighted ? "bg-primary-foreground text-primary" : "bg-rose-500 text-white"
                              )}
                            >
                              {item.badge > 99 ? "99+" : item.badge}
                            </span>
                          )}
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right">
                          {item.description ? `${item.name} — ${item.description}` : item.name}
                          {item.badge != null && item.badge > 0 && ` (${item.badge} pending)`}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  )}

                  {hasChildren && isOpen && (
                    <div className="mt-0.5 ml-3 space-y-0.5 border-l border-[var(--admin-sidebar-border)] pl-2">
                      {item.children!.map((child) => {
                        const hasSubChildren = child.children && child.children.length > 0
                        const isSubOpen = openSubSections.has(child.href)
                        const isChildActive = pathname === child.href || pathname?.startsWith(child.href + "/")
                        const hasActiveGrandchild = child.children?.some(
                          (gc) => pathname === gc.href || pathname?.startsWith(gc.href + "/")
                        )
                        const childHighlighted = isChildActive || Boolean(hasActiveGrandchild)

                        return (
                          <div key={child.href}>
                            {hasSubChildren ? (
                              <div
                                className={cn(
                                  "flex min-h-8 items-center rounded-md text-sm font-medium transition-colors duration-150",
                                  childHighlighted ? activeCls : inactiveCls
                                )}
                              >
                                {child.retargeted ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleSubSection(child.href)}
                                    className="flex flex-1 items-center px-2 py-1.5 text-left"
                                    aria-expanded={isSubOpen}
                                  >
                                    {child.name}
                                  </button>
                                ) : (
                                  <Link
                                    href={child.href}
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="flex flex-1 items-center px-2 py-1.5"
                                  >
                                    {child.name}
                                  </Link>
                                )}
                                <button
                                  onClick={() => toggleSubSection(child.href)}
                                  className="flex items-center px-1.5 py-1.5"
                                  aria-label={isSubOpen ? "Collapse" : "Expand"}
                                >
                                  <ChevronRight
                                    className={cn(
                                      "h-3 w-3 shrink-0 transition-transform duration-200",
                                      isSubOpen && "rotate-90"
                                    )}
                                  />
                                </button>
                              </div>
                            ) : (
                              <Link
                                href={child.href}
                                onClick={() => setIsMobileMenuOpen(false)}
                                className={cn(
                                  "flex min-h-8 items-center rounded-md px-2 py-1.5 text-sm font-medium transition-colors duration-150",
                                  isChildActive ? activeCls : inactiveCls
                                )}
                              >
                                {child.name}
                              </Link>
                            )}

                            {hasSubChildren && isSubOpen && (
                              <div className="mt-0.5 ml-2 space-y-0.5 border-l border-[var(--admin-sidebar-border)] pl-2">
                                {child.children!.map((grandchild) => {
                                  const isGcActive =
                                    pathname === grandchild.href || pathname?.startsWith(grandchild.href + "/")
                                  return (
                                    <Link
                                      key={grandchild.href}
                                      href={grandchild.href}
                                      onClick={() => setIsMobileMenuOpen(false)}
                                      className={cn(
                                        "flex min-h-7 items-center rounded-md px-2 py-1 text-sm font-medium transition-colors duration-150",
                                        isGcActive ? activeCls : inactiveCls
                                      )}
                                    >
                                      {grandchild.name}
                                    </Link>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="border-t px-2.5 py-2.5">
        <DropdownMenu>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="text-muted-foreground min-h-13 w-full justify-center px-2.5 text-sm transition-[padding,gap,background-color,color] duration-300 ease-in-out hover:bg-[var(--admin-accent-soft)] hover:text-[var(--admin-primary)]"
                  >
                    <div className="flex items-center">
                      <StaffAvatar
                        name={accountName}
                        src={accountAvatarUrl}
                        initials={getInitials(user?.email, profile?.first_name, profile?.last_name)}
                        className="ring-primary/10 h-7 w-7 ring-2"
                        fallbackClassName="bg-primary text-primary-foreground text-xs font-semibold"
                      />
                    </div>
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="right">Account</TooltipContent>
            </Tooltip>
          ) : (
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="text-muted-foreground min-h-13 w-full justify-between px-3 text-sm transition-[padding,gap,background-color,color] duration-300 ease-in-out hover:bg-[var(--admin-accent-soft)] hover:text-[var(--admin-primary)]"
              >
                <div className="flex items-center gap-2.5">
                  <StaffAvatar
                    name={accountName}
                    src={accountAvatarUrl}
                    initials={getInitials(user?.email, profile?.first_name, profile?.last_name)}
                    className="ring-primary/10 h-7 w-7 ring-2"
                    fallbackClassName="bg-primary text-primary-foreground text-xs font-semibold"
                  />
                  <div
                    className={cn(
                      "min-w-0 overflow-hidden transition-[max-width,opacity] duration-300 ease-in-out",
                      "max-w-full opacity-100"
                    )}
                  >
                    <p className="truncate text-left text-sm font-medium">{accountName}</p>
                    {(accountDepartment || accountRole) && (
                      <p className="truncate text-left text-xs opacity-75">
                        {[accountDepartment, accountRole].filter(Boolean).join(" • ")}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronsUpDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
          )}
          <DropdownMenuContent
            align="end"
            side="top"
            className="z-[70] w-[var(--radix-dropdown-menu-trigger-width)] min-w-52 border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)]"
          >
            <DropdownMenuItem
              asChild
              className="cursor-pointer text-[var(--admin-sidebar-foreground)] focus:bg-[var(--admin-accent-soft)] focus:text-[var(--admin-primary)] data-[highlighted]:bg-[var(--admin-accent-soft)] data-[highlighted]:text-[var(--admin-primary)]"
            >
              <Link href="/profile" className="flex w-full items-center gap-2">
                <User className="h-4 w-4" />
                Dashboard
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer text-[var(--admin-sidebar-foreground)] focus:bg-[var(--admin-accent-soft)] focus:text-[var(--admin-primary)] data-[highlighted]:bg-[var(--admin-accent-soft)] data-[highlighted]:text-[var(--admin-primary)]"
            >
              <Link href="/admin/settings" className="flex w-full items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              asChild
              className="cursor-pointer text-[var(--admin-sidebar-foreground)] focus:bg-[var(--admin-accent-soft)] focus:text-[var(--admin-primary)] data-[highlighted]:bg-[var(--admin-accent-soft)] data-[highlighted]:text-[var(--admin-primary)]"
            >
              {/* Personal settings, which the admin shell otherwise has no route
                  to. Distinct from the org settings above, hence the label. */}
              <Link href="/settings" className="flex w-full items-center gap-2">
                <User className="h-4 w-4" />
                My Settings
              </Link>
            </DropdownMenuItem>
            {deptConsoles
              .filter((console) => console.id !== deptId)
              .map((console) => (
                <DropdownMenuItem
                  key={console.id}
                  asChild
                  className="cursor-pointer text-[var(--admin-sidebar-foreground)] focus:bg-[var(--admin-accent-soft)] focus:text-[var(--admin-primary)] data-[highlighted]:bg-[var(--admin-accent-soft)] data-[highlighted]:text-[var(--admin-primary)]"
                >
                  <Link href={console.href} className="flex w-full items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {deptConsoles.length > 1 ? console.name : "Go to Dept"}
                  </Link>
                </DropdownMenuItem>
              ))}
            {deptId && isAdminLikeUser && (
              <DropdownMenuItem
                asChild
                className="cursor-pointer text-[var(--admin-sidebar-foreground)] focus:bg-[var(--admin-accent-soft)] focus:text-[var(--admin-primary)] data-[highlighted]:bg-[var(--admin-accent-soft)] data-[highlighted]:text-[var(--admin-primary)]"
              >
                <Link href="/admin" className="flex w-full items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Go to Admin
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => setShowLogoutConfirm(true)}
              className="flex cursor-pointer items-center gap-2 text-[var(--admin-sidebar-foreground)] focus:bg-[var(--admin-accent-soft)] focus:text-[var(--admin-primary)] data-[highlighted]:bg-[var(--admin-accent-soft)] data-[highlighted]:text-[var(--admin-primary)]"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
        className="hidden overflow-hidden border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] lg:fixed lg:top-16 lg:bottom-0 lg:flex lg:flex-col"
      >
        {sidebarJSX}
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
            "fixed inset-y-0 left-0 z-[60] flex w-64 flex-col border-r border-[var(--admin-sidebar-border)] bg-[var(--admin-sidebar-bg)] shadow-xl transition-transform duration-300 ease-out lg:hidden",
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarJSX}
        </aside>
      </>
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm logout</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to logout?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleLogout}>Logout</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
