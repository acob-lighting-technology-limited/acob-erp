/**
 * The tool itself lives on the staff route; this re-export gives it a real
 * /admin URL so using it from the admin console does not throw the viewer out
 * into the staff shell. Both render the same component.
 */
export {
  /* @next-codemod-ignore `default` export is re-exported. Check if this component uses `params` or `searchParams` */
  default,
} from "@/app/(app)/tools/watermark/page"
