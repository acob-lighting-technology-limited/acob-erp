"use client"

import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { AlertTriangle, CheckCircle2, Laptop, Palmtree, Users } from "lucide-react"

interface Props {
  stats: {
    totalStaff: number
    officeClockedIn: number
    meetingPresent: number
    officeNotScanned: number
    onLeave: number
    absent: number
  }
  onlineCount?: number
}

export function AttendanceStatsGrid({ stats, onlineCount = 0 }: Props) {
  const attendanceRate = stats.totalStaff > 0 ? Math.round((stats.meetingPresent / stats.totalStaff) * 100) : 0

  return (
    <StatGrid>
      <StatCard
        variant="compact"
        title="Total Staff"
        value={stats.totalStaff}
        icon={Users}
        iconColor="text-blue-500"
        iconBgColor="bg-blue-500/10"
        description="All active workforce"
      />
      <StatCard
        variant="compact"
        title="In Meeting"
        value={stats.meetingPresent}
        icon={CheckCircle2}
        iconColor="text-emerald-500"
        iconBgColor="bg-emerald-500/10"
        description={`${attendanceRate}% attendance`}
      />
      <StatCard
        variant="compact"
        title="In Office, Not Scanned"
        value={stats.officeNotScanned}
        icon={AlertTriangle}
        iconColor="text-amber-500"
        iconBgColor="bg-amber-500/10"
        description="Punched gate, no scan"
      />
      <StatCard
        variant="compact"
        title="Online / Virtual"
        value={onlineCount}
        icon={Laptop}
        iconColor="text-sky-500"
        iconBgColor="bg-sky-500/10"
        description="Recorded online"
      />
      <StatCard
        variant="compact"
        title="On Approved Leave"
        value={stats.onLeave}
        icon={Palmtree}
        iconColor="text-slate-500"
        iconBgColor="bg-slate-500/10"
        description="Verified on leave"
      />
    </StatGrid>
  )
}
