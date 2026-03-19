"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
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
import { PageLoader } from "@/components/ui/query-states"

interface SupplierFormData {
  name: string
  code: string
  email: string
  phone: string
  address: string
  contact_person: string
  is_active: boolean
}

async function fetchSupplier(id: string): Promise<SupplierFormData> {
  const supabase = createClient()
  const { data, error } = await supabase.from("suppliers").select("*").eq("id", id).single()
  if (error) throw new Error(error.message)
  return {
    name: data.name,
    code: data.code,
    email: data.email || "",
    phone: data.phone || "",
    address: data.address || "",
    contact_person: data.contact_person || "",
    is_active: data.is_active,
  }
}

export default function EditSupplierPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<SupplierFormData>({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    contact_person: "",
    is_active: true,
  })

  const { data: supplierData, isLoading } = useQuery({
    queryKey: QUERY_KEYS.adminSupplierDetail(id),
    queryFn: () => fetchSupplier(id),
  })

  useEffect(() => {
    if (supplierData) setFormData(supplierData)
  }, [supplierData])

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
        .eq("id", id)

      if (error) throw error
      toast.success("Supplier updated")
      router.push(`/admin/purchasing/suppliers/${id}`)
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update")
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="container mx-auto max-w-2xl space-y-6 p-6">
      <PageHeader
        title="Edit Supplier"
        backLink={{ href: `/admin/purchasing/suppliers/${id}`, label: "Back to Supplier" }}
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
