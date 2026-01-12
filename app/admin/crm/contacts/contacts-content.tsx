"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import {
  Search,
  Plus,
  Filter,
  Users,
  Building2,
  Mail,
  Phone,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  UserPlus,
  ArrowUpDown,
} from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { CRMContact } from "@/types/crm"

const typeColors: Record<string, string> = {
  lead: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400",
  customer: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400",
  vendor: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  partner: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400",
}

const stageColors: Record<string, string> = {
  new: "bg-gray-100 text-gray-700",
  qualified: "bg-blue-100 text-blue-700",
  proposal: "bg-indigo-100 text-indigo-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
}

interface ContactsContentProps {
  initialContacts: CRMContact[]
  initialTotalCount: number
}

export function ContactsContent({ initialContacts, initialTotalCount }: ContactsContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [contacts, setContacts] = useState<CRMContact[]>(initialContacts)
  const [isLoading, setIsLoading] = useState(false)
  const [totalCount, setTotalCount] = useState(initialTotalCount)

  // Filters
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [stageFilter, setStageFilter] = useState("all")
  const [page, setPage] = useState(1)
  const limit = 20

  // Refetch when filters change (not on initial mount)
  useEffect(() => {
    if (typeFilter !== "all" || stageFilter !== "all" || page > 1) {
      loadContacts()
    }
  }, [typeFilter, stageFilter, page])

  const loadContacts = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      params.set("limit", limit.toString())
      params.set("offset", ((page - 1) * limit).toString())

      if (typeFilter !== "all") params.set("type", typeFilter)
      if (stageFilter !== "all") params.set("stage", stageFilter)
      if (search) params.set("search", search)

      const response = await fetch(`/api/crm/contacts?${params}`)
      const data = await response.json()

      if (!response.ok) throw new Error(data.error)

      setContacts(data.data || [])
      setTotalCount(data.count || 0)
    } catch (error: any) {
      console.error("Error loading contacts:", error)
      toast.error("Failed to load contacts")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    loadContacts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this contact?")) return

    try {
      const response = await fetch(`/api/crm/contacts/${id}`, { method: "DELETE" })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error)
      }
      toast.success("Contact deleted")
      loadContacts()
    } catch (error: any) {
      toast.error(error.message || "Failed to delete contact")
    }
  }

  const totalPages = Math.ceil(totalCount / limit)

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">Manage your leads, customers, vendors, and partners</p>
        </div>
        <Link
          href="/admin/crm/contacts/new"
          className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <form onSubmit={handleSearch} className="flex flex-1 gap-2">
              <div className="relative flex-1">
                <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button type="submit" variant="secondary">
                Search
              </Button>
            </form>

            <div className="flex gap-2">
              <Select
                value={typeFilter}
                onValueChange={(v) => {
                  setTypeFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="lead">Leads</SelectItem>
                  <SelectItem value="customer">Customers</SelectItem>
                  <SelectItem value="vendor">Vendors</SelectItem>
                  <SelectItem value="partner">Partners</SelectItem>
                </SelectContent>
              </Select>

              <Select
                value={stageFilter}
                onValueChange={(v) => {
                  setStageFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="qualified">Qualified</SelectItem>
                  <SelectItem value="proposal">Proposal</SelectItem>
                  <SelectItem value="negotiation">Negotiation</SelectItem>
                  <SelectItem value="won">Won</SelectItem>
                  <SelectItem value="lost">Lost</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-4 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id} className="hover:bg-muted/50 cursor-pointer">
                    <TableCell>
                      <Link href={`/admin/crm/contacts/${contact.id}`} className="block">
                        <div className="font-medium">{contact.contact_name}</div>
                        <div className="text-muted-foreground flex items-center gap-3 text-xs">
                          {contact.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {contact.email}
                            </span>
                          )}
                          {contact.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground">{contact.company_name || "—"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={typeColors[contact.type]}>
                        {contact.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={stageColors[contact.stage] || ""}>
                        {contact.stage}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contact.assigned_user ? (
                        <span className="text-sm">
                          {contact.assigned_user.first_name} {contact.assigned_user.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/admin/crm/contacts/${contact.id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => router.push(`/admin/crm/contacts/${contact.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(contact.id)}>
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center">
              <Users className="text-muted-foreground mx-auto mb-4 h-12 w-12 opacity-50" />
              <h3 className="mb-1 font-medium">No contacts found</h3>
              <p className="text-muted-foreground mb-4 text-sm">
                {search || typeFilter !== "all" || stageFilter !== "all"
                  ? "Try adjusting your filters"
                  : "Get started by adding your first contact"}
              </p>
              <Link
                href="/admin/crm/contacts/new"
                className="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors"
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Contact
              </Link>
            </div>
          )}
        </CardContent>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-6 py-4">
            <p className="text-muted-foreground text-sm">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
