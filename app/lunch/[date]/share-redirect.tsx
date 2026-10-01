"use client"

import { useEffect } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"

/**
 * Forwards people on to the real poll. Done client-side on purpose: a server
 * redirect would also redirect the link-preview crawler (into the login page),
 * while crawlers don't run JavaScript and so stay on the share page's metadata.
 */
export function LunchShareRedirect() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/hr/lunch")
  }, [router])

  return (
    <Link href="/hr/lunch" className="text-primary mt-4 inline-block text-sm underline underline-offset-4">
      Go to the lunch poll
    </Link>
  )
}
