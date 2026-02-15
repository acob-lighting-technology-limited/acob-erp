/**
 * LIST PAGE TEMPLATE
 *
 * Use this template for pages that display lists of items with:
 * - Stats cards at the top
 * - Filters section
 * - Table or grid of items
 *
 * Examples: employee list, Tasks list, Products list, Projects list
 */

import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageWrapper, PageHeader, Section } from "@/components/layout"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Search, Package } from "lucide-react"
import Link from "next/link"

// ============================================
// TYPES
// ============================================

interface Item {
  id: string
  name: string
  status: string
  created_at: string
}

interface Stats {
  total: number
  active: number
  // Add more stats as needed
}

// ============================================
// DATA FETCHING (Server-side)
// ============================================

async function getPageData() {
  const supabase = await createClient()

  // 1. Check authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return { redirect: "/auth/login" as const }
  }

  // 2. Check authorization (optional)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single()

  if (profileError) {
    throw profileError
  }

  if (!profile || !["super_admin", "admin", "lead"].includes(profile.role)) {
    return { redirect: "/dashboard" as const }
  }

  // 3. Fetch data
  const [
    { data: items, error: itemsError },
    { count: total, error: totalError },
    { count: active, error: activeError },
  ] = await Promise.all([
    supabase.from("items").select("*").order("created_at", { ascending: false }),
    supabase.from("items").select("*", { count: "exact", head: true }),
    supabase.from("items").select("*", { count: "exact", head: true }).eq("status", "active"),
  ])

  if (itemsError || totalError || activeError) {
    throw itemsError ?? totalError ?? activeError
  }

  return {
    items: (items || []) as Item[],
    stats: {
      total: total || 0,
      active: active || 0,
    } as Stats,
    userRole: profile?.role,
  }
}

// ============================================
// PAGE COMPONENT
// ============================================

export default async function ListPage() {
  const data = await getPageData()

  // Handle redirects
  if ("redirect" in data && data.redirect) {
    redirect(data.redirect)
  }

  const pageData = data as {
    items: Item[]
    stats: Stats
    userRole: string
  }

  return (
    <PageWrapper maxWidth="full" background="gradient">
      {/* Page Header */}
      <PageHeader
        title="Items"
        description="Manage your items"
        icon={Package}
        actions={
          <Button asChild>
            <Link href="/admin/items/new">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Link>
          </Button>
        }
      />

      {/* Stats Section */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Total Items"
          value={pageData.stats.total}
          icon={Package}
          iconBgColor="bg-blue-100 dark:bg-blue-900/30"
          iconColor="text-blue-600 dark:text-blue-400"
        />
        <StatCard
          title="Active"
          value={pageData.stats.active}
          icon={Package}
          iconBgColor="bg-green-100 dark:bg-green-900/30"
          iconColor="text-green-600 dark:text-green-400"
        />
      </div>

      {/* Filters Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input placeholder="Search items..." className="pl-9" />
            </div>
            {/* Add more filters as needed */}
          </div>
        </CardContent>
      </Card>

      {/* Items Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Items</CardTitle>
        </CardHeader>
        <CardContent>
          {pageData.items.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No items yet"
              description="Get started by adding your first item."
              action={{ label: "Add Item", href: "/admin/items/new", icon: Plus }}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageData.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{item.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {new Intl.DateTimeFormat("en-US", {
                        timeZone: "UTC",
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      }).format(new Date(item.created_at))}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/items/${item.id}`}>View</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  )
}
