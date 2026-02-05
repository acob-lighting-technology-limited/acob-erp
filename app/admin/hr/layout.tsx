import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin HR | ACOB Lighting Technology Limited",
  description: "Manage HR in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
