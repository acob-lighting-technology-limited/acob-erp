import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Feedback | ACOB Lighting Technology Limited",
  description: "Manage feedback in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
