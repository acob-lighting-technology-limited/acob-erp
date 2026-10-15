import { ORG_STAFF_DOMAIN } from "@/lib/org-config"

/**
 * Standard ACOB staff email generator.
 * Format: [first letter of surname/last_name].[first_name]@org.acoblighting.com
 * Example: Funsho, Blessing -> f.blessing@org.acoblighting.com
 */
export function generateStaffEmail(firstName: string, lastName: string, domain = ORG_STAFF_DOMAIN): string {
  const sanitize = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z]/g, "")

  const safeFirst = sanitize(firstName || "")
  const safeLast = sanitize(lastName || "")

  if (!safeFirst || !safeLast) return ""
  return `${safeLast.charAt(0)}.${safeFirst}@${domain}`
}
