import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Audit Logs | ACOB Lighting Technology Limited",
  description: "Manage audit logs in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
