import type { Metadata } from "next"
import "./hub.css"

export const metadata: Metadata = {
  title: "IT and Communications Capability Map",
  description: "Interactive capability overview for IT and Communications.",
}

export default function KssLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="cyber-hub-route">{children}</div>
}
