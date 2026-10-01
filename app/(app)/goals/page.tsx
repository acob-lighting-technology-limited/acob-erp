import { redirect } from "next/navigation"

// Goals are the corporate scorecard's strategic objectives now, shown as a tab
// on the KPI page; there is nothing left to enter here by hand.
export default function GoalsPage() {
  redirect("/pms/kpi?tab=goals")
}
