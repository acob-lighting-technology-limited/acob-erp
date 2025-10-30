import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Dashboard | ACOB Lighting Technology Limited",
  description: "Manage users, view feedback, and oversee all administrative functions for ACOB Lighting Technology Limited",
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
