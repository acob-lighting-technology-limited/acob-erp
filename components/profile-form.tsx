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

const DEPARTMENTS = [
  "Accounts",
  "Legal, Regulatory and Compliance",
  "IT and Communications",
  "Operations",
  "Logistics",
  "Technical",
  "Administrative",
  "Business Growth and Innovation",
  "Others",
]

const DEVICE_TYPES = ["Laptop", "Desktop"]

interface Device {
  id: string
  type: string
  brand: string
  model: string
}

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
    siteName: profile?.site_name || "",
    siteState: profile?.site_state || "",
    bankName: profile?.bank_name || "",
    bankAccountNumber: profile?.bank_account_number || "",
    bankAccountName: profile?.bank_account_name || "",
    dateOfBirth: profile?.date_of_birth ? profile.date_of_birth.substring(0, 10) : "",
    employmentDate: profile?.employment_date ? profile.employment_date.substring(0, 10) : "",
  })

  const [devices, setDevices] = useState<Device[]>(
    profile?.devices || [
      {
        id: "1",
        type: profile?.device_type || "",
        brand: profile?.device_allocated || "",
        model: profile?.device_model || "",
      },
    ]
  )

  const [isLoading, setIsLoading] = useState(false)
  const [showLocationFields, setShowLocationFields] = useState(formData.currentWorkLocation === "Site")

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))

    if (field === "currentWorkLocation") {
      setShowLocationFields(value === "Site")
    }
  }

  const handleDeviceChange = (index: number, field: string, value: string) => {
    const newDevices = [...devices]
    newDevices[index] = { ...newDevices[index], [field]: value }
    setDevices(newDevices)
  }

  const addDevice = () => {
    setDevices([
      ...devices,
      {
        id: Date.now().toString(),
        type: "",
        brand: "",
        model: "",
      },
    ])
  }

  const removeDevice = (index: number) => {
    setDevices(devices.filter((_, i) => i !== index))
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
          site_name: formData.siteName,
          site_state: formData.siteState,
          device_type: devices[0]?.type || "",
          device_allocated: devices[0]?.brand || "",
          device_model: devices[0]?.model || "",
          devices: devices,
          bank_name: formData.bankName,
          bank_account_number: formData.bankAccountNumber,
          bank_account_name: formData.bankAccountName,
          date_of_birth: formData.dateOfBirth || null,
          employment_date: formData.employmentDate || null,
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

              {showLocationFields && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="siteName">Site Name</Label>
                    <Input
                      id="siteName"
                      value={formData.siteName}
                      onChange={(e) => handleInputChange("siteName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="siteState">Site State</Label>
                    <Input
                      id="siteState"
                      value={formData.siteState}
                      onChange={(e) => handleInputChange("siteState", e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Device Information - Multiple Devices */}
            <div className="space-y-4 border-t pt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Device Information</h3>
                <Button type="button" variant="outline" size="sm" onClick={addDevice}>
                  Add Device
                </Button>
              </div>

              {devices.map((device, index) => (
                <div key={device.id} className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Device {index + 1}</span>
                    {devices.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => removeDevice(index)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label htmlFor={`deviceType-${index}`}>Device Type</Label>
                      <Select value={device.type} onValueChange={(value) => handleDeviceChange(index, "type", value)}>
                        <SelectTrigger id={`deviceType-${index}`}>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {DEVICE_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deviceBrand-${index}`}>Device Brand</Label>
                      <Select value={device.brand} onValueChange={(value) => handleDeviceChange(index, "brand", value)}>
                        <SelectTrigger id={`deviceBrand-${index}`}>
                          <SelectValue placeholder="Select brand" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Dell">Dell</SelectItem>
                          <SelectItem value="HP">HP</SelectItem>
                          <SelectItem value="Others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`deviceModel-${index}`}>Device Model</Label>
                      <Input
                        id={`deviceModel-${index}`}
                        value={device.model}
                        onChange={(e) => handleDeviceChange(index, "model", e.target.value)}
                        placeholder="e.g., Latitude 5520"
                      />
                    </div>
                  </div>
                </div>
              ))}
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
