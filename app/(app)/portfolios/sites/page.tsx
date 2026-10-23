import type { Metadata } from "next"
import { SitesContent } from "@/components/sites/sites-content"

export const metadata: Metadata = {
  title: "Sites | Matrix",
  description: "Signed and profiled sites, with the standing of their conveyance documents.",
}

export default function AppSitesPage() {
  return <SitesContent isAdmin={false} />
}
