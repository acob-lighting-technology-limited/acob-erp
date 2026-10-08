"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import NProgress from "nprogress"

export function NProgressHandler() {
  const pathname = usePathname()

  useEffect(() => {
    // Bar colour is CSS: --primary, which globals.css retints on <html> for
    // admin (gold) and dept (navy) pages. No JS sync needed.

    // Start progress on link clicks
    const handleAnchorClick = (e: MouseEvent) => {
      const target = e.currentTarget as HTMLAnchorElement
      const href = target.href
      const currentUrl = window.location.href

      // Only show progress for internal navigation
      if (href && href !== currentUrl && href.startsWith(window.location.origin)) {
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
  }, [pathname])

  return null
}
