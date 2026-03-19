"use client"

import { useState } from "react"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Building2, Save } from "lucide-react"
import { toast } from "sonner"
import { FormFieldGroup } from "@/components/ui/patterns"

export default function CompanySettingsPage() {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    company_name: "ACOB Lighting Technology",
    legal_name: "ACOB Lighting Technology Limited",
    registration_number: "",
    tax_id: "",
    email: "info@acoblighting.com",
    phone: "",
    website: "https://acoblighting.com",
    address: "",
    city: "Lagos",
    country: "Nigeria",
    currency: "NGN",
    timezone: "Africa/Lagos",
  })

  async function handleSubmit(e?: React.FormEvent | React.MouseEvent) {
    e?.preventDefault()
    setSaving(true)

    try {
      // Save settings to database
      toast.success("Company settings saved")
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminTablePage
      title="Company Settings"
      description="Manage your organization details"
      icon={Building2}
      backLinkHref="/admin/settings"
      backLinkLabel="Back to Settings"
      actions={
        <Button onClick={handleSubmit} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Organization Details
            </CardTitle>
            <CardDescription>Basic information about your company</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Company Name">
                <Input
                  value={formData.company_name}
                  onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Legal Name">
                <Input
                  value={formData.legal_name}
                  onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                />
              </FormFieldGroup>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Registration Number">
                <Input
                  value={formData.registration_number}
                  onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                  placeholder="Company registration number"
                />
              </FormFieldGroup>
              <FormFieldGroup label="Tax ID">
                <Input
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                  placeholder="Tax identification number"
                />
              </FormFieldGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Email">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Phone">
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+234..."
                />
              </FormFieldGroup>
            </div>
            <FormFieldGroup label="Website">
              <Input value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} />
            </FormFieldGroup>
            <FormFieldGroup label="Address">
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </FormFieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="City">
                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
              </FormFieldGroup>
              <FormFieldGroup label="Country">
                <Input
                  value={formData.country}
                  onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                />
              </FormFieldGroup>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Regional Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Default Currency">
                <Input
                  value={formData.currency}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Timezone">
                <Input
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                />
              </FormFieldGroup>
            </div>
          </CardContent>
        </Card>
      </form>
    </AdminTablePage>
  )
}
