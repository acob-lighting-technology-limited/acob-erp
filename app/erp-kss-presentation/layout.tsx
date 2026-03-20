import type { Metadata } from "next"
import "./kss.css"

export const metadata: Metadata = {
  title: "ACOB ERP Knowledge Sharing Session",
  description: "A cinematic ERP knowledge-sharing presentation from IT and Communications.",
}

export default function ErpKssPresentationLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="erp-kss-route">{children}</div>
}
