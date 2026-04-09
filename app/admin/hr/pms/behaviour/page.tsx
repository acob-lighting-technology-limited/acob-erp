import { PmsMetricTabsPage } from "../_components/pms-metric-tabs-page"

export default function AdminPmsBehaviourPage() {
  return (
    <PmsMetricTabsPage
      metric="behaviour"
      title="PMS Behaviour"
      description="Behaviour view with individual, department, and cycle tabs."
      iconKey="behaviour"
    />
  )
}
