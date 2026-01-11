"use client"

import { useEffect } from "react"
import NProgress from "nprogress"

// Helper to check if navigating between dashboard and admin
function isAdminDashboardNavigation(fromHref: string, toHref: string): boolean {
  const fromPath = new URL(fromHref).pathname
  const toPath = new URL(toHref).pathname

  const adminPaths = ["/admin"]
  const dashboardPaths = [
    "/dashboard",
    "/profile",
    "/projects",
    "/tasks",
    "/assets",
    "/payments",
    "/feedback",
    "/signature",
    "/watermark",
    "/documentation",
    "/job-description",
  ]

  const isFromAdmin = adminPaths.some((p) => fromPath.startsWith(p))
  const isFromDashboard = dashboardPaths.some((p) => fromPath.startsWith(p)) || fromPath === "/"

  const isToAdmin = adminPaths.some((p) => toPath.startsWith(p))
  const isToDashboard = dashboardPaths.some((p) => toPath.startsWith(p)) || toPath === "/"

  // Return true if navigating between admin and dashboard (in either direction)
  return (isFromAdmin && isToDashboard) || (isFromDashboard && isToAdmin)
}

export function NProgressHandler() {
  useEffect(() => {
    // Start progress on link clicks
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement
      const href = target.href
      const currentUrl = window.location.href

      // Only show progress for internal navigation
      if (href && href !== currentUrl && href.startsWith(window.location.origin)) {
        // Don't start NProgress if this is an admin<->dashboard navigation
        // Those use the custom staircase transition instead
        if (isAdminDashboardNavigation(currentUrl, href)) {
          return
        }
        NProgress.start()
      }
    }

    // Start progress on browser back/forward
    const handlePopState = () => {
      NProgress.start()
    }

    // Add listeners to all links
    const links = document.querySelectorAll("a")
    links.forEach((link) => link.addEventListener("click", handleAnchorClick))

    window.addEventListener("popstate", handlePopState)

    return () => {
      links.forEach((link) => link.removeEventListener("click", handleAnchorClick))
      window.removeEventListener("popstate", handlePopState)
    }
  }, [])

  return null
}
