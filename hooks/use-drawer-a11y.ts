"use client"

import { useEffect, useRef } from "react"

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * Makes a hand-built slide-in drawer behave like a dialog: Escape closes it, focus moves in when it opens,
 * Tab stays inside while it is open, and focus returns to what opened it. Spread the result on the drawer:
 * `inert` keeps its links out of the tab order while it is off screen.
 */
export function useDrawerA11y(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const drawer = ref.current
    const opener = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(drawer?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    focusables()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab") return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      opener?.focus?.()
    }
  }, [open])

  return { ref, inert: !open, "aria-label": "Main navigation" }
}
