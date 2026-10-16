import {
  ACOB_LOGO,
  FACEBOOK_ICON,
  INSTAGRAM_ICON,
  LINKEDIN_ICON,
  MAIL_ICON,
  OFFICE_ICON,
  PHONE_ICON,
  X_ICON,
} from "@/lib/signature-assets"

/**
 * The standard ACOB email signature — the single source for its HTML, used by
 * the Signature Creator and by the profile's "set up email" dialog so the two
 * can never drift apart.
 */

export const OFFICE_PHONE_NUMBER_VALUE = "+2347049202634"
export const OFFICE_PHONE_NUMBER_LABEL = "+234 704 920 2634"
export const OFFICE_EMAIL = "info@acoblighting.com"

export type EmailContactOrder = "main-first" | "alternative-first"

export interface DefaultSignatureInput {
  fullName: string
  companyRole: string
  /** Phone as typed (used for the tel: link). */
  phoneNumber: string
  /** Phone as displayed, e.g. "+234 803 123 4567". */
  formattedPhone: string
  companyEmail: string
  alternativeEmail: string
  emailContactOrder: EmailContactOrder
}

export function formatNameProperly(name: string): string {
  if (!name) return ""
  // Split by spaces first to preserve word boundaries
  return name
    .split(/\s+/)
    .map((word) =>
      word
        .split(/-/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join("-")
    )
    .join(" ")
}

export function formatSignaturePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "")
  if (digits.startsWith("0") && digits.length === 11) {
    const withoutLeadingZero = digits.substring(1)
    return `+234 ${withoutLeadingZero.substring(0, 3)} ${withoutLeadingZero.substring(3, 6)} ${withoutLeadingZero.substring(6)}`
  }
  return phone
}

export function buildContactSequence(sections: string[]): string {
  if (sections.length === 0) return ""
  const [firstSection, ...restSections] = sections
  return `${firstSection}${restSections
    .map(
      (section) =>
        `<span style="white-space: nowrap;"><span style="color: #6b7280;">&nbsp;|&nbsp;</span>${section}</span>`
    )
    .join("")}`
}

export function buildPhoneContactHtml(phoneNumber: string, formattedPhone: string): string {
  const primaryPhoneHref = phoneNumber.replace(/\s+/g, "")
  return `<a href="tel:${primaryPhoneHref}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formattedPhone}</a>`
}

export function buildEmailContactHtml(
  companyEmail: string,
  alternativeEmail: string,
  emailContactOrder: EmailContactOrder
): string {
  const primaryEmailSection = `<a href="mailto:${companyEmail}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${companyEmail}</a>`
  const alternativeEmailSection = alternativeEmail
    ? `<a href="mailto:${alternativeEmail}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${alternativeEmail}</a>`
    : ""

  if (!alternativeEmailSection) return primaryEmailSection
  if (emailContactOrder === "alternative-first") {
    return buildContactSequence([alternativeEmailSection, primaryEmailSection])
  }
  return buildContactSequence([primaryEmailSection, alternativeEmailSection])
}

export function buildOfficeRowHtml(): string {
  const websiteHtml = `<a href="https://www.acoblighting.com" style="color: #1f2937; text-decoration: none; vertical-align: middle;">www.acoblighting.com</a>`
  const officePhoneHtml = `<a href="tel:${OFFICE_PHONE_NUMBER_VALUE}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${OFFICE_PHONE_NUMBER_LABEL}</a>`
  const officeEmailHtml = `<a href="mailto:${OFFICE_EMAIL}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${OFFICE_EMAIL}</a>`
  return `<img src="${OFFICE_ICON}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Office" />${buildContactSequence([websiteHtml, officePhoneHtml, officeEmailHtml])}`
}

export function buildDefaultSignatureHtml(input: DefaultSignatureInput): string {
  const phoneContactHtml = buildPhoneContactHtml(input.phoneNumber, input.formattedPhone)
  const emailContactHtml = buildEmailContactHtml(input.companyEmail, input.alternativeEmail, input.emailContactOrder)
  const officeRowHtml = buildOfficeRowHtml()
  const fullName = input.fullName

  return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 1000px; margin: 0; padding: 12px 0; line-height: 1.5;">
  <!-- Thin green line -->
  <div style="color: #000000;">&mdash;&mdash;</div>

  <!-- Greeting -->
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #374151; font-style: italic;">Best Regards,</p>

  <!-- Name & Role -->
  <div style="border-bottom: 1.5px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 6px;">
    <p style="margin: 0 0 0 0; line-height: 1; font-size: 20px; font-weight: bold; color: #1f2937; letter-spacing: -0.025em;">${fullName}</p>
    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 500; color: #1f2937;">${input.companyRole}</p>

    <!-- Contact details -->
    <div style="font-size: 14px; color: #374151; line-height: 1.3;">
      <div style="margin: 0 0 4px 0;">
        <img src="${PHONE_ICON}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Phone" />${phoneContactHtml}
      </div>
      <div style="margin: 0 0 4px 0;">
        <img src="${MAIL_ICON}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Email" />${emailContactHtml}
      </div>
      <div>
        ${officeRowHtml}
      </div>
    </div>
  </div>

  <!-- Logo + Socials (stacked vertically) -->
  <div style="margin-bottom: 8px;">
    <img src="${ACOB_LOGO}" width="200" height="47" alt="ACOB Lighting Technology Limited" style="display: block; margin-bottom: 8px;" />

   <div style="display: inline-block;">
  <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="${LINKEDIN_ICON}" width="22" height="22" alt="LinkedIn" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${X_ICON}" width="22" height="22" alt="X (Twitter)" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${FACEBOOK_ICON}" width="22" height="22" alt="Facebook" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${INSTAGRAM_ICON}" width="22" height="22" alt="Instagram" style="border-radius: 4px; display: inline-block;" /></a>
</div>
  </div>

  <!-- Footer -->
  <div style="border-top: 1.5px solid #e5e7eb; padding-top: 6px; font-size: 11px; color: #6b7280; line-height: 1.4;">
    <p style="margin: 0 0 6px 0; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
    <p style="margin: 0 0 4px 0; font-weight: 600; font-style: italic;">ACOB Lighting Technology Limited is a renewable energy company registered under the Laws of the Federal Republic of Nigeria.</p>
    <p style="margin: 0 0 2px 0; font-weight: 600; font-style: italic;">We are a leading provider of solar and energy solutions for homes, businesses, and communities.</p>
    <p style="margin: 0; font-weight: 600; font-style: italic;">Lighting up Nigeria!</p>
  </div>
</div>`
}
