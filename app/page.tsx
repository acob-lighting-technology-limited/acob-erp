"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Copy, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { toast } from "sonner"

interface FormData {
  firstName: string
  middleName: string
  lastName: string
  companyRole: string
  phoneNumber: string
  companyEmail: string
}

export default function SignatureGenerator() {
  const { theme, setTheme } = useTheme()
  const [formData, setFormData] = useState<FormData>({
    firstName: "",
    middleName: "",
    lastName: "",
    companyRole: "",
    phoneNumber: "",
    companyEmail: "",
  })

  const [emailError, setEmailError] = useState("")
  const [phoneError, setPhoneError] = useState("")

  const formatPhoneNumber = (phone: string) => {
    // Remove any non-digits
    const digits = phone.replace(/\D/g, "")

    // If it starts with 0 and has 11 digits, format as Nigerian number
    if (digits.startsWith("0") && digits.length === 11) {
      const withoutLeadingZero = digits.substring(1)
      return `+234 ${withoutLeadingZero.substring(0, 3)} ${withoutLeadingZero.substring(3, 6)} ${withoutLeadingZero.substring(6)}`
    }

    // Return original if doesn't match expected format
    return phone
  }

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const validatePhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "")
    return digits.length >= 11
  }

  const generateSignature = () => {
    const fullName =
      `${formData.firstName}${formData.middleName ? " " + formData.middleName : ""} ${formData.lastName}`.trim()
    const formattedPhone = formatPhoneNumber(formData.phoneNumber)

    return `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0; padding: 12px 0; line-height: 1.5;">
  <!-- Thin green line -->
  <div style="color: #15803d;">&mdash;&mdash;</div>
  
  <!-- Greeting -->
  <p style="margin: 0 0 12px 0; font-size: 14px; color: #374151; font-style: italic;">Best Regards,</p>

  <!-- Name & Role -->
  <div style="border-bottom: 1.5px solid #15803d; padding-bottom: 12px; margin-bottom: 12px;">
    <p style="margin: 0 0 2px 0; font-size: 18px; font-weight: bold; color: #1f2937; letter-spacing: -0.025em;">${fullName}</p>
    <p style="margin: 0 0 10px 0; font-size: 14px; font-weight: 500; color: #15803d; text-transform: uppercase; letter-spacing: 0.05em; font-style: italic;">${formData.companyRole}</p>
    
    <!-- Contact details -->
    <div style="font-size: 14px; color: #374151; line-height: 1.6;">
      <div style="margin: 0 0 4px 0;">
        <img src="https://www.acoblighting.com/wp-includes/images/signature/phone.png" width="14" height="14" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Phone" /><a href="tel:${formData.phoneNumber.replace(/\s+/g, '')}" style="color: #15803d; text-decoration: none; vertical-align: middle;">${formattedPhone}</a>
      </div>
      <div style="margin: 0 0 4px 0;">
        <img src="https://www.acoblighting.com/wp-includes/images/signature/mail.png" width="14" height="14" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Email" /><a href="mailto:${formData.companyEmail}" style="color: #15803d; text-decoration: none; vertical-align: middle;">${formData.companyEmail}</a>
      </div>
      <div>
        <img src="https://www.acoblighting.com/wp-includes/images/signature/web.png" width="14" height="14" style="vertical-align: middle; opacity: 0.8; margin-right: 6px; display: inline-block;" alt="Website" /><a href="http://www.acoblighting.com" style="color: #15803d; text-decoration: none; vertical-align: middle;">www.acoblighting.com</a>
      </div>
    </div>
  </div>
  
  <!-- Logo + Socials (table ensures alignment on all clients) -->
  <table width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 12px;">
    <tbody>
      <tr>
        <td style="vertical-align: middle;">
          <img src="https://www.acoblighting.com/wp-includes/images/signature/acob-logo.png" width="200" height="47" alt="ACOB Lighting Technology Limited" style="display: block;" />
        </td>
        <td style="vertical-align: middle; text-align: right; white-space: nowrap;">
          <a href="https://www.linkedin.com/company/acob-lighting-technology-limited" style="text-decoration: none; display: inline-block;"><img src="https://www.acoblighting.com/wp-includes/images/signature/linkedin.png" width="25" height="25" alt="LinkedIn" style="border-radius: 4px; display: inline-block;" /></a>
          <a href="https://twitter.com/AcobLimited" style="text-decoration: none; display: inline-block; margin-left: 6px;"><img src="https://www.acoblighting.com/wp-includes/images/signature/x.png" width="25" height="25" alt="X (Twitter)" style="border-radius: 4px; display: inline-block;" /></a>
          <a href="https://www.facebook.com/acoblightingtechltd" style="text-decoration: none; display: inline-block; margin-left: 6px;"><img src="https://www.acoblighting.com/wp-includes/images/signature/facebook.png" width="25" height="25" alt="Facebook" style="border-radius: 4px; display: inline-block;" /></a>
          <a href="https://www.instagram.com/acob_lighting/" style="text-decoration: none; display: inline-block; margin-left: 6px;"><img src="https://www.acoblighting.com/wp-includes/images/signature/instagram.png" width="25" height="25" alt="Instagram" style="border-radius: 4px; display: inline-block;" /></a>
        </td>
      </tr>
    </tbody>
  </table>
  
  <!-- Footer -->
  <div style="border-top: 2px solid #e5e7eb; padding-top: 10px; font-size: 11px; color: #6b7280; line-height: 1.4;">
    <p style="margin: 0 0 6px 0; font-style: italic;">This email, including any attachments, contains confidential information intended solely for the recipient(s) named above. If you have received this email in error, please notify the sender immediately and delete the email from your system. Any unauthorized use, disclosure, distribution, or copying of this email is strictly prohibited and may be unlawful.</p>
    <p style="margin: 0 0 4px 0; font-weight: 600; color: #15803d;">ACOB Lighting Technology Limited is a renewable energy company registered under the Laws of the Federal Republic of Nigeria.</p>
    <p style="margin: 0 0 2px 0; font-style: italic;">We are a leading provider of solar and energy solutions for homes, businesses, and communities.</p>
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
        setEmailError("Please enter a valid email address")
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
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">ACOB Signature Creator</h1>
            <p className="text-muted-foreground">
              Generate professional email signatures for ACOB Lighting Technology Limited
            </p>
          </div>
          <Button variant="outline" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

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
                <p className="text-sm text-muted-foreground">
                  Enter numbers only, minimum 11 digits (e.g., 07012345678) - will be formatted as +234 701 234 5678
                </p>
                {phoneError && <p className="text-sm text-destructive">{phoneError}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Company Email *</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={formData.companyEmail}
                  onChange={(e) => handleInputChange("companyEmail", e.target.value)}
                  placeholder="j.akpa@org.acoblighting.com"
                />
                {emailError && <p className="text-sm text-destructive">{emailError}</p>}
              </div>

              <Button onClick={copyToClipboard} disabled={!isFormValid} className="w-full">
                <Copy className="mr-2 h-4 w-4" />
                Generate & Copy Signature
              </Button>
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
      </div>
    </div>
  )
}
