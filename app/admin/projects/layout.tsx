import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Projects | ACOB Lighting Technology Limited",
  description: "Manage projects in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
