import { PmsMetricTabsPage } from "../_components/pms-metric-tabs-page"

export default function AdminPmsKpiPage() {
  return (
    <PmsMetricTabsPage
      metric="kpi"
      title="PMS KPI"
      description="KPI view with individual, department, and cycle tabs."
      iconKey="kpi"
    />
  )
}
