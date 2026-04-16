"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"

export default function AdminPmsCbtCycleRedirectPage() {
  const params = useParams<{ cycleId: string }>()
  const router = useRouter()

  useEffect(() => {
    const cycleId = String(params.cycleId || "")
    if (!cycleId) {
      router.replace("/admin/hr/pms/cbt/question")
      return
    }

    router.replace(`/admin/hr/pms/cbt/question?cycleId=${encodeURIComponent(cycleId)}`)
  }, [params.cycleId, router])

  return null
}
