import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Staff | ACOB Lighting Technology Limited",
  description: "Manage staff in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
