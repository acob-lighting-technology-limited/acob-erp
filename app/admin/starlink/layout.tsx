import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Starlink | ACOB Lighting Technology Limited",
  description: "Manage starlink in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
