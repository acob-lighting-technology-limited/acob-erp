"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Copy } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"
import Link from "next/link"

interface SignatureCreatorProps {
  profile: any
}

interface FormData {
  firstName: string
  middleName: string
  lastName: string
  companyRole: string
  phoneNumber: string
  companyEmail: string
}

export function SignatureCreator({ profile }: SignatureCreatorProps) {
  const { theme, setTheme } = useTheme()
  const [formData, setFormData] = useState<FormData>({
    firstName: profile?.first_name || "",
    middleName: profile?.other_names || "",
    lastName: profile?.last_name || "",
    companyRole: profile?.company_role || "",
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
  }, [formData.firstName, formData.lastName])

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

  const generateSignature = () => {
    const formattedFirstName = formatNameProperly(formData.firstName)
    const formattedMiddleName = formData.middleName ? formatNameProperly(formData.middleName) : ""
    const formattedLastName = formatNameProperly(formData.lastName)

    const fullName = `${formattedFirstName}${
      formattedMiddleName ? " " + formattedMiddleName : ""
    } ${formattedLastName}`.trim()
    const formattedPhone = formatPhoneNumber(formData.phoneNumber)

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
        <img src="https://www.acoblighting.com/images/signature/phone.png" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Phone" /><a href="tel:${formData.phoneNumber.replace(
          /\s+/g,
          ""
        )}" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formattedPhone}</a>
      </div>
      <div style="margin: 0 0 1px 0;">
        <img src="https://www.acoblighting.com/images/signature/mail.png" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Email" /><a href="mailto:${
          formData.companyEmail
        }" style="color: #1f2937; text-decoration: none; vertical-align: middle;">${formData.companyEmail}</a>
      </div>
      <div>
        <img src="https://www.acoblighting.com/images/signature/web.png" width="18" height="18" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Website" /><a href="http://www.acoblighting.com" style="color: #1f2937; text-decoration: none; vertical-align: middle;">www.acoblighting.com</a>
      </div>
    </div>
  </div>
  
  <!-- Logo + Socials (stacked vertically) -->
  <div style="margin-bottom: 8px;">
    <img src="https://www.acoblighting.com/images/signature/acob-logo.png" width="200" height="47" alt="ACOB Lighting Technology Limited" style="display: block; margin-bottom: 8px;" />
    
   <div style="display: inline-block;">
  <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="https://www.acoblighting.com/images/signature/linkedin.png" width="22" height="22" alt="LinkedIn" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="https://www.acoblighting.com/images/signature/x.png" width="22" height="22" alt="X (Twitter)" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="https://www.acoblighting.com/images/signature/facebook.png" width="22" height="22" alt="Facebook" style="border-radius: 4px; display: inline-block;" /></a>
  <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 4px;"><img src="https://www.acoblighting.com/images/signature/instagram.png" width="22" height="22" alt="Instagram" style="border-radius: 4px; display: inline-block;" /></a>
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

  const copyToClipboard = async () => {
    const signature = generateSignature()
    try {
      await navigator.clipboard.writeText(signature)
      toast.success("Signature copied to clipboard!")
    } catch (err) {
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
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Fill in your details to generate your signature</CardDescription>
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
            <Label htmlFor="companyRole">Company Role *</Label>
            <Input
              id="companyRole"
              value={formData.companyRole}
              onChange={(e) => handleInputChange("companyRole", e.target.value)}
              placeholder="IT Support Staff"
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
            <p className="text-muted-foreground text-sm">
              Enter numbers only, minimum 11 digits (e.g., 07012345678) - will be formatted as +234 701 234 5678
            </p>
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
            <p className="text-muted-foreground text-sm">
              Auto-generated from your name. You can edit if needed (e.g., a.john@acoblighting.com)
            </p>
            {emailError && <p className="text-destructive text-sm">{emailError}</p>}
          </div>

          <div className="flex gap-2">
            <Button onClick={copyToClipboard} disabled={!isFormValid} className="flex-1">
              <Copy className="mr-2 h-4 w-4" />
              Copy Signature
            </Button>
            <Link href="/dashboard" className="flex-1">
              <Button variant="outline" className="w-full bg-transparent">
                Back
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Signature Preview</CardTitle>
          <CardDescription>This is how your signature will look</CardDescription>
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
