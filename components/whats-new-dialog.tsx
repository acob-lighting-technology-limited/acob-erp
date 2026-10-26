"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { activeAnnouncements, type Announcement } from "@/lib/whats-new"

// Ids already shown on this device. Per-device by design: seeing a heads-up
// once more on a second device is harmless, and it needs no table.
const SEEN_KEY = "acob-whats-new-seen"
// The photo prompt's key — while that popup is due, this one waits a load
// rather than stacking a second dialog on top of it.
const AVATAR_DIALOG_KEY = "acob-avatar-dialog-dismissed-until"
// `?whats-new=1` opens every active announcement, seen or not, for previewing.
const PREVIEW_PARAM = "whats-new"

function readSeen(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(SEEN_KEY) || "[]")
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []
  } catch {
    return []
  }
}

interface WhatsNewDialogProps {
  hasAvatar: boolean
}

export function WhatsNewDialog({ hasAvatar }: WhatsNewDialogProps) {
  const [items, setItems] = useState<Announcement[]>([])
  const [open, setOpen] = useState(false)
  const [isPreview, setIsPreview] = useState(false)

  // Decided once on mount, so client-side navigation doesn't re-open it.
  useEffect(() => {
    const active = activeAnnouncements()
    if (new URLSearchParams(window.location.search).get(PREVIEW_PARAM) === "1") {
      setIsPreview(true)
      setItems(active)
      setOpen(active.length > 0)
      return
    }

    if (!hasAvatar) {
      try {
        const until = Number(window.localStorage.getItem(AVATAR_DIALOG_KEY) || 0)
        if (until <= Date.now()) return
      } catch {
        return
      }
    }

    const seen = new Set(readSeen())
    const unseen = active.filter((a) => !seen.has(a.id))
    setItems(unseen)
    setOpen(unseen.length > 0)
  }, [hasAvatar])

  function dismiss() {
    setOpen(false)
    if (isPreview) return
    try {
      const seen = new Set(readSeen())
      for (const item of items) seen.add(item.id)
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]))
    } catch {
      // Storage unavailable: the heads-up simply shows again next load.
    }
  }

  if (items.length === 0) return null
  const single = items.length === 1 ? items[0] : null

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="bg-primary/10 text-primary mb-2 flex h-14 w-14 items-center justify-center rounded-full">
            <Sparkles className="h-7 w-7" aria-hidden />
          </div>
          <DialogTitle>{single ? single.title : "What's new"}</DialogTitle>
          {single ? (
            <DialogDescription>{single.body}</DialogDescription>
          ) : (
            <DialogDescription>A few things changed since you were last here.</DialogDescription>
          )}
        </DialogHeader>

        {!single && (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border p-3">
                <p className="text-foreground text-sm font-semibold">{item.title}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-normal">{item.body}</p>
                {item.href && (
                  <Link
                    href={item.href}
                    onClick={dismiss}
                    className="text-primary mt-2 inline-block text-xs font-medium hover:underline"
                  >
                    {item.cta || "Take a look"}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}

        <DialogFooter className="gap-2 sm:justify-center">
          <Button variant="outline" onClick={dismiss}>
            Got it
          </Button>
          {single?.href && (
            <Button asChild onClick={dismiss}>
              <Link href={single.href}>{single.cta || "Take a look"}</Link>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
