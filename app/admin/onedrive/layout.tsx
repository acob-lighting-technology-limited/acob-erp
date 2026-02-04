import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin OneDrive | ACOB Lighting Technology Limited",
  description: "Manage onedrive in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
