export function formatMetric(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "-"
}

export function isSubmittedReview(r: { status?: string | null }) {
  return ["submitted", "completed"].includes(String(r.status ?? "").toLowerCase())
}

export function isCompletedReview(r: { status?: string | null }) {
  return String(r.status ?? "").toLowerCase() === "completed"
}
