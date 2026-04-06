"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Copy } from "lucide-react"
import { toast } from "sonner"

interface SignatureCreatorProps {
  profile: {
    first_name?: string | null
    other_names?: string | null
    last_name?: string | null
    designation?: string | null
    phone_number?: string | null
    company_email?: string | null
  } | null
  variant?: "default" | "anniversary"
}

interface FormData {
  firstName: string
  middleName: string
  lastName: string
  companyRole: string
  phoneNumber: string
  companyEmail: string
}

const ANNIVERSARY_FONT_OPTIONS = [
  {
    id: "serif",
    label: "Classic Serif",
    value: "Georgia, 'Times New Roman', Times, serif",
  },
  {
    id: "trebuchet",
    label: "Trebuchet",
    value: "'Trebuchet MS', Arial, sans-serif",
  },
  {
    id: "cambria",
    label: "Cambria",
    value: "Cambria, Georgia, serif",
  },
] as const

const ANNIVERSARY_TEMPLATE_OPTIONS = [
  { id: "classic", label: "Template 1" },
  { id: "timeline", label: "Template 2" },
  { id: "heritage", label: "Template 3" },
  { id: "renewal", label: "Template 4" },
  { id: "renewal-accent", label: "Template 5" },
  { id: "renewal-executive", label: "Template 6" },
  { id: "minimal", label: "Template 7" },
  { id: "minimal-clean", label: "Template 8" },
  { id: "minimal-confidential", label: "Template 9" },
] as const

const DEFAULT_ASSET_BASE_URL = "https://erp.acoblighting.com"

export function SignatureCreator({ profile, variant = "default" }: SignatureCreatorProps) {
  const [formData, setFormData] = useState<FormData>({
    firstName: profile?.first_name || "",
    middleName: profile?.other_names || "",
    lastName: profile?.last_name || "",
    companyRole: profile?.designation || "",
    phoneNumber: profile?.phone_number || "",
    companyEmail: profile?.company_email || "",
  })

  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")
  const [selectedAnniversaryFont, setSelectedAnniversaryFont] = useState<(typeof ANNIVERSARY_FONT_OPTIONS)[number]["value"]>(
    ANNIVERSARY_FONT_OPTIONS[0].value
  )
  const [selectedAnniversaryTemplate, setSelectedAnniversaryTemplate] = useState<
    (typeof ANNIVERSARY_TEMPLATE_OPTIONS)[number]["id"]
  >(ANNIVERSARY_TEMPLATE_OPTIONS[0].id)

  useEffect(() => {
    if (formData.firstName && formData.lastName) {
      const firstLetter = formData.lastName.charAt(0).toLowerCase()
      const firstName = formData.firstName.toLowerCase().replace(/\s+/g, "")
      const autoEmail = `${firstLetter}.${firstName}@org.acoblighting.com`

      if (
        !formData.companyEmail ||
        formData.companyEmail.endsWith("@org.acoblighting.com") ||
        formData.companyEmail.endsWith("@acoblighting.com")
      ) {
        setFormData((prev) => ({ ...prev, companyEmail: autoEmail }))
      }
    }
  }, [formData.companyEmail, formData.firstName, formData.lastName])

  const formatPhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, "")

    if (digits.startsWith("0") && digits.length === 11) {
      const withoutLeadingZero = digits.substring(1)
      return `+234 ${withoutLeadingZero.substring(
        0,
        3
      )} ${withoutLeadingZero.substring(3, 6)} ${withoutLeadingZero.substring(6)}`
    }

    return phone
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const isValidFormat = emailRegex.test(email)
    const isAllowedDomain = email.endsWith("@org.acoblighting.com") || email.endsWith("@acoblighting.com")
    return isValidFormat && isAllowedDomain
  }

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "")
    return digits.length >= 11
  }

  const formatNameProperly = (name: string) => {
    if (!name) return ""
    // Split by spaces first to preserve word boundaries
    return name
      .split(/\s+/)
      .map((word) => {
        // For each word, handle hyphens separately
        return word
          .split(/-/)
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join("-")
      })
      .join(" ")
  }

  const getAssetUrl = (path: string) => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : DEFAULT_ASSET_BASE_URL
    return `${baseUrl}${path}`
  }

  const generateDefaultSignature = (fullName: string, formattedPhone: string) => {
    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 1000px; margin: 0; padding: 12px 0; line-height: 1.5;">
  <!-- Thin green line -->
  <div style="color: #000000;">&mdash;&mdash;</div>
  
  <!-- Greeting -->
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #374151; font-style: italic;">Best Regards,</p>

  <!-- Name & Role -->
  <div style="border-bottom: 1.5px solid #e5e7eb; padding-bottom: 6px; margin-bottom: 6px;">
    <p style="margin: 0 0 0 0; line-height: 1; font-size: 20px; font-weight: bold; color: #1f2937; letter-spacing: -0.025em;">${fullName}</p>
    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 500; color: #1f2937;">${formData.companyRole}</p>
    
    <!-- Contact details -->
    <div style="font-size: 14px; color: #374151; line-height: 1.3;">
      <div style="margin: 0 0 1px 0;">
        <img src="${getAssetUrl("/images/signature/phone.png")}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Phone" /><a href="tel:${formData.phoneNumber.replace(
          /\s+/g,
          ""
        )}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formattedPhone}</a>
      </div>
      <div style="margin: 0 0 1px 0;">
        <img src="${getAssetUrl("/images/signature/mail.png")}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Email" /><a href="mailto:${
          formData.companyEmail
        }" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formData.companyEmail}</a>
      </div>
      <div>
        <img src="${getAssetUrl("/images/signature/web.png")}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Website" /><a href="https://www.acoblighting.com" style="color: #1f2937; text-decoration: none; vertical-align: middle;">www.acoblighting.com</a>
      </div>
    </div>
  </div>
  
  <!-- Logo + Socials (stacked vertically) -->
  <div style="margin-bottom: 8px;">
    <img src="${getAssetUrl("/images/signature/acob-logo.png")}" width="200" height="47" alt="ACOB Lighting Technology Limited" style="display: block; margin-bottom: 8px;" />
    
   <div style="display: inline-block;">
  <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="${getAssetUrl("/images/signature/linkedin.png")}" width="22" height="22" alt="LinkedIn" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/x.png")}" width="22" height="22" alt="X (Twitter)" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/facebook.png")}" width="22" height="22" alt="Facebook" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/instagram.png")}" width="22" height="22" alt="Instagram" style="border-radius: 4px; display: inline-block;" /></a>
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

  const generateAnniversarySignature = (fullName: string, formattedPhone: string) => {
    const contactBlock = `<div style="font-size: 14px; color: #374151; line-height: 1.35;">
  <div style="margin: 0 0 1px 0;">
    <img src="${getAssetUrl("/images/signature/phone.png")}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Phone" /><a href="tel:${formData.phoneNumber.replace(
      /\s+/g,
      ""
    )}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formattedPhone}</a>
  </div>
  <div style="margin: 0 0 1px 0;">
    <img src="${getAssetUrl("/images/signature/mail.png")}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Email" /><a href="mailto:${
      formData.companyEmail
    }" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formData.companyEmail}</a>
  </div>
  <div>
    <img src="${getAssetUrl("/images/signature/web.png")}" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Website" /><a href="https://www.acoblighting.com" style="color: #1f2937; text-decoration: none; vertical-align: middle;">www.acoblighting.com</a>
  </div>
</div>`

    const mutedSocialIconStyle =
      "border-radius: 4px; display: inline-block; filter: brightness(0.9) saturate(0.92); opacity: 0.92;"

    const socialBlock = `<div style="display: inline-block;">
  <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="${getAssetUrl("/images/signature/linkedin.png")}" width="22" height="22" alt="LinkedIn" style="${mutedSocialIconStyle}" /></a>
  <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/x.png")}" width="22" height="22" alt="X (Twitter)" style="${mutedSocialIconStyle}" /></a>
  <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/facebook.png")}" width="22" height="22" alt="Facebook" style="${mutedSocialIconStyle}" /></a>
  <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/instagram.png")}" width="22" height="22" alt="Instagram" style="${mutedSocialIconStyle}" /></a>
</div>`

    const anniversaryLogo = `<img src="${getAssetUrl("/images/acob-logo-light-2026.webp")}" width="250" height="auto" alt="ACOB Lighting Technology Limited 2026 Anniversary Logo" style="display: block;" />`

    const anniversaryNarrative = `<p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
<p style="margin: 0 0 5px 0; font-size: 12px; color: #374151;">For 10 remarkable years, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
<p style="margin: 0 0 5px 0; font-size: 11.5px; color: #4b5563;">From 2016 to 2026, this journey has been one of excellence, growth, and transformation.</p>
<p style="margin: 0; font-size: 11.5px; color: #4b5563;">We celebrate 10 years of impact and look forward to many more years of lighting up lives and shaping a brighter future.</p>`

    const compactNarrative = `<p style="margin: 0 0 5px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
<p style="margin: 0 0 5px 0; font-size: 12px; color: #374151;">From 2016 to 2026, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
<p style="margin: 0; font-size: 11.5px; color: #4b5563;">We celebrate 10 years of impact and look forward to many more years of lighting up lives and shaping a brighter future.</p>`

    const legalCopyBlock = `<div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e7dec2;">
  <p style="margin: 0 0 5px 0; font-size: 11px; font-weight: 600; color: #7a828e;">ACOB Lighting Technology Limited is a renewable energy company registered under the Laws of the Federal Republic of Nigeria.</p>
  <p style="margin: 0; font-size: 10.5px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
</div>`

    const anniversaryFooter = `<div style="border-top: 1px solid #e7dec2; padding-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4;">
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
</div>`

    const executiveAnniversaryFooter = `<div style="border-top: 1px solid #e7dec2; padding-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4;">
  <p style="margin: 0 0 5px 0; font-size: 10.75px; color: #7a828e;">ACOB Lighting Technology Limited is a renewable energy company registered under the Laws of the Federal Republic of Nigeria.</p>
  <p style="margin: 0 0 8px 0; font-size: 10.25px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
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
</div>`

    const renderAnniversaryLayout = (body: string) => `<div style="font-family: ${selectedAnniversaryFont}; max-width: 1000px; margin: 0; padding: 12px 0; line-height: 1.5; color: #1f2937;">
  ${body}
</div>`

    const templates: Record<(typeof ANNIVERSARY_TEMPLATE_OPTIONS)[number]["id"], string> = {
      classic: renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 8px;">
    <tr>
      <td style="width: 4px; background: linear-gradient(180deg, #c5a028, #d4af37, #e8c947); border-radius: 4px;" width="4"></td>
      <td style="padding-left: 14px;">
        <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a; letter-spacing: -0.025em;">${fullName}</p>
        <p style="margin: 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom: 8px;">${contactBlock}</div>
  <div style="margin: 14px 0 16px 0; border-top: 1px solid #d4af37;"></div>
  <div style="margin-bottom: 10px;">${anniversaryLogo}</div>
  <div style="margin-bottom: 10px;">${anniversaryNarrative}${legalCopyBlock}</div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${anniversaryFooter}`),
      timeline: renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
  <div style="margin-bottom: 8px;">${contactBlock}</div>
  <div style="margin-bottom: 10px;">${anniversaryLogo}</div>
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
  <div style="margin-bottom: 10px;">${compactNarrative}${legalCopyBlock}</div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${anniversaryFooter}`),
      heritage: renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <div style="margin-bottom: 10px;">
    <div style="padding-left: 12px; border-left: 3px solid #d4af37;">
      <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
      <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
    </div>
    ${contactBlock}
  </div>
  <div style="margin-bottom: 10px; padding: 10px 12px; background: #fbf8ec; border-left: 3px solid #d4af37;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    ${anniversaryNarrative}
    ${legalCopyBlock}
  </div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${anniversaryFooter}`),
      renewal: renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="margin-bottom: 10px; padding: 14px 16px; border: 1px solid #e7dec2; background: linear-gradient(180deg, #ffffff, #fcf9ef);">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.24em; color: #8a6b08;">Celebrating 10 Years of Impact</p>
    ${compactNarrative}
  </div>
  <div style="margin-bottom: 10px;">${legalCopyBlock}</div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${anniversaryFooter}`),
      "renewal-accent": renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="width: 1px; background: #e7dec2;" width="1"></td>
      <td style="padding-left: 12px;">
        <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="margin-bottom: 10px; padding: 14px 16px; border: 1px solid #e7dec2; background: linear-gradient(180deg, #ffffff, #fcf9ef);">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.24em; color: #8a6b08;">Celebrating 10 Years of Impact</p>
    ${compactNarrative}
  </div>
  <div style="margin-bottom: 10px;">${legalCopyBlock}</div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${anniversaryFooter}`),
      "renewal-executive": renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 10px;">
    <tr>
      <td style="width: 1px; background: #e7dec2;" width="1"></td>
      <td style="padding-left: 12px;">
        <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
        <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
      </td>
    </tr>
  </table>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="margin-bottom: 10px; padding: 14px 16px; border: 1px solid #e7dec2; background: linear-gradient(180deg, #ffffff, #fcf9ef);">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    <p style="margin: 0 0 5px 0; font-size: 12px; text-transform: uppercase; letter-spacing: 0.24em; color: #8a6b08;">Celebrating 10 Years of Impact</p>
    ${compactNarrative}
  </div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${executiveAnniversaryFooter}`),
      minimal: renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 14px 16px; border: 1px solid #e7dec2; background: linear-gradient(180deg, #ffffff, #fcf9ef); border-radius: 8px;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
    <p style="margin: 0 0 12px 0; font-size: 12px; color: #374151;">From 2016 to 2026, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
    <p style="margin: 0 0 12px 0; font-size: 10.5px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
    <div style="margin-bottom: 12px;">${socialBlock}</div>
    <div style="border-top: 1px solid #e7dec2; padding-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4;">
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
    </div>
  </div>`),
      "minimal-clean": renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="padding: 14px 16px; border: 1px solid #e7dec2; background: linear-gradient(180deg, #ffffff, #fcf9ef); border-radius: 8px;">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
    <p style="margin: 0 0 12px 0; font-size: 12px; color: #374151;">From 2016 to 2026, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
    <div style="margin-bottom: 12px;">${socialBlock}</div>
    <div style="border-top: 1px solid #e7dec2; padding-top: 8px; font-size: 11px; color: #6b7280; line-height: 1.4; margin-bottom: 12px;">
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
    </div>
    <p style="margin: 0; font-size: 10.5px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
  </div>`),
      "minimal-confidential": renderAnniversaryLayout(`<div style="color: #0f5c4d;">&mdash;&mdash;</div>
  <p style="margin: 0 0 4px 0; font-size: 14px; color: #4b5563; font-style: italic;">Best Regards,</p>
  <p style="margin: 0; line-height: 1; font-size: 20px; font-weight: 700; color: #0f172a;">${fullName}</p>
  <p style="margin: 0 0 8px 0; font-size: 14px; font-weight: 600; color: #0f5c4d;">${formData.companyRole}</p>
  <div style="margin-bottom: 10px;">${contactBlock}</div>
  <div style="margin-bottom: 10px; padding: 14px 16px; border: 1px solid #e7dec2; background: linear-gradient(180deg, #ffffff, #fcf9ef);">
    <div style="margin-bottom: 8px;">${anniversaryLogo}</div>
    <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #0f5c4d;">A decade of purpose, progress, and power.</p>
    <p style="margin: 0 0 8px 0; font-size: 12px; color: #374151;">From 2016 to 2026, ACOB Lighting Technology Limited has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
    <p style="margin: 0; font-size: 10.5px; color: #7a828e; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
  </div>
  <div style="margin-bottom: 8px;">${socialBlock}</div>
  ${anniversaryFooter}`),
    }

    return templates[selectedAnniversaryTemplate]
  }

  const generateSignature = () => {
    const formattedFirstName = formatNameProperly(formData.firstName)
    const formattedMiddleName = formData.middleName ? formatNameProperly(formData.middleName) : ""
    const formattedLastName = formatNameProperly(formData.lastName)

    const fullName = `${formattedFirstName}${
      formattedMiddleName ? " " + formattedMiddleName : ""
    } ${formattedLastName}`.trim()
    const formattedPhone = formatPhoneNumber(formData.phoneNumber)

    if (variant === "anniversary") {
      return generateAnniversarySignature(fullName, formattedPhone)
    }

    return generateDefaultSignature(fullName, formattedPhone)
  }

  const copyToClipboard = async () => {
    const signature = generateSignature()
    try {
      await navigator.clipboard.writeText(signature)
      toast.success("Signature copied to clipboard!")
    } catch {
      toast.error("Failed to copy signature")
    }
  }

  const handleInputChange = (field: keyof FormData, value: string) => {
    if (field === "phoneNumber") {
      const numbersOnly = value.replace(/\D/g, "")
      setFormData((prev) => ({ ...prev, [field]: numbersOnly }))

      if (numbersOnly && !validatePhone(numbersOnly)) {
        setPhoneError("Phone number must be at least 11 digits")
      } else {
        setPhoneError("")
      }
      return
    }

    if (field === "companyEmail") {
      setFormData((prev) => ({ ...prev, [field]: value }))

      if (value && !validateEmail(value)) {
        setEmailError("Email must end with @org.acoblighting.com or @acoblighting.com")
      } else {
        setEmailError("")
      }
      return
    }

    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const isFormValid =
    formData.firstName &&
    formData.lastName &&
    formData.companyRole &&
    formData.phoneNumber &&
    validatePhone(formData.phoneNumber) &&
    formData.companyEmail &&
    validateEmail(formData.companyEmail) &&
    !emailError &&
    !phoneError

  const pageTitle = variant === "anniversary" ? "10th Anniversary Signature" : "Personal Information"
  const pageDescription =
    variant === "anniversary"
      ? "Generate the temporary 10th anniversary email signature"
      : "Fill in your details to generate your signature"
  const previewTitle = variant === "anniversary" ? "Anniversary Preview" : "Signature Preview"
  const previewDescription =
    variant === "anniversary"
      ? "This is how your temporary anniversary signature will look"
      : "This is how your signature will look"
  const copyButtonLabel = variant === "anniversary" ? "Copy Anniversary Signature" : "Copy Signature"

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle>{pageTitle}</CardTitle>
          <CardDescription>{pageDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => handleInputChange("firstName", e.target.value)}
                placeholder="John"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName}
                onChange={(e) => handleInputChange("middleName", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleInputChange("lastName", e.target.value)}
              placeholder="Akpa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyRole">Designation *</Label>
            <Input
              id="companyRole"
              value={formData.companyRole}
              onChange={(e) => handleInputChange("companyRole", e.target.value)}
              placeholder="IT Support employee"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Phone Number *</Label>
            <Input
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
              placeholder="07012345678"
            />
            {phoneError && <p className="text-destructive text-sm">{phoneError}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="companyEmail">Company Email *</Label>
            <Input
              id="companyEmail"
              type="email"
              value={formData.companyEmail}
              onChange={(e) => handleInputChange("companyEmail", e.target.value)}
              placeholder="a.john@org.acoblighting.com"
            />
            {emailError && <p className="text-destructive text-sm">{emailError}</p>}
          </div>

          {variant === "anniversary" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Signature Font</Label>
                <div className="flex flex-wrap gap-2">
                  {ANNIVERSARY_FONT_OPTIONS.map((font) => (
                    <Button
                      key={font.id}
                      type="button"
                      variant={selectedAnniversaryFont === font.value ? "default" : "outline"}
                      className="h-9"
                      style={{ fontFamily: font.value }}
                      onClick={() => setSelectedAnniversaryFont(font.value)}
                    >
                      {font.label}
                    </Button>
                  ))}
                </div>
                <p className="text-muted-foreground text-xs">Preview a few email-safe fonts before we keep one.</p>
              </div>

              <div className="space-y-2">
                <Label>Anniversary Template</Label>
                <Tabs value={selectedAnniversaryTemplate} onValueChange={(value) => setSelectedAnniversaryTemplate(value as (typeof ANNIVERSARY_TEMPLATE_OPTIONS)[number]["id"])}>
                  <TabsList className="h-auto w-full flex-wrap justify-start">
                    {ANNIVERSARY_TEMPLATE_OPTIONS.map((template) => (
                      <TabsTrigger key={template.id} value={template.id} className="min-w-[96px]">
                        {template.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <p className="text-muted-foreground text-xs">
                  We now have 11 anniversary directions here so you can compare fresh options based on the standard signature style.
                </p>
              </div>
            </div>
          )}

          <div className="flex">
            <Button onClick={copyToClipboard} disabled={!isFormValid} className="flex-1">
              <Copy className="mr-2 h-4 w-4" />
              {copyButtonLabel}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>{previewTitle}</CardTitle>
          <CardDescription>{previewDescription}</CardDescription>
        </CardHeader>
        <CardContent>
          {isFormValid ? (
            <div
              className="rounded-lg border bg-white p-4 text-sm"
              dangerouslySetInnerHTML={{ __html: generateSignature() }}
            />
          ) : (
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
              <p className="text-muted-foreground">Fill in the required fields to see preview</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
