import { FleetContent } from "./fleet-content"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Resource Booking Center" }

export default function ResourcesPage() {
  return <FleetContent />
}
