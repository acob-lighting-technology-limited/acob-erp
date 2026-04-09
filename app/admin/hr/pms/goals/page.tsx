import { PmsMetricTabsPage } from "../_components/pms-metric-tabs-page"

export default function AdminPmsGoalsPage() {
  return (
    <PmsMetricTabsPage
      metric="goals"
      title="PMS Goals"
      description="Goals view with individual, department, and cycle tabs."
      iconKey="goals"
    />
  )
}
