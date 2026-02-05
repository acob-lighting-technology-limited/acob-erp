import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Tasks | ACOB Lighting Technology Limited",
  description: "Manage tasks in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
