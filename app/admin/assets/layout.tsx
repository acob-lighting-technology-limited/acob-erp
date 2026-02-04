import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Assets | ACOB Lighting Technology Limited",
  description: "Manage assets in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
