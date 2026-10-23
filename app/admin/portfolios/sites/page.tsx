import type { Metadata } from "next"
import { SitesContent } from "@/components/sites/sites-content"

export const metadata: Metadata = {
  title: "Sites | Matrix",
  description: "Signed and profiled sites, with the standing of their conveyance documents.",
}

// Access to /admin/portfolios/* is gated by middleware (portfolios.main); the
// API decides who may edit the register.
export default function AdminSitesPage() {
  return <SitesContent isAdmin />
}
