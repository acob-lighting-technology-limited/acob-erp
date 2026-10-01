import { redirect } from "next/navigation"

// Goals live on the KPI page now (strategic objectives from the scorecard).
export default function PmsGoalsPage() {
  redirect("/pms/kpi?tab=goals")
}
