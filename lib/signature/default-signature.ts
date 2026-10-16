import {
  ACOB_LOGO,
  ANNIVERSARY_LOGO,
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

/** Font of the anniversary signature (the only option the Signature Creator offers). */
export const ANNIVERSARY_SIGNATURE_FONT = "'Trebuchet MS', Arial, sans-serif"

/**
 * The 10th-anniversary ACOB signature (2016–2026) — the one staff use now.
 * `template` picks a layout; the Signature Creator uses "minimal".
 */
export function buildAnniversarySignatureHtml(
  input: DefaultSignatureInput,
  options: { font?: string; template?: string } = {}
): string {
  const fullName = input.fullName
  const font = options.font ?? ANNIVERSARY_SIGNATURE_FONT
  const template = options.template ?? "minimal"
  const phoneContactHtml = buildPhoneContactHtml(input.phoneNumber, input.formattedPhone)
  const emailContactHtml = buildEmailContactHtml(input.companyEmail, input.alternativeEmail, input.emailContactOrder)
  const officeRowHtml = buildOfficeRowHtml()

  const contactBlock = `<div style="font-size: 14px; color: #374151; line-height: 1.35;">
  <div style="margin: 0 0 4px 0;">
    <img src="${PHONE_ICON}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Phone" />${phoneContactHtml}
  </div>
  <div style="margin: 0 0 4px 0;">
    <img src="${MAIL_ICON}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Email" />${emailContactHtml}
  </div>
  <div>
    ${officeRowHtml}
  </div>
</div>`

  const mutedSocialIconStyle =
    "border-radius: 4px; display: inline-block; filter: brightness(0.9) saturate(0.92); opacity: 0.92;"

  const socialBlock = `<div style="display: inline-block;">
  <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="${LINKEDIN_ICON}" width="22" height="22" alt="LinkedIn" style="${mutedSocialIconStyle}" /></a>
  <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${X_ICON}" width="22" height="22" alt="X (Twitter)" style="${mutedSocialIconStyle}" /></a>
  <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${FACEBOOK_ICON}" width="22" height="22" alt="Facebook" style="${mutedSocialIconStyle}" /></a>
  <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${INSTAGRAM_ICON}" width="22" height="22" alt="Instagram" style="${mutedSocialIconStyle}" /></a>
</div>`

  const contactTextBlock = `<div style="font-size: 14px; color: #374151; line-height: 1.45;">
  <div style="margin: 0 0 2px 0;">
    ${phoneContactHtml}
  </div>
  <div style="margin: 0 0 2px 0;">
    ${emailContactHtml}
  </div>
  <div>
    ${officeRowHtml}
  </div>
</div>`

  const socialTextBlock = `<div style="margin-top: 8px; margin-bottom: 12px; font-size: 12px; color: #374151; line-height: 1.5;">
  <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="color: #0f5c4d; text-decoration: none;">LinkedIn</a>
  <span style="color: #9ca3af;"> | </span>
  <a href="https://twitter.com/AcobLimited" style="color: #0f5c4d; text-decoration: none;">X</a>
  <span style="color: #9ca3af;"> | </span>
  <a href="https://www.facebook.com/acoblightingtechltd" style="color: #0f5c4d; text-decoration: none;">Facebook</a>
  <span style="color: #9ca3af;"> | </span>
  <a href="https://www.instagram.com/acob_lighting/" style="color: #0f5c4d; text-decoration: none;">Instagram</a>
</div>`

  const anniversaryLogo = `<img src="${ANNIVERSARY_LOGO}" width="250" height="auto" alt="ACOB Lighting Technology Limited 2026 Anniversary Logo" style="display: block;" />`

  const anniversaryNarrative = `<p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
<p style="margin: 0 0 5px 0; font-size: 12px; color: #374151;">For 10 remarkable years, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
<p style="margin: 0 0 5px 0; font-size: 11.5px; color: #4b5563;">From 2016 to 2026, this journey has been one of excellence, growth, and transformation.</p>
<p style="margin: 0; font-size: 11.5px; color: #4b5563;">We celebrate 10 years of impact and look forward to many more years of lighting up lives and shaping a brighter future.</p>`

  const compactNarrative = `<p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
<p style="margin: 0; font-size: 12px; color: #374151;">From 2016 to 2026, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>`

  const legalCopyBlock = `<div style="margin-top: 8px; padding-top: 8px; border-top: 0.5px solid #e7dec2;">
  <p style="margin: 0; font-size: 11px; font-weight: 600; color: #7a828e;">ACOB Lighting Technology Limited is a renewable energy company registered under the Laws of the Federal Republic of Nigeria.</p>
</div>`

  const anniversaryFooter = `<div style="border-top: 0.5px solid #e7dec2; padding-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 0; font-weight: 600; font-style: italic; color: #6b7280; text-align: left;">
        Celebrating 10 Years of Impact &bull; Lighting up Nigeria!
      </td>
      <td style="padding: 0; font-weight: 600; color: #6b7280; text-align: right; white-space: nowrap; vertical-align: top;">
        2016 &ndash; 2026
      </td>
    </tr>
  </table>
  <div style="margin-top: 8px; border-top: 0.5px solid #e7dec2;"></div>
  <p style="margin: 8px 0 0 0; font-size: 10.5px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
</div>`

  const executiveAnniversaryFooter = `<div style="border-top: 0.5px solid #e7dec2; padding-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4;">
  <p style="margin: 0 0 5px 0; font-size: 10.75px; color: #7a828e;">ACOB Lighting Technology Limited is a renewable energy company registered under the Laws of the Federal Republic of Nigeria.</p>
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td style="padding: 0; font-weight: 600; font-style: italic; color: #6b7280; text-align: left;">
        Celebrating 10 Years of Impact &bull; Lighting up Nigeria!
      </td>
      <td style="padding: 0; font-weight: 600; color: #6b7280; text-align: right; white-space: nowrap; vertical-align: top;">
        2016 &ndash; 2026
      </td>
    </tr>
  </table>
  <div style="margin-top: 8px; border-top: 0.5px solid #e7dec2;"></div>
  <p style="margin: 8px 0 0 0; font-size: 10.25px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
</div>`

  const renderAnniversaryLayout = (
    body: string
  ) => `<div style="font-family: ${font}; max-width: 1000px; margin: 0; padding: 12px 0; line-height: 1.5; color: #1f2937;">
  ${body}
</div>`

  const templates: Record<string, string> = {
    classic: renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 8px;">
    <tr>
      <td style="width: 4px; background: linear-gradient(180deg, #c5a028, #d4af37, #e8c947); border-radius: 4px;" width="4"></td>
      <td style="padding-left: 14px;">
        <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.025em;">${fullName}</p>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom: 8px;">${contactBlock}</div>
  <div style="margin: 14px 0 16px 0; border-top: 1px solid #d4af37;"></div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${anniversaryNarrative}${legalCopyBlock}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    timeline: renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 8px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; margin-bottom: 10px;">
      <tr>
        <td style="width: 56px; text-align: center; vertical-align: top;">
          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #8a6b08;">2016</p>
        </td>
        <td style="vertical-align: top; padding: 0 10px;">
          <div style="margin-top: 7px; border-top: 2px solid #d4af37;"></div>
        </td>
        <td style="width: 56px; text-align: center; vertical-align: top;">
          <p style="margin: 0; font-size: 13px; font-weight: 700; color: #8a6b08;">2026</p>
        </td>
      </tr>
    </table>
    ${legalCopyBlock}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    heritage: renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <div style="margin-bottom: 10px;">
    <div style="padding-left: 12px; border-left: 3px solid #d4af37;">
      <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
    </div>
    ${contactBlock}
  </div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${anniversaryNarrative}
    ${legalCopyBlock}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    renewal: renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}${legalCopyBlock}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    "renewal-accent": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="width: 1px; background: #e7dec2;" width="1"></td>
      <td style="padding-left: 12px;">
        <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}${legalCopyBlock}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    "renewal-executive": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="width: 1px; background: #e7dec2;" width="1"></td>
      <td style="padding-left: 12px;">
        <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${executiveAnniversaryFooter}
  </div>`),
    minimal: renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    <div style="margin-top: 8px; margin-bottom: 12px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    "minimal-clean": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    <div style="margin-top: 8px; margin-bottom: 12px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    "minimal-confidential": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    <div style="margin-top: 8px; margin-bottom: 8px;">${socialBlock}</div>
    ${anniversaryFooter}
  </div>`),
    "diagnostic-logo-only": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    ${anniversaryFooter}
  </div>`),
    "diagnostic-contact-text": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactTextBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    ${anniversaryFooter}
  </div>`),
    "diagnostic-social-text": renderAnniversaryLayout(`<div style="color: #d4af37;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${input.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactTextBlock}</div>
  <div style="padding: 8px 0 14px 0; border-top: 2px solid #e7dec2; border-bottom: 2px solid #e7dec2;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${compactNarrative}
    ${socialTextBlock}
    ${anniversaryFooter}
  </div>`),
  }

  return templates[template] ?? templates.minimal
}
