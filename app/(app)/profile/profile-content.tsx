"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import { ProfileHero } from "@/components/profile/profile-hero"
import { ProfileEditDialog } from "@/components/profile/profile-edit-dialog"
import { NeedsAttention } from "@/components/profile/needs-attention"
import {
  MyTasksCard,
  LeaveCard,
  AssetsCard,
  LunchHistoryCard,
  RecentAttendanceCard,
} from "@/components/profile/work-lists"
import {
  PersonalRecentActivityFeed,
  type PersonalRecentActivityItem,
} from "@/components/profile/personal-recent-activity-feed"
import type {
  UserProfile,
  Task,
  Asset,
  CorrespondenceItem,
  HelpDeskItem,
  PaymentItem,
  LeaveItem,
  AttendanceItem,
  LunchLogItem,
  TodayAttendanceStatus,
  WorkDayAttendanceItem,
} from "./page"

const MAX_ACTIVITY_ENTRIES = 12

interface ProfileContentProps {
  profile: UserProfile | null
  avatarUrl: string | null
  tasks: Task[]
  assets: Asset[]
  correspondence: CorrespondenceItem[]
  helpDesk: HelpDeskItem[]
  payments: PaymentItem[]
  leave: LeaveItem[]
  annualLeaveRemaining?: number
  attendance: AttendanceItem[]
  recentWorkDaysAttendance?: WorkDayAttendanceItem[]
  todayStatus?: TodayAttendanceStatus | null
  lunchLogs: LunchLogItem[]
  recentActivity: PersonalRecentActivityItem[]
  initialError?: string | null
}

export function ProfileContent({
  profile,
  avatarUrl: initialAvatarUrl,
  tasks,
  assets,
  correspondence,
  helpDesk,
  payments,
  leave,
  annualLeaveRemaining = 0,
  attendance,
  recentWorkDaysAttendance = [],
  todayStatus,
  lunchLogs,
  recentActivity,
  initialError,
}: ProfileContentProps) {
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl)

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  if (!profile) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-center">Profile not found</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-4 md:p-6 lg:p-8">
      <ProfileHero
        profile={profile}
        avatarUrl={avatarUrl}
        attendance={attendance}
        todayStatus={todayStatus}
        onAvatarChange={setAvatarUrl}
        onEdit={() => setIsEditOpen(true)}
      />

      <NeedsAttention
        tasks={tasks}
        leave={leave}
        helpDesk={helpDesk}
        correspondence={correspondence}
        payments={payments}
        annualLeaveRemaining={annualLeaveRemaining}
      />

      {/* Two aligned rows of three: daily records stretch to a shared height; the
          services row is pinned to one height so the activity feed scrolls instead
          of pushing its column past its neighbours. */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <MyTasksCard tasks={tasks} />
        <RecentAttendanceCard items={recentWorkDaysAttendance} />
        <LunchHistoryCard lunchLogs={lunchLogs} />

        <LeaveCard leave={leave} className="lg:h-[360px]" />
        <AssetsCard assets={assets} className="lg:h-[360px]" />
        <PersonalRecentActivityFeed
          activity={recentActivity.slice(0, MAX_ACTIVITY_ENTRIES)}
          className="h-[400px] lg:h-[360px]"
        />
      </div>

      <ProfileEditDialog open={isEditOpen} onOpenChange={setIsEditOpen} profile={profile} />
    </div>
  )
}
