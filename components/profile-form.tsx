"use client"

import type React from "react"
import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import Link from "next/link"
import { X } from "lucide-react"

import { Switch } from "@/components/ui/switch"

const DEPARTMENTS = [
  "Accounts",
  "Admin & HR",
  "Business, Growth and Innovation",
  "IT and Communications",
  "Legal, Regulatory and Compliance",
  "Logistics",
  "Operations",
  "Technical",
]

interface ProfileFormProps {
  user: any
  profile: any
}

export function ProfileForm({ user, profile }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || "",
    lastName: profile?.last_name || "",
    otherNames: profile?.other_names || "",
    department: profile?.department || "",
    companyRole: profile?.company_role || "",
    phoneNumber: profile?.phone_number || "",
    additionalPhone: profile?.additional_phone || "",
    residentialAddress: profile?.residential_address || "",
    currentWorkLocation: profile?.current_work_location || "",
    bankName: profile?.bank_name || "",
    bankAccountNumber: profile?.bank_account_number || "",
    bankAccountName: profile?.bank_account_name || "",
    dateOfBirth: profile?.date_of_birth ? profile.date_of_birth.substring(0, 10) : "",
    employmentDate: profile?.employment_date ? profile.employment_date.substring(0, 10) : "",
    emailNotifications: profile?.email_notifications ?? true,
  })

  const [isLoading, setIsLoading] = useState(false)

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)

    // Clean phone numbers - only digits and + allowed
    const phoneNumber = formData.phoneNumber.replace(/[^0-9+]/g, "")
    const additionalPhone = formData.additionalPhone.replace(/[^0-9+]/g, "")

    // Validate phone numbers
    if (additionalPhone && additionalPhone === phoneNumber) {
      toast.error("Additional phone number must be different from main phone number")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          other_names: formData.otherNames,
          department: formData.department,
          company_role: formData.companyRole,
          phone_number: phoneNumber,
          additional_phone: additionalPhone,
          residential_address: formData.residentialAddress,
          current_work_location: formData.currentWorkLocation,
          bank_name: formData.bankName,
          bank_account_number: formData.bankAccountNumber,
          bank_account_name: formData.bankAccountName,
          date_of_birth: formData.dateOfBirth || null,
          employment_date: formData.employmentDate || null,
          email_notifications: formData.emailNotifications,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error
      toast.success("Profile updated successfully!")
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update profile"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Your basic personal details</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal Details */}
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => handleInputChange("firstName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => handleInputChange("lastName", e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="otherNames">Other Names</Label>
                <Input
                  id="otherNames"
                  value={formData.otherNames}
                  onChange={(e) => handleInputChange("otherNames", e.target.value)}
                />
              </div>
            </div>

            {/* Company Information */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Company Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <Select value={formData.department} onValueChange={(value) => handleInputChange("department", value)}>
                    <SelectTrigger id="department">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((dept) => (
                        <SelectItem key={dept} value={dept}>
                          {dept}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="companyRole">Company Role</Label>
                  <Input
                    id="companyRole"
                    value={formData.companyRole}
                    onChange={(e) => handleInputChange("companyRole", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Contact Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Phone Number</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => {
                      // Only allow numbers and + symbol
                      const value = e.target.value.replace(/[^0-9+]/g, "")
                      handleInputChange("phoneNumber", value)
                    }}
                    placeholder="e.g., +2348012345678"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="additionalPhone">Additional Phone Number (Optional)</Label>
                  <Input
                    id="additionalPhone"
                    type="tel"
                    value={formData.additionalPhone}
                    onChange={(e) => {
                      // Only allow numbers and + symbol
                      const value = e.target.value.replace(/[^0-9+]/g, "")
                      handleInputChange("additionalPhone", value)
                    }}
                    placeholder="Must be different from main phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="residentialAddress">Residential Address</Label>
                <Textarea
                  id="residentialAddress"
                  value={formData.residentialAddress}
                  onChange={(e) => handleInputChange("residentialAddress", e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch
                  id="emailNotifications"
                  checked={formData.emailNotifications}
                  onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, emailNotifications: checked }))}
                />
                <Label htmlFor="emailNotifications">Receive email notifications for updates and tasks</Label>
              </div>
            </div>

            {/* Work Location */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Work Location</h3>
              <div className="space-y-2">
                <Label htmlFor="currentWorkLocation">Current Work Location</Label>
                <Select
                  value={formData.currentWorkLocation}
                  onValueChange={(value) => handleInputChange("currentWorkLocation", value)}
                >
                  <SelectTrigger id="currentWorkLocation">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Office">Office</SelectItem>
                    <SelectItem value="Site">Site</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Banking Information */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Banking Information</h3>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bankName">Bank Name</Label>
                  <Input
                    id="bankName"
                    value={formData.bankName}
                    onChange={(e) => handleInputChange("bankName", e.target.value)}
                    placeholder="e.g., First Bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountNumber">Account Number</Label>
                  <Input
                    id="bankAccountNumber"
                    type="text"
                    value={formData.bankAccountNumber}
                    onChange={(e) => {
                      // Only allow numbers
                      const value = e.target.value.replace(/[^0-9]/g, "")
                      handleInputChange("bankAccountNumber", value)
                    }}
                    placeholder="e.g., 1234567890"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bankAccountName">Account Name</Label>
                  <Input
                    id="bankAccountName"
                    value={formData.bankAccountName}
                    onChange={(e) => handleInputChange("bankAccountName", e.target.value)}
                    placeholder="e.g., John Doe"
                  />
                </div>
              </div>
            </div>

            {/* Personal Dates */}
            <div className="space-y-4 border-t pt-6">
              <h3 className="font-semibold">Personal Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employmentDate">Employment Date</Label>
                  <Input
                    id="employmentDate"
                    type="date"
                    value={formData.employmentDate}
                    onChange={(e) => handleInputChange("employmentDate", e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 border-t pt-6">
              <Button type="submit" loading={isLoading}>
                Save Changes
              </Button>
              <Link href="/dashboard">
                <Button variant="outline">Back to Dashboard</Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
