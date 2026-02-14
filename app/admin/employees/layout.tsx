import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Employee | ACOB Lighting Technology Limited",
  description: "Manage employee in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
