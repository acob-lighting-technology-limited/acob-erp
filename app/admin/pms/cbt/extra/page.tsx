import { CbtQuestionManager } from "@/components/pms/cbt-question-manager"

/** Bonus questions share the CBT question manager; only targeting and copy differ. */
export default function AdminPmsCbtExtraQuestionPage() {
  return <CbtQuestionManager variant="bonus" basePath="/admin/pms/cbt" questionPath="/admin/pms/cbt/extra" />
}
