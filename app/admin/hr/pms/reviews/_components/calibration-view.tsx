"use client"

import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent } from "@/components/ui/card"

type ReviewRow = {
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
  } | null
}

interface CalibrationViewProps {
  reviews: ReviewRow[]
}

export function CalibrationView({ reviews }: CalibrationViewProps) {
  const byDept = useMemo(() => {
    const map = new Map<string, ReviewRow[]>()
    for (const r of reviews) {
      if (typeof r.final_score !== "number") continue
      const dept = r.user?.department || "Unassigned"
      map.set(dept, [...(map.get(dept) ?? []), r])
    }

    return Array.from(map.entries()).map(([dept, rows]) => {
      const scores = rows
        .map((r) => r.final_score as number)
        .filter((s): s is number => typeof s === "number")
        .sort((a, b) => b - a)

      const mean =
        scores.length > 0 ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : null

      const variance =
        scores.length > 1 && mean !== null
          ? scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (scores.length - 1)
          : 0
      const stddev = Math.round(Math.sqrt(variance) * 100) / 100

      const ranked = rows
        .filter((r) => typeof r.final_score === "number")
        .sort((a, b) => (b.final_score as number) - (a.final_score as number))
        .map((r, i) => ({
          name: `${r.user?.first_name || ""} ${r.user?.last_name || ""}`.trim() || "Employee",
          score: r.final_score as number,
          rank: i + 1,
          percentile: scores.length > 0 ? Math.round(((scores.length - i) / scores.length) * 100 * 100) / 100 : 0,
          z_score:
            stddev > 0 && mean !== null ? Math.round((((r.final_score as number) - mean) / stddev) * 100) / 100 : 0,
        }))

      return { dept, mean, stddev, count: scores.length, ranked }
    })
  }, [reviews])

  if (byDept.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center">
          <p className="text-muted-foreground text-sm">
            No completed reviews with final scores to calibrate. Use the filters above to narrow to a cycle.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {byDept.map(({ dept, mean, stddev, count, ranked }) => (
        <Card key={dept}>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="font-semibold">{dept}</h3>
              <span className="text-muted-foreground text-sm">
                {count} employee{count !== 1 ? "s" : ""} · Mean: <strong>{mean ?? "-"}%</strong> · Std Dev:{" "}
                <strong>{stddev}%</strong>
              </span>
            </div>
            <div className="overflow-x-auto">
              <Table className="min-w-[700px]">
                <TableHeader className="bg-muted/80">
                  <TableRow>
                    <TableHead className="w-12">Rank</TableHead>
                    <TableHead>Employee</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Percentile</TableHead>
                    <TableHead>Z-Score</TableHead>
                    <TableHead>Tier</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((entry) => (
                    <TableRow key={entry.name + entry.rank}>
                      <TableCell className="font-medium">#{entry.rank}</TableCell>
                      <TableCell>{entry.name}</TableCell>
                      <TableCell className="font-medium">{entry.score}%</TableCell>
                      <TableCell>{entry.percentile}%</TableCell>
                      <TableCell className={entry.z_score >= 0 ? "text-green-600" : "text-red-500"}>
                        {entry.z_score > 0 ? "+" : ""}
                        {entry.z_score}σ
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            entry.percentile >= 80 ? "default" : entry.percentile >= 40 ? "secondary" : "outline"
                          }
                        >
                          {entry.percentile >= 80
                            ? "High Performer"
                            : entry.percentile >= 40
                              ? "Core"
                              : "Needs Support"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
