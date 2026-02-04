import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Notifications | ACOB Lighting Technology Limited",
  description: "Manage notifications in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
