import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Documentation | ACOB Lighting Technology Limited",
  description: "Manage documentation in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
