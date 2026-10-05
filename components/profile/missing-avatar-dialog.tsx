"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Camera } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Like the banner, cancelling only hides the popup for a day; it returns until a
// photo is uploaded. Kept on its own key so dismissing one doesn't hide the other.
const DISMISS_KEY = "acob-avatar-dialog-dismissed-until"
const DISMISS_MS = 24 * 60 * 60 * 1000
// `?photo-prompt=1` forces the popup open, so it can be previewed by someone who has a photo.
const PREVIEW_PARAM = "photo-prompt"

interface MissingAvatarDialogProps {
  hasAvatar: boolean
}

export function MissingAvatarDialog({ hasAvatar }: MissingAvatarDialogProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [isPreview, setIsPreview] = useState(false)

  // Decided once on mount, so client-side navigation doesn't re-open it.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === "1") {
      setIsPreview(true)
      setOpen(true)
      return
    }
    // /profile already has the upload control front and centre.
    if (hasAvatar || window.location.pathname === "/profile") return
    try {
      const until = Number(window.localStorage.getItem(DISMISS_KEY) || 0)
      setOpen(until <= Date.now())
    } catch {
      setOpen(true)
    }
  }, [hasAvatar])

  useEffect(() => {
    function handleAvatarChanged(event: Event) {
      const url = (event as CustomEvent<{ avatarUrl: string | null }>).detail?.avatarUrl
      if (url) setOpen(false)
    }
    window.addEventListener("profile-avatar-changed", handleAvatarChanged)
    return () => window.removeEventListener("profile-avatar-changed", handleAvatarChanged)
  }, [])

  function dismiss() {
    setOpen(false)
    if (isPreview) return
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS))
    } catch {
      // Storage unavailable: popup simply returns on next load.
    }
  }

  if (!isPreview && (hasAvatar || pathname === "/profile")) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Camera className="h-7 w-7" aria-hidden />
          </div>
          <DialogTitle>Add your profile photo</DialogTitle>
          <DialogDescription>
            You haven&apos;t uploaded a photo yet. It helps colleagues recognise you across the platform and appears on
            your birthday page.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={dismiss}>
            Cancel
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href="/profile">Upload photo</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
