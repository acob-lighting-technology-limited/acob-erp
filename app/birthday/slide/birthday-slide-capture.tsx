"use client"

import { useEffect, useRef, useState } from "react"
import { apiFetch } from "@/lib/api-client"
import { BIRTHDAY_SLIDE_MESSAGE, type BirthdaySlidePayload } from "@/lib/reports/birthday-slide"
import { BirthdayClotheslineStage } from "../birthday-clothesline"
import { BirthdayShell } from "../birthday-spotlight"
import type { Celebrant } from "../birthday-utils"

const SLIDE_WIDTH = 1920
const SLIDE_HEIGHT = 1080

function postToParent(message: BirthdaySlidePayload) {
  window.parent.postMessage({ type: BIRTHDAY_SLIDE_MESSAGE, ...message }, window.location.origin)
}

export function BirthdaySlideCapture({
  start,
  end,
  label,
  captureId,
  accessError,
}: {
  start: string
  end: string
  label: string
  captureId: string
  accessError: string | null
}) {
  const [celebrants, setCelebrants] = useState<Celebrant[] | null>(null)
  const frameRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (accessError) {
      postToParent({ captureId, error: accessError })
      return
    }
    let cancelled = false
    apiFetch(`/api/admin/hr/birthdays?start=${start}&end=${end}&photo=large`)
      .then(async (response) => {
        const payload = await response.json().catch(() => null)
        if (!response.ok) throw new Error(payload?.error || "Failed to load birthdays")
        if (!cancelled) setCelebrants((payload?.data as Celebrant[]) || [])
      })
      .catch((err: unknown) => {
        if (!cancelled)
          postToParent({ captureId, error: err instanceof Error ? err.message : "Failed to load birthdays" })
      })
    return () => {
      cancelled = true
    }
  }, [accessError, captureId, end, start])

  useEffect(() => {
    const frame = frameRef.current
    if (!celebrants || !frame) return
    let cancelled = false
    ;(async () => {
      try {
        // Photos and the display fonts must be in before the screenshot, or it
        // comes out with empty cards and fallback type.
        await document.fonts.ready
        await Promise.all(Array.from(frame.querySelectorAll("img"), (img) => img.decode().catch(() => undefined)))
        const { toJpeg } = await import("html-to-image")
        const dataUrl = await toJpeg(frame, {
          width: SLIDE_WIDTH,
          height: SLIDE_HEIGHT,
          pixelRatio: 1,
          quality: 0.9,
          backgroundColor: "#050806",
        })
        if (!cancelled) {
          postToParent({ captureId, dataUrl, width: SLIDE_WIDTH, height: SLIDE_HEIGHT, count: celebrants.length })
        }
      } catch (err) {
        if (!cancelled) postToParent({ captureId, error: err instanceof Error ? err.message : "Screenshot failed" })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [captureId, celebrants])

  if (accessError || !celebrants) return null

  return (
    <div ref={frameRef} style={{ width: SLIDE_WIDTH, height: SLIDE_HEIGHT, overflow: "hidden" }}>
      <BirthdayShell className="bd-clothesline bd-capture">
        <BirthdayClotheslineStage layout="cards" celebrants={celebrants} rangeLabel={label} highlightToday={false} />
      </BirthdayShell>
    </div>
  )
}
