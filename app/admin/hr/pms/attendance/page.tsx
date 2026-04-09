import { PmsMetricTabsPage } from "../_components/pms-metric-tabs-page"

export default function AdminPmsAttendancePage() {
  return (
    <PmsMetricTabsPage
      metric="attendance"
      title="PMS Attendance"
      description="Attendance view with individual, department, and cycle tabs."
      iconKey="attendance"
    />
  )
}
