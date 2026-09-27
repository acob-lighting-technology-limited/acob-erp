"use client"

import { StatCard } from "@/components/ui/stat-card"
import { StatGrid } from "@/components/ui/stat-grid"
import { AlertTriangle, Building2, CheckCircle2, UserX, Users, Plane } from "lucide-react"

interface Props {
  stats: {
    totalStaff: number
    officeClockedIn: number
    meetingPresent: number
    officeNotScanned: number
    onLeave: number
    absent: number
  }
}

export function AttendanceStatsGrid({ stats }: Props) {
  const attendanceRate = stats.totalStaff > 0 ? Math.round((stats.meetingPresent / stats.totalStaff) * 100) : 0

  return (
    <StatGrid>
      <StatCard title="Total Staff" value={stats.totalStaff} icon={Users} description="Active workforce" />
      <StatCard
        title="At Office Today"
        value={stats.officeClockedIn}
        icon={Building2}
        description="Punched entrance machine"
        iconColor="text-blue-600 dark:text-blue-400"
        iconBgColor="bg-blue-500/10"
      />
      <StatCard
        title="In Meeting"
        value={stats.meetingPresent}
        icon={CheckCircle2}
        description={`${attendanceRate}% attendance rate`}
        iconColor="text-emerald-600 dark:text-emerald-400"
        iconBgColor="bg-emerald-500/10"
      />
      <StatCard
        title="In Office, Not Scanned"
        value={stats.officeNotScanned}
        icon={AlertTriangle}
        description="Punched gate, missed meeting code"
        iconColor="text-amber-600 dark:text-amber-400"
        iconBgColor="bg-amber-500/10"
      />
      <StatCard
        title="On Approved Leave"
        value={stats.onLeave}
        icon={Plane}
        description="HR verified leave"
        iconColor="text-sky-600 dark:text-sky-400"
        iconBgColor="bg-sky-500/10"
      />
    </StatGrid>
  )
}
