"use client"

import { useEffect, useState } from "react"

/**
 * The current time as a render-stable value, refreshed every `intervalMs`
 * (default one minute). Use it for "overdue", "waiting 3 days", "SLA left"
 * calculations instead of calling Date.now() during render — which is impure
 * (React may render twice or skip renders) and never updates on its own.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
