import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Settings | ACOB Lighting Technology Limited",
  description: "Manage settings in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
