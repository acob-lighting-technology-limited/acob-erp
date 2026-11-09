"use client"

import { useCanEdit } from "@/components/admin/edit-access-context"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Clock, Fingerprint, Mail, Settings2 } from "lucide-react"
import { HeaderMoreMenu } from "@/components/ui/patterns/header-more-menu"
import { AttendanceReportDialog } from "./attendance-report-dialog"
import { DeviceAlertDialog } from "./device-alert-dialog"

interface Props {
  canUseAttendanceManager: boolean
  onOpenAttendanceManager: () => void
}

/** The admin attendance header's "more" menu and the settings dialogs it opens. */
export function AttendanceSettingsMenu({ canUseAttendanceManager, onOpenAttendanceManager }: Props) {
  const router = useRouter()
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [deviceAlertOpen, setDeviceAlertOpen] = useState(false)
  const canEditAttendance = useCanEdit("hr.attendance")

  return (
    <>
      <HeaderMoreMenu
        items={[
          {
            label: "Attendance policy",
            icon: Clock,
            onSelect: () => router.push("/admin/hr/attendance/settings"),
            hidden: !canUseAttendanceManager,
          },
          {
            label: "Attendance reports",
            icon: Mail,
            onSelect: () => setReportDialogOpen(true),
            hidden: !canEditAttendance,
          },
          {
            label: "Device alerts",
            icon: Fingerprint,
            onSelect: () => setDeviceAlertOpen(true),
            hidden: !canEditAttendance,
          },
          {
            label: "Attendance manager",
            icon: Settings2,
            onSelect: onOpenAttendanceManager,
            hidden: !canUseAttendanceManager,
          },
        ]}
      />
      <AttendanceReportDialog open={reportDialogOpen} onOpenChange={setReportDialogOpen} />
      <DeviceAlertDialog open={deviceAlertOpen} onOpenChange={setDeviceAlertOpen} />
    </>
  )
}
