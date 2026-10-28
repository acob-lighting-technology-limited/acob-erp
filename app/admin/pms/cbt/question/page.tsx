import type { Metadata } from "next"
import { CbtQuestionManager } from "@/components/pms/cbt-question-manager"

export const metadata: Metadata = { title: "Admin CBT question" }

export default function AdminPmsCbtQuestionPage() {
  return <CbtQuestionManager basePath="/admin/pms/cbt" />
}
