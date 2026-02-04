import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin Job Descriptions | ACOB Lighting Technology Limited",
  description: "Manage job descriptions in the admin dashboard.",
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
