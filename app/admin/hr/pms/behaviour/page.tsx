import type { Metadata } from "next"
import { AdminPmsBehaviourPage } from "./view"

export const metadata: Metadata = { title: "Admin PMS behaviour" }

export default function AdminPmsBehaviourPageRoute() {
  return <AdminPmsBehaviourPage />
}
