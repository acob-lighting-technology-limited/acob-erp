import type { Metadata } from "next"
export {
  /* @next-codemod-ignore `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
  default,
} from "../../weekly-reports/page-client"

export const metadata: Metadata = { title: "Meeting weekly reports" }
