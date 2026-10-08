"use client"

import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { personName } from "@/lib/format"
import { StatusBadge } from "@/components/ui/patterns/status-badge"

/** Review row types and the card, detail and score-bar pieces of the PMS reviews page. Split from reviews/view.tsx (audit 6.1). */
// ─── Types ────────────────────────────────────────────────────────────────────

export type ReviewRow = {
  id: string
  created_at: string
  status: string | null
  user_id: string | null
  review_cycle_id: string | null
  kpi_score: number | null
  cbt_score: number | null
  attendance_score: number | null
  behaviour_score: number | null
  final_score: number | null
  user?: {
    id: string
    first_name: string | null
    last_name: string | null
    department?: string | null
  } | null
  cycle?: {
    id: string
    name: string
    review_type: string
    start_date?: string | null
    end_date?: string | null
  } | null
}

export type DeptRow = {
  id: string
  cycleId: string
  cycle: string
  department: string
  reviews: number
  submitted: number
  kpi: string
  cbt: string
  attendance: string
  behaviour: string
  final: string
}

export type CycleRow = {
  id: string
  cycleId: string
  cycle: string
  review_type: string
  reviews: number
  submitted: number
  departments: number
  completed: number
}

export type TabMode = "individual" | "department" | "cycle" | "calibration"

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatMetric(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "-"
}

export function isSubmittedReview(r: ReviewRow) {
  return ["submitted", "completed"].includes(String(r.status ?? "").toLowerCase())
}

export function isCompletedReview(r: ReviewRow) {
  return String(r.status ?? "").toLowerCase() === "completed"
}

/** A review's status on the shared badge; no status yet shows a dash. */
export function ReviewStatus({ status }: { status: string | null }) {
  return status ? <StatusBadge status={status} /> : <span className="text-muted-foreground text-sm">—</span>
}

export function ScoreBar({ label, value }: { label: string; value: number | null }) {
  if (value === null || !Number.isFinite(value)) return null
  const pct = Math.min(100, Math.max(0, value))
  const color = pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value?.toFixed(1)}%</span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ─── Individual review — expandable detail ────────────────────────────────────

export function ReviewExpandedDetail({ row }: { row: ReviewRow }) {
  const scores = [
    { label: "KPI Score", value: row.kpi_score },
    { label: "Competency (CBT)", value: row.cbt_score },
    { label: "Attendance", value: row.attendance_score },
    { label: "Behaviour", value: row.behaviour_score },
  ]
  const hasScores = scores.some((s) => s.value !== null)

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1 lg:col-span-2">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Score Breakdown</p>
        {hasScores ? (
          <div className="space-y-3 pt-1">
            {scores.map((s) => (s.value !== null ? <ScoreBar key={s.label} label={s.label} value={s.value} /> : null))}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">No scores recorded yet.</p>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Summary</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Final Score</span>
            <span className="font-semibold">{row.final_score !== null ? `${row.final_score?.toFixed(2)}%` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <ReviewStatus status={row.status} />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Cycle</span>
            <span>{row.cycle?.name ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Type</span>
            <span>{row.cycle?.review_type ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Employee</p>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{personName(row.user, "Employee")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Department</span>
            <span>{row.user?.department ?? "—"}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Individual review — card renderer ───────────────────────────────────────

export function ReviewCard({ row, onEdit }: { row: ReviewRow; onEdit: (r: ReviewRow) => void }) {
  const final = row.final_score
  const pct = final !== null && Number.isFinite(final) ? Math.min(100, Math.max(0, final)) : null
  const color =
    pct !== null
      ? pct >= 80
        ? "text-emerald-600"
        : pct >= 60
          ? "text-amber-600"
          : "text-red-600"
      : "text-muted-foreground"

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="leading-tight font-semibold">{personName(row.user, "Employee")}</p>
            <p className="text-muted-foreground mt-0.5 text-xs">{row.user?.department ?? "—"}</p>
          </div>
          <ReviewStatus status={row.status} />
        </div>

        {/* Quarter chip */}
        <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
          <Clock className="h-3.5 w-3.5" />
          {row.cycle?.name ?? "No cycle"}
        </div>

        {/* Final score */}
        {pct !== null && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Final Score</span>
              <span className={`font-bold ${color}`}>{final?.toFixed(1)}%</span>
            </div>
            <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Score chips */}
        <div className="flex flex-wrap gap-1.5 text-xs">
          {[
            { label: "KPI", value: row.kpi_score },
            { label: "CBT", value: row.cbt_score },
            { label: "Att.", value: row.attendance_score },
            { label: "Beh.", value: row.behaviour_score },
          ].map((s) => (
            <span key={s.label} className="bg-muted rounded px-1.5 py-0.5 font-mono">
              {s.label} {formatMetric(s.value)}
            </span>
          ))}
        </div>

        {/* Edit button */}
        {row.review_cycle_id && (
          <Button size="sm" variant="outline" className="w-full" onClick={() => onEdit(row)}>
            Edit Review
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Constants ────────────────────────────────────────────────────────────────
