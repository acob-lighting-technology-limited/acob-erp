import type { Metadata } from "next"
import { ControlledDocsRegister } from "@/components/documentation/controlled/controlled-docs-register"

export const metadata: Metadata = {
  title: "Standard Operating Procedures | Admin",
}

export default function Page() {
  return (
    <ControlledDocsRegister type="sop" backLink={{ href: "/admin/documentation", label: "Back to Documentation" }} />
  )
}
