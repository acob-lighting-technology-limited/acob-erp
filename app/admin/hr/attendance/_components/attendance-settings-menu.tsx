"use client"

import { useState } from "react"
import { Fingerprint, Mail, Settings2 } from "lucide-react"
import { HeaderMoreMenu } from "@/components/ui/patterns/header-more-menu"
import { AttendanceReportDialog } from "./attendance-report-dialog"
import { DeviceAlertDialog } from "./device-alert-dialog"

interface Props {
  canUseAttendanceManager: boolean
  onOpenAttendanceManager: () => void
}

/** The admin attendance header's "more" menu and the settings dialogs it opens. */
export function AttendanceSettingsMenu({ canUseAttendanceManager, onOpenAttendanceManager }: Props) {
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [deviceAlertOpen, setDeviceAlertOpen] = useState(false)

  return (
    <>
      <HeaderMoreMenu
        items={[
          { label: "Attendance reports", icon: Mail, onSelect: () => setReportDialogOpen(true) },
          { label: "Device alerts", icon: Fingerprint, onSelect: () => setDeviceAlertOpen(true) },
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
