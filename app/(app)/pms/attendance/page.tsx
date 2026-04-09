import { Clock3 } from "lucide-react"
import { PageHeader, PageWrapper, Section } from "@/components/layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatCard } from "@/components/ui/stat-card"
import { getCurrentUserPmsData } from "../_lib"

export default async function PmsAttendancePage() {
  const { score, attendance } = await getCurrentUserPmsData()

  return (
    <PageWrapper maxWidth="full" background="gradient">
      <PageHeader
        title="PMS Attendance"
        description="Track the attendance score that feeds your PMS in real time."
        icon={Clock3}
        backLink={{ href: "/pms", label: "Back to PMS" }}
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard title="Attendance Score" value={`${score.attendance_score}%`} icon={Clock3} />
        <StatCard
          title="Present Days"
          value={score.breakdown.attendance.present}
          description="Positive attendance records in the score window"
        />
        <StatCard
          title="Tracked Days"
          value={score.breakdown.attendance.total}
          description="Days counted toward attendance scoring"
        />
      </div>

      <Section title="Recent Attendance" description="Your latest attendance records from the ERP.">
        <Card>
          <CardHeader>
            <CardTitle>Last 10 Attendance Entries</CardTitle>
            <CardDescription>These records are also available from the normal attendance module.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {attendance.recent.length > 0 ? (
              attendance.recent.map((record) => (
                <div
                  key={record.id}
                  className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{new Date(record.date).toLocaleDateString()}</p>
                    <p className="text-muted-foreground text-sm">
                      {record.clock_in || "-"} to {record.clock_out || "In progress"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-medium">
                      {record.total_hours !== null ? `${record.total_hours.toFixed(2)} hrs` : "Pending"}
                    </p>
                    <Badge variant="outline">{record.status || "unknown"}</Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-sm">No attendance records found yet.</p>
            )}
          </CardContent>
        </Card>
      </Section>
    </PageWrapper>
  )
}
