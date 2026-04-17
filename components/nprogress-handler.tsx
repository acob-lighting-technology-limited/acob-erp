"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import NProgress from "nprogress"

export function NProgressHandler() {
  const pathname = usePathname()

  useEffect(() => {
    const syncNProgressColor = () => {
      const root = document.documentElement
      const adminShell = document.querySelector(".admin-shell") as HTMLElement | null
      if (!adminShell) {
        root.style.removeProperty("--nprogress-color")
        return
      }

      const adminPrimary = getComputedStyle(adminShell).getPropertyValue("--admin-primary").trim()
      if (adminPrimary) {
        root.style.setProperty("--nprogress-color", adminPrimary)
      } else {
        root.style.removeProperty("--nprogress-color")
      }
    }

    syncNProgressColor()

    const observer = new MutationObserver(() => {
      syncNProgressColor()
    })
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-scope", "class"],
    })

    // Start progress on link clicks
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement
      const href = target.href
      const currentUrl = window.location.href

      // Only show progress for internal navigation
      if (href && href !== currentUrl && href.startsWith(window.location.origin)) {
        syncNProgressColor()
        NProgress.start()
      }
    }

    // Start progress on browser back/forward
    const handlePopState = () => {
      syncNProgressColor()
      NProgress.start()
    }

    // Add listeners to all links
    const links = document.querySelectorAll("a")
    links.forEach((link) => link.addEventListener("click", handleAnchorClick))

    window.addEventListener("popstate", handlePopState)

    return () => {
      observer.disconnect()
      links.forEach((link) => link.removeEventListener("click", handleAnchorClick))
      window.removeEventListener("popstate", handlePopState)
    }
  }, [pathname])

  return null
}
