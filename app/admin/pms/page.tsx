import { AdminPmsPage } from "./view"

import type { Metadata } from "next"

export const metadata: Metadata = { title: "Admin PMS" }

export default async function AdminPmsPageRoute({ searchParams }: { searchParams: Promise<{ cycle_id?: string }> }) {
  const { cycle_id } = await searchParams
  return <AdminPmsPage cycleId={cycle_id} />
}
