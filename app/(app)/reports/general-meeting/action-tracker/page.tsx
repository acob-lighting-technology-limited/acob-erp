import type { Metadata } from "next"
export {
  /* @next-codemod-ignore `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
  default,
} from "../../action-tracker/page-client"

export const metadata: Metadata = { title: "Meeting action tracker" }
