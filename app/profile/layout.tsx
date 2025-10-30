import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile | ACOB Lighting Technology Limited",
  description: "Manage your profile information and settings at ACOB Lighting Technology Limited",
}

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
