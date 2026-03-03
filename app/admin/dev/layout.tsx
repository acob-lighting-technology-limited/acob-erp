import type { Metadata } from "next"
import { requireAdminSectionAccess } from "@/lib/admin/rbac"

export const metadata: Metadata = {
  title: "DEV Control Plane | ACOB Lighting Technology Limited",
  description: "Developer-only control plane.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireAdminSectionAccess("dev")
  return children
}
