"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"

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

interface AdminUserModalProps {
  user: any
  onClose: () => void
  onSave: () => void
}

export function AdminUserModal({ user, onClose, onSave }: AdminUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: user.first_name || "",
    lastName: user.last_name || "",
    department: user.department || "",
    companyRole: user.company_role || "",
    phoneNumber: user.phone_number || "",
    deviceType: user.device_type || "",
    deviceModel: user.device_model || "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSave = async () => {
    const supabase = createClient()
    setIsLoading(true)

    // Validate phone number - only digits and + allowed
    const phoneNumber = formData.phoneNumber.replace(/[^0-9+]/g, "")

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: formData.firstName,
          last_name: formData.lastName,
          department: formData.department,
          company_role: formData.companyRole,
          phone_number: phoneNumber,
          device_type: formData.deviceType,
          device_model: formData.deviceModel,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id)

      if (error) throw error

      // Log the admin action
      await supabase.from("admin_logs").insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: "UPDATE_USER",
        target_user_id: user.id,
        changes: formData,
      })

      toast.success("User updated successfully!")
      onSave()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update user"
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user information</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="department">Department</Label>
            <Select
              value={formData.department}
              onValueChange={(value) => setFormData({ ...formData, department: value })}
            >
              <SelectTrigger id="department">
                <SelectValue />
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

          <div>
            <Label htmlFor="companyRole">Company Role</Label>
            <Input
              id="companyRole"
              value={formData.companyRole}
              onChange={(e) => setFormData({ ...formData, companyRole: e.target.value })}
            />
          </div>

          <div>
            <Label htmlFor="phoneNumber">Phone Number</Label>
            <Input
              id="phoneNumber"
              type="tel"
              value={formData.phoneNumber}
              onChange={(e) => {
                // Only allow numbers and + symbol
                const value = e.target.value.replace(/[^0-9+]/g, "")
                setFormData({ ...formData, phoneNumber: value })
              }}
              placeholder="e.g., +2348012345678"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="deviceType">Device Type</Label>
              <Select
                value={formData.deviceType}
                onValueChange={(value) => setFormData({ ...formData, deviceType: value })}
              >
                <SelectTrigger id="deviceType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Laptop">Laptop</SelectItem>
                  <SelectItem value="Desktop">Desktop</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="deviceModel">Device Model</Label>
              <Input
                id="deviceModel"
                value={formData.deviceModel}
                onChange={(e) => setFormData({ ...formData, deviceModel: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} loading={isLoading} className="flex-1">
              Save Changes
            </Button>
            <Button onClick={onClose} variant="outline" className="flex-1 bg-transparent">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
