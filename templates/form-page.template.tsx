/**
 * FORM PAGE TEMPLATE
 *
 * Use this template for pages that display forms for:
 * - Creating new items
 * - Editing existing items
 *
 * Examples: New Product, Edit Profile, Create Task
 */

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageWrapper, PageHeader } from "@/components/layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Package } from "lucide-react"

// ============================================
// TYPES
// ============================================

interface FormData {
  name: string
  description: string
  status: string
  category_id?: string
}

interface Category {
  id: string
  name: string
}

// ============================================
// DATA FETCHING (Server-side)
// ============================================

async function getPageData(itemId?: string) {
  const supabase = await createClient()

  // 1. Check authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // 2. Fetch existing item if editing
  let item = null
  if (itemId) {
    const { data } = await supabase.from("items").select("*").eq("id", itemId).single()
    item = data
  }

  // 3. Fetch dropdown options (categories, etc.)
  const { data: categories } = await supabase.from("categories").select("id, name").order("name")

  return {
    item,
    categories: (categories || []) as Category[],
    isEditing: !!itemId,
  }
}

// ============================================
// PAGE COMPONENT
// ============================================

// For new items: /admin/items/new/page.tsx
// For editing: /admin/items/[id]/edit/page.tsx

interface FormPageProps {
  params?: Promise<{ id?: string }>
}

export default async function FormPage({ params }: FormPageProps) {
  const resolvedParams = params ? await params : {}
  const itemId = resolvedParams.id

  const data = await getPageData(itemId)

  // Handle redirects
  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    item: FormData | null
    categories: Category[]
    isEditing: boolean
  }

  return (
    <PageWrapper maxWidth="content" background="gradient">
      {/* Page Header */}
      <PageHeader
        title={pageData.isEditing ? "Edit Item" : "Create Item"}
        description={pageData.isEditing ? "Update item details" : "Add a new item"}
        icon={Package}
        backLink={{ href: "/admin/items", label: "Back to Items" }}
      />

      {/* Form Layout - Two columns on large screens */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Form - Takes 2 columns */}
        <div className="space-y-6 lg:col-span-2">
          {/* Basic Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>Basic Information</CardTitle>
            </CardHeader>
            <CardContent>
              <form id="item-form" className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name *</Label>
                    <Input id="name" defaultValue={pageData.item?.name || ""} placeholder="Enter name" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="category">Category</Label>
                    <Select defaultValue={pageData.item?.category_id || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {pageData.categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    defaultValue={pageData.item?.description || ""}
                    placeholder="Enter description..."
                    rows={4}
                  />
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Add more form cards as needed */}
        </div>

        {/* Sidebar - Takes 1 column */}
        <div className="space-y-6">
          {/* Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select defaultValue={pageData.item?.status || "active"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Submit Button */}
          <Button type="submit" form="item-form" className="w-full">
            <Package className="mr-2 h-4 w-4" />
            {pageData.isEditing ? "Update Item" : "Create Item"}
          </Button>
        </div>
      </div>
    </PageWrapper>
  )
}
