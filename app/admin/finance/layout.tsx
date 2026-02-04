import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Finance | ACOB Lighting Technology Limited",
  description: "Manage finance in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
