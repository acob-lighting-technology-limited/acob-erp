import type { Metadata } from "next"
import { ControlledDocsLibrary } from "@/components/documentation/controlled/controlled-docs-library"

export const metadata: Metadata = {
  title: "Company Policies | ACOB Lighting Technology Limited",
}

export default function Page() {
  return <ControlledDocsLibrary type="policy" />
}
