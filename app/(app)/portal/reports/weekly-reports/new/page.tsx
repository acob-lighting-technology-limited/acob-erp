"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function RedirectToReports() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/portal/reports/weekly-reports")
  }, [router])

  return null
}
