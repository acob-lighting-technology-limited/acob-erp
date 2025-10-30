import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard | ACOB Lighting Technology Limited",
  description: "View your personal dashboard, stats, and activities at ACOB Lighting Technology Limited",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
