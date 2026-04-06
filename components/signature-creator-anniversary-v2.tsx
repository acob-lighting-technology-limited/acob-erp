"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy, Sparkles } from "lucide-react"
import { toast } from "sonner"

interface SignatureCreatorAnniversaryV2Props {
  profile: {
    first_name?: string | null
    other_names?: string | null
    last_name?: string | null
    designation?: string | null
    phone_number?: string | null
    company_email?: string | null
  } | null
}

interface FormData {
  firstName: string
  middleName: string
  lastName: string
  companyRole: string
  phoneNumber: string
  companyEmail: string
}

const DEFAULT_ASSET_BASE_URL = "https://erp.acoblighting.com"

export function SignatureCreatorAnniversaryV2({ profile }: SignatureCreatorAnniversaryV2Props) {
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
      return `+234 ${withoutLeadingZero.substring(0, 3)} ${withoutLeadingZero.substring(3, 6)} ${withoutLeadingZero.substring(6)}`
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
    return name
      .split(/\s+/)
      .map((word) => {
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

  const generateSignature = () => {
    const formattedFirstName = formatNameProperly(formData.firstName)
    const formattedMiddleName = formData.middleName ? formatNameProperly(formData.middleName) : ""
    const formattedLastName = formatNameProperly(formData.lastName)

    const fullName = `${formattedFirstName}${formattedMiddleName ? " " + formattedMiddleName : ""} ${formattedLastName}`.trim()
    const formattedPhone = formatPhoneNumber(formData.phoneNumber)

    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 650px; margin: 0; padding: 0; line-height: 1.5;">
  <!-- Signature separator -->
  <div style="color: #0f5c4d;">&mdash;&mdash;</div>

  <!-- Greeting -->
  <p style="margin: 0 0 6px 0; font-size: 13px; color: #6b7280; font-style: italic; letter-spacing: 0.02em;">Best Regards,</p>

  <!-- === TOP SECTION: Name + Contact === -->
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; margin-bottom: 0;">
    <tr>
      <!-- Gold accent bar -->
      <td style="width: 4px; background: linear-gradient(180deg, #c5a028, #d4af37, #e8c947); border-radius: 4px;" width="4"></td>
      <td style="padding-left: 14px;">
        <!-- Name -->
        <p style="margin: 0 0 1px 0; font-size: 22px; font-weight: 800; color: #0a0a0a; letter-spacing: -0.03em; line-height: 1.1;">${fullName}</p>
        <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 600; color: #0f5c4d; letter-spacing: 0.03em; text-transform: uppercase;">${formData.companyRole}</p>

        <!-- Contact details - stacked -->
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; font-size: 13px; color: #374151;">
          <tr>
            <td style="padding-right: 6px; vertical-align: middle; padding-bottom: 2px;"><img src="${getAssetUrl("/images/signature/phone.png")}" width="15" height="15" alt="Phone" style="display: block; opacity: 0.7;" /></td>
            <td style="vertical-align: middle; padding-bottom: 2px;"><a href="tel:${formData.phoneNumber.replace(/\s+/g, "")}" style="color: #374151; text-decoration: none;">${formattedPhone}</a></td>
          </tr>
          <tr>
            <td style="padding-right: 6px; vertical-align: middle; padding-bottom: 2px;"><img src="${getAssetUrl("/images/signature/mail.png")}" width="15" height="15" alt="Email" style="display: block; opacity: 0.7;" /></td>
            <td style="vertical-align: middle; padding-bottom: 2px;"><a href="mailto:${formData.companyEmail}" style="color: #374151; text-decoration: none;">${formData.companyEmail}</a></td>
          </tr>
          <tr>
            <td style="padding-right: 6px; vertical-align: middle;"><img src="${getAssetUrl("/images/signature/web.png")}" width="15" height="15" alt="Web" style="display: block; opacity: 0.7;" /></td>
            <td style="vertical-align: middle;"><a href="https://www.acoblighting.com" style="color: #374151; text-decoration: none;">acoblighting.com</a></td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- === GRADIENT DIVIDER === -->
  <div style="margin: 14px 0; height: 2px; background: linear-gradient(90deg, #0f5c4d 0%, #1a7a66 25%, #d4af37 50%, #e8c947 75%, transparent 100%); border-radius: 2px;"></div>

  <!-- === ROW 1: Logo+Socials (left) | 10 Years badge (right) === -->
  <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%; margin-bottom: 10px;">
    <tr>
      <!-- Left: Logo + Social Icons -->
      <td style="vertical-align: top;">
        <img src="${getAssetUrl("/images/acob-logo-light-2026.webp")}" width="200" height="auto" alt="ACOB Lighting 10th Anniversary" style="display: block; margin-bottom: 8px;" />
        <div style="display: inline-block;">
          <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="${getAssetUrl("/images/signature/linkedin.png")}" width="22" height="22" alt="LinkedIn" style="border-radius: 4px; display: inline-block;" /></a>
          <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/x.png")}" width="22" height="22" alt="X" style="border-radius: 4px; display: inline-block;" /></a>
          <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/facebook.png")}" width="22" height="22" alt="Facebook" style="border-radius: 4px; display: inline-block;" /></a>
          <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="${getAssetUrl("/images/signature/instagram.png")}" width="22" height="22" alt="Instagram" style="border-radius: 4px; display: inline-block;" /></a>
        </div>
      </td>
      <!-- Right: 10 Years of Impact badge -->
      <td style="vertical-align: middle; text-align: left; padding-left: 16px;">
        <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; display: inline-table;">
          <tr>
            <td style="vertical-align: middle;">
              <span style="font-size: 48px; font-weight: 900; color: #0f5c4d; letter-spacing: -0.05em; line-height: 1;">10</span>
            </td>
            <td style="vertical-align: middle; padding-left: 8px;">
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: #d4af37; text-transform: uppercase; letter-spacing: 0.15em; line-height: 1.2;">YEARS OF</p>
              <p style="margin: 0; font-size: 11px; font-weight: 800; color: #d4af37; text-transform: uppercase; letter-spacing: 0.15em; line-height: 1.2;">IMPACT</p>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <div style="width: 1px; height: 36px; background-color: #e5e7eb;"></div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <p style="margin: 0; font-size: 18px; font-weight: 300; color: #6b7280; letter-spacing: -0.01em; line-height: 1;">2016</p>
              <p style="margin: 0; font-size: 18px; font-weight: 300; color: #6b7280; letter-spacing: -0.01em; line-height: 1;">2026</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <!-- === ROW 2: Tagline === -->
  <div style="margin-bottom: 12px;">
    <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 700; color: #0f5c4d; line-height: 1.3;">A decade of purpose, progress, and power.</p>
    <p style="margin: 0; font-size: 11.5px; color: #4b5563; line-height: 1.4;">For 10 remarkable years, ACOB Lighting Technology has remained committed to lighting up communities, driving innovation, and creating lasting impact across Nigeria.</p>
  </div>

  <!-- === FOOTER === -->
  <div style="border-top: 1px solid #d4af37; padding-top: 6px;">
    <table cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse; width: 100%;">
      <tr>
        <td style="font-size: 11px; color: #6b7280; font-style: italic; font-weight: 600;">Celebrating 10 Years of Impact &bull; Lighting Up Nigeria!</td>
        <td style="text-align: right; font-size: 11px; color: #9ca3af; font-weight: 500; letter-spacing: 0.05em;">2016 &ndash; 2026</td>
      </tr>
    </table>
  </div>
</div>`
  }

  const copyToClipboard = async () => {
    const signature = generateSignature()
    try {
      await navigator.clipboard.writeText(signature)
      toast.success("Anniversary signature V2 copied to clipboard!")
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

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            10th Anniversary Signature V2
          </CardTitle>
          <CardDescription>Generate the premium anniversary email signature</CardDescription>
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

          <div className="flex">
            <Button onClick={copyToClipboard} disabled={!isFormValid} className="flex-1">
              <Copy className="mr-2 h-4 w-4" />
              Copy Anniversary Signature V2
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-500" />
            Premium Preview
          </CardTitle>
          <CardDescription>This is how your premium anniversary signature will look</CardDescription>
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
