import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Inventory | ACOB Lighting Technology Limited",
  description: "Manage inventory in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
