import type { Metadata } from "next"
import { AdminLayout } from "@/components/admin-layout"
import { ErrorBoundary } from "@/components/error-boundary"

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description:
    "Manage users, view feedback, and oversee all administrative functions for ACOB Lighting Technology Limited",
}

export default function AdminLayoutPage({ children }: { children: React.ReactNode }) {
  return (
    <AdminLayout>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AdminLayout>
  )
}
