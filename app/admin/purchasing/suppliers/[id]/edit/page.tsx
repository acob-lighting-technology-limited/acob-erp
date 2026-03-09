"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { FormFieldGroup } from "@/components/ui/patterns"

export default function EditSupplierPage() {
  const params = useParams()
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    is_active: true,
  })

  useEffect(() => {
    fetchSupplier()
  }, [params.id])

  async function fetchSupplier() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("suppliers").select("*").eq("id", params.id).single()
      if (error) throw error
      setFormData({
        name: data.name,
        code: data.code,
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        contact_person: data.contact_person || "",
        is_active: data.is_active,
      })
    } catch (error) {
      toast.error("Supplier not found")
      router.push("/admin/purchasing/suppliers")
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("suppliers")
        .update({
          name: formData.name,
          code: formData.code,
          email: formData.email || null,
          phone: formData.phone || null,
          address: formData.address || null,
          contact_person: formData.contact_person || null,
          is_active: formData.is_active,
        })
        .eq("id", params.id)

      if (error) throw error
      toast.success("Supplier updated")
      router.push(`/admin/purchasing/suppliers/${params.id}`)
    } catch (error: any) {
      toast.error(error.message || "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center p-6">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader
        title="Edit Supplier"
        backLink={{ href: `/admin/purchasing/suppliers/${params.id}`, label: "Back to Supplier" }}
        actions={
          <Button onClick={handleSubmit} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        }
      />

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Supplier Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Name *">
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </FormFieldGroup>
              <FormFieldGroup label="Code *">
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                />
              </FormFieldGroup>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormFieldGroup label="Email">
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </FormFieldGroup>
              <FormFieldGroup label="Phone">
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </FormFieldGroup>
            </div>
            <FormFieldGroup label="Contact Person">
              <Input
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </FormFieldGroup>
            <FormFieldGroup label="Address">
              <Textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
              />
            </FormFieldGroup>
            <FormFieldGroup label="Active Status" className="pt-2">
              <div className="flex items-center justify-end">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                />
              </div>
            </FormFieldGroup>
          </CardContent>
        </Card>
      </form>
    </div>
  )
}
