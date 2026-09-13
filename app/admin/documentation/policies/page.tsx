import type { Metadata } from "next"
import { ControlledDocsRegister } from "@/components/documentation/controlled/controlled-docs-register"

export const metadata: Metadata = {
  title: "Company Policies | Admin",
}

export default function Page() {
  return (
    <ControlledDocsRegister type="policy" backLink={{ href: "/admin/documentation", label: "Back to Documentation" }} />
  )
}
