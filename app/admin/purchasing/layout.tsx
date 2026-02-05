import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Purchasing | ACOB Lighting Technology Limited",
  description: "Manage purchasing in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
