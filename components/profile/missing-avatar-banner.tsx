"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"

// Dismissal only hides the banner for a day; it returns until a photo is uploaded.
const DISMISS_KEY = "acob-avatar-banner-dismissed-until"
const DISMISS_MS = 24 * 60 * 60 * 1000

interface MissingAvatarBannerProps {
  hasAvatar: boolean
}

export function MissingAvatarBanner({ hasAvatar }: MissingAvatarBannerProps) {
  const pathname = usePathname()
  const [avatarAdded, setAvatarAdded] = useState(false)
  // Hidden until mounted so a dismissed banner never flashes on load.
  const [isDismissed, setIsDismissed] = useState(true)

  useEffect(() => {
    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
      setIsDismissed(until > Date.now())
    } catch {
      setIsDismissed(false)
    }
  }, [])

  useEffect(() => {
    function handleAvatarChanged(event: Event) {
      const url = (event as CustomEvent<{ avatarUrl: string | null }>).detail?.avatarUrl
      setAvatarAdded(Boolean(url))
    }
    window.addEventListener("profile-avatar-changed", handleAvatarChanged)
    return () => window.removeEventListener("profile-avatar-changed", handleAvatarChanged)
  }, [])

  const bannerRef = useRef<HTMLDivElement | null>(null)
  const isVisible = !hasAvatar && !avatarAdded && !isDismissed

  // Publish the banner height so other sticky elements (data-table toolbars) stack below it.
  useEffect(() => {
    const rootStyle = document.documentElement.style
    const node = bannerRef.current
    if (!isVisible || !node) {
      rootStyle.setProperty("--app-banner-h", "0px")
      return
    }
    const measure = () => rootStyle.setProperty("--app-banner-h", `${node.offsetHeight}px`)
    measure()
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure)
    observer?.observe(node)
    return () => {
      observer?.disconnect()
      rootStyle.setProperty("--app-banner-h", "0px")
    }
  }, [isVisible])

  function handleDismiss() {
    setIsDismissed(true)
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    } catch {
      // Storage unavailable: banner simply returns on next load.
    }
  }

  if (!isVisible) {
    return null
  }

  // /profile is the landing page and already has the upload control, so point at it
  // instead of linking to the page the user is on.
  const isOnProfile = pathname === "/profile"

  return (
    <div
      ref={bannerRef}
      role="status"
      // Sticks just under the fixed h-16 navbar; opaque so scrolled content doesn't show through.
      className="sticky top-16 z-30 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 md:px-6 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
    >
      <Camera className="h-4 w-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        <span className="font-medium">You haven&apos;t added a profile photo.</span>{" "}
        <span className="max-sm:hidden">
          {isOnProfile
            ? "Tap the camera on your picture below. It helps colleagues recognise you and appears on your birthday page."
            : "Add one so colleagues can recognise you. It also appears on your birthday page."}
        </span>
      </p>
      {!isOnProfile && (
        <Button asChild size="sm" className="h-8 shrink-0">
          <Link href="/profile">Upload photo</Link>
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
        onClick={handleDismiss}
        aria-label="Remind me tomorrow"
        title="Remind me tomorrow"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
