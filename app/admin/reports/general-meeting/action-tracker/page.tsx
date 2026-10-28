import type { Metadata } from "next"
export {
  /* @next-codemod-ignore `default` export is re-exported. Check if this component uses `params` or `searchParams`*/
  default,
} from "../../action-tracker/page"

export const metadata: Metadata = { title: "Admin meeting action tracker" }
