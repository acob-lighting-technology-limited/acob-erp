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
import { apiFetch } from "@/lib/api-client"
import { activeAnnouncements, type Announcement } from "@/lib/whats-new"
import { logger } from "@/lib/logger"

const log = logger("whats-new-dialog")

// The photo prompt's key — while that popup is due, this one waits a load
// rather than stacking a second dialog on top of it.
const AVATAR_DIALOG_KEY = "acob-avatar-dialog-dismissed-until"
// `?whats-new=1` opens every active announcement, seen or not, for previewing.
const PREVIEW_PARAM = "whats-new"

interface WhatsNewDialogProps {
  hasAvatar: boolean
  /**
   * Announcement ids this person has already dismissed, read server-side.
   * Null when they could not be read — then nothing is shown, rather than
   * risk repeating a heads-up on every load.
   */
  seenIds: string[] | null
}

export function WhatsNewDialog({ hasAvatar, seenIds }: WhatsNewDialogProps) {
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

    if (!seenIds) return
    if (!hasAvatar) {
      try {
        const until = Number(window.localStorage.getItem(AVATAR_DIALOG_KEY) || 0)
        if (until <= Date.now()) return
      } catch {
        return
      }
    }

    const seen = new Set(seenIds)
    const unseen = active.filter((a) => !seen.has(a.id))
    setItems(unseen)
    setOpen(unseen.length > 0)
  }, [hasAvatar, seenIds])

  function dismiss() {
    setOpen(false)
    if (isPreview || items.length === 0) return
    // Best-effort: if it fails, the heads-up simply shows once more.
    void apiFetch("/api/whats-new/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: items.map((item) => item.id) }),
    }).catch((err: unknown) => log.error({ err: String(err) }, "failed to record seen announcements"))
  }

  if (items.length === 0) return null
  const single = items.length === 1 ? items[0] : null
  const Icon = single?.icon ?? Sparkles

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:items-center sm:text-center">
          <div className="bg-primary/10 text-primary mb-2 flex h-14 w-14 items-center justify-center rounded-full">
            <Icon className="h-7 w-7" aria-hidden />
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
