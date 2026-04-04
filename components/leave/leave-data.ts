import type { LeaveBalance, LeaveRequest, LeaveType } from "@/app/(app)/leave/page"

export async function fetchLeaveData(currentUserId: string) {
  const [requestRes, queueRes, typesRes, relieversRes] = await Promise.all([
    fetch("/api/hr/leave/requests?limit=100"),
    fetch("/api/hr/leave/queue"),
    fetch("/api/hr/leave/types"),
    fetch("/api/hr/leave/relievers"),
  ])

  const [requestPayload, queuePayload, typesPayload, relieversPayload] = await Promise.all([
    requestRes.json().catch(() => ({})),
    queueRes.json().catch(() => ({})),
    typesRes.json().catch(() => ({})),
    relieversRes.json().catch(() => ({})),
  ])

  const errors: string[] = []

  if (!requestRes.ok) errors.push(`requests: ${requestPayload.error || requestRes.statusText}`)
  if (!queueRes.ok) errors.push(`queue: ${queuePayload.error || queueRes.statusText}`)
  if (!typesRes.ok) errors.push(`types: ${typesPayload.error || typesRes.statusText}`)
  if (!relieversRes.ok) errors.push(`relievers: ${relieversPayload.error || relieversRes.statusText}`)

  if (errors.length > 0) throw new Error(`Leave data partial failure -> ${errors.join(" | ")}`)

  const ownedRequests = (requestPayload.data || []).filter((row: LeaveRequest) => row.user_id === currentUserId)

  return {
    requests: ownedRequests as LeaveRequest[],
    balances: (requestPayload.balances || []) as LeaveBalance[],
    approverQueue: (queuePayload.data || []) as LeaveRequest[],
    leaveTypes: (typesPayload.data || []) as LeaveType[],
    relieverOptions: (relieversPayload.data || []) as { value: string; label: string }[],
  }
}

export function addDays(startDate: string, days: number) {
  if (!startDate || days <= 0) return { endDate: "", resumeDate: "" }
  const start = new Date(`${startDate}T00:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + days - 1)
  const resume = new Date(end)
  resume.setUTCDate(resume.getUTCDate() + 1)

  return {
    endDate: end.toISOString().slice(0, 10),
    resumeDate: resume.toISOString().slice(0, 10),
  }
}

export function getTodayLocalIsoDate() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}
