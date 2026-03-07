import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Admin OneDrive (Deprecated) | ACOB Lighting Technology Limited",
  description: "OneDrive has moved to admin documentation.",
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  return children
}
