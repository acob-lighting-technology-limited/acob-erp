import HRAdminDashboard from "./view"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin HR" }

export default function HRAdminDashboardPage() {
  return <HRAdminDashboard />
}
