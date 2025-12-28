"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Plus, Search, MoreVertical, Trash2, Pencil, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { format, parseISO, isValid, differenceInDays, isBefore, startOfDay } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"

interface Payment {
  id: string
  department_id: string
  title: string
  amount: number
  currency: string
  status: "due" | "paid" | "overdue" | "cancelled"
  payment_type: "one-time" | "recurring"
  recurrence_period?: "monthly" | "quarterly" | "yearly"
  next_payment_due?: string
  payment_date?: string
  category: string
  description?: string
  notes?: string
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  payment_reference?: string
  amount_paid?: number
  created_at: string
  created_by?: string
  department?: {
    name: string
  }
}

interface Department {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

interface FormData {
  department_id: string
  category: string
  title: string
  description: string
  amount: string
  currency: string
  recurrence_period: string
  next_payment_due: string
  payment_date: string
  issuer_name: string
  issuer_phone_number: string
  issuer_address: string
  payment_reference: string
  notes: string
  payment_type: "one-time" | "recurring"
}

export default function DepartmentPaymentsPage() {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  // Current User State
  const [currentUser, setCurrentUser] = useState<{ id: string; department_id: string; is_admin: boolean } | null>(null)

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")

  // Modal & Edit State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [formData, setFormData] = useState<FormData>({
    department_id: "",
    category: "",
    title: "",
    description: "",
    amount: "",
    currency: "NGN",
    recurrence_period: "monthly",
    next_payment_due: "",
    payment_date: "",
    issuer_name: "",
    issuer_phone_number: "",
    issuer_address: "",
    payment_reference: "",
    notes: "",
    payment_type: "one-time",
  })

  useEffect(() => {
    // 1. Fetch User & Profile first
    const init = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("department, is_admin")
          .eq("id", user.id)
          .single()

        if (profile) {
          // Fetch department ID
          const { data: dept } = await supabase
            .from("departments")
            .select("id, name")
            .eq("name", profile.department)
            .single()

          if (dept) {
            setCurrentUser({ id: user.id, department_id: dept.id, is_admin: profile.is_admin })
            setFormData((prev) => ({ ...prev, department_id: dept.id })) // Pre-fill department
          }
        }
      }

      // 2. Fetch Data
      fetchData()
      fetchAuxData()
    }
    init()
  }, [])

  // Cleanup effect to remove any stuck modal backdrops
  useEffect(() => {
    return () => {
      // Remove any stuck modal backdrops on unmount
      const backdrops = document.querySelectorAll("[data-radix-dialog-overlay]")
      backdrops.forEach((backdrop) => backdrop.remove())
    }
  }, [])

  // Clean up backdrop when modal closes
  useEffect(() => {
    if (!isModalOpen) {
      // Small delay to let the dialog close animation finish
      const timer = setTimeout(() => {
        const backdrops = document.querySelectorAll("[data-radix-dialog-overlay]")
        backdrops.forEach((backdrop) => {
          if (backdrop.getAttribute("data-state") === "closed") {
            backdrop.remove()
          }
        })
        // Also remove any orphaned backdrops
        document.body.style.pointerEvents = ""
        document.body.style.overflow = ""
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isModalOpen])

  const fetchData = async () => {
    try {
      const response = await fetch("/api/payments")
      const data = await response.json()
      if (response.ok) {
        setPayments(data.data || [])
      }
    } catch (error) {
      toast.error("Failed to fetch payments")
    } finally {
      setLoading(false)
    }
  }

  const fetchAuxData = async () => {
    try {
      const [deptRes, catRes] = await Promise.all([fetch("/api/departments"), fetch("/api/payments/categories")])

      if (deptRes.ok) {
        const data = await deptRes.json()
        setDepartments(data.data || [])
      }
      if (catRes.ok) {
        const data = await catRes.json()
        setCategories(data.data || [])
      }
    } catch (error) {
      console.error("Failed to fetch aux data", error)
    }
  }

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      title: "",
      description: "",
      amount: "",
      payment_date: "",
      next_payment_due: "",
      category: "",
      issuer_name: "",
      issuer_phone_number: "",
      issuer_address: "",
      payment_reference: "",
      notes: "",
    }))
    setEditingId(null)
  }

  const handleEdit = (payment: Payment) => {
    setEditingId(payment.id)
    setFormData({
      department_id: payment.department_id,
      category: payment.category,
      title: payment.title,
      description: payment.description || "",
      amount: payment.amount.toString(),
      currency: payment.currency,
      recurrence_period: payment.recurrence_period || "monthly",
      next_payment_due: payment.next_payment_due ? payment.next_payment_due.split("T")[0] : "",
      payment_date: payment.payment_date ? payment.payment_date.split("T")[0] : "",
      issuer_name: payment.issuer_name || "",
      issuer_phone_number: payment.issuer_phone_number || "",
      issuer_address: payment.issuer_address || "",
      payment_reference: payment.payment_reference || "",
      notes: payment.notes || "",
      payment_type: payment.payment_type,
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (!formData.department_id || !formData.category || !formData.amount || !formData.title) {
        toast.error("Please fill in required fields")
        setSubmitting(false)
        return
      }

      if (formData.payment_type === "recurring" && (!formData.recurrence_period || !formData.next_payment_due)) {
        toast.error("Recurring payments require a period and start date")
        setSubmitting(false)
        return
      }

      if (formData.payment_type === "one-time" && !formData.payment_date) {
        toast.error("One-time payments require a payment date")
        setSubmitting(false)
        return
      }

      const url = editingId ? `/api/payments/${editingId}` : "/api/payments"
      const method = editingId ? "PATCH" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      if (response.ok) {
        toast.success(editingId ? "Payment updated successfully" : "Payment created successfully")
        setIsModalOpen(false)
        resetForm()
        fetchData()
      } else {
        const data = await response.json()
        toast.error(data.error || "Operation failed")
      }
    } catch (error) {
      toast.error("Error creating/updating payment")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this payment?")) return

    try {
      const response = await fetch(`/api/payments/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast.success("Payment deleted")
        fetchData()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to delete")
      }
    } catch (e) {
      toast.error("Error deleting payment")
    }
  }

  // Helper functions
  const getRealStatus = (p: Payment): "due" | "paid" | "overdue" | "cancelled" => {
    if (p.status === "paid" || p.status === "cancelled") return p.status

    const dateStr = p.payment_type === "recurring" ? p.next_payment_due : p.payment_date
    if (!dateStr) return "due"

    const date = parseISO(dateStr)
    if (!isValid(date)) return "due"

    const today = startOfDay(new Date())
    const daysDiff = differenceInDays(date, today)

    if (isBefore(date, today)) {
      return "overdue"
    }

    if (daysDiff <= 7) {
      return "due"
    }

    return "paid"
  }

  const getAmountDue = (p: Payment) => {
    const status = getRealStatus(p)
    if (status === "paid" || status === "cancelled") return 0
    if (status === "due") return p.amount
    if (status === "overdue") return p.amount
    return 0
  }

  const processedPayments = payments.map((p) => ({
    ...p,
    status: getRealStatus(p),
    amountDue: getAmountDue(p),
  }))

  const filteredPayments = processedPayments.filter((payment) => {
    const matchesSearch =
      payment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.department?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.issuer_name || "").toLowerCase().includes(searchQuery.toLowerCase())

    const matchesDepartment = currentUser?.department_id ? payment.department_id === currentUser.department_id : true

    const matchesCategory = categoryFilter === "all" || payment.category === categoryFilter
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter
    const matchesType = typeFilter === "all" || payment.payment_type === typeFilter

    return matchesSearch && matchesCategory && matchesStatus && matchesType && matchesDepartment
  })

  // Permission Check Helper
  const canManagePayment = (payment: Payment) => {
    if (!currentUser) return false
    if (currentUser.is_admin) return true
    return payment.created_by === currentUser.id
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "paid":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
      case "due":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      case "overdue":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
      case "cancelled":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400"
      default:
        return ""
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Department Payments</h1>
          <p className="text-muted-foreground">
            Manage payments for{" "}
            {currentUser?.department_id
              ? departments.find((d) => d.id === currentUser.department_id)?.name
              : "your department"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              resetForm()
              setIsModalOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            New Payment
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
              <Input
                placeholder="Search payments..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="due">Due</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter} defaultValue="all">
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="one-time">One-time</SelectItem>
                  <SelectItem value="recurring">Recurring</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>Ref</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    Loading payments...
                  </TableCell>
                </TableRow>
              ) : filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-24 text-center">
                    No payments found
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{payments.indexOf(payment) + 1}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {payment.payment_reference || payment.id.substring(0, 8).toUpperCase()}
                    </TableCell>
                    <TableCell className="font-medium">
                      {payment.title}
                      {/* Description tooltip could go here */}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {payment.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{payment.issuer_name || "-"}</span>
                        <span className="text-muted-foreground text-xs">{payment.issuer_phone_number}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{formatCurrency(payment.amount, payment.currency)}</div>
                      {payment.amountDue > 0 && payment.status === "overdue" && (
                        <div className="text-xs font-bold text-red-500">
                          Due: {formatCurrency(payment.amountDue, payment.currency)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant="outline" className="w-fit capitalize">
                          {payment.payment_type}
                        </Badge>
                        {payment.payment_type === "recurring" && (
                          <span className="text-muted-foreground text-xs capitalize">{payment.recurrence_period}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {payment.payment_type === "recurring"
                        ? payment.next_payment_due
                          ? format(parseISO(payment.next_payment_due), "MMM d, yyyy")
                          : "-"
                        : payment.payment_date
                          ? format(parseISO(payment.payment_date), "MMM d, yyyy")
                          : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" className="h-8 w-8 p-0">
                            <span className="sr-only">Open menu</span>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          {/* Everyone can view */}
                          <DropdownMenuItem onClick={() => router.push(`/admin/payments/${payment.id}`)}>
                            View Details
                          </DropdownMenuItem>

                          {canManagePayment(payment) && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleEdit(payment)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDelete(payment.id)} className="text-red-600">
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) resetForm()
        }}
      >
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Payment" : "Create New Payment"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Edit payment details"
                : `Add a new payment for ${currentUser?.department_id ? departments.find((d) => d.id === currentUser.department_id)?.name : "your department"}`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Type</Label>
                  <Select
                    value={formData.payment_type}
                    onValueChange={(val: any) => setFormData({ ...formData, payment_type: val })}
                    disabled={!!editingId} // Usually disable type change on edit to avoid complex logic
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time Payment</SelectItem>
                      <SelectItem value="recurring">Recurring (Subscription)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title/Description</Label>
                <Input
                  placeholder="e.g. Monthly Internet Subscription"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={(val) => setFormData({ ...formData, currency: val })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NGN">NGN (₦)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.payment_type === "recurring" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Recurrence Period</Label>
                    <Select
                      value={formData.recurrence_period}
                      onValueChange={(val) => setFormData({ ...formData, recurrence_period: val })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>First Due Date</Label>
                    <Input
                      type="date"
                      value={formData.next_payment_due}
                      onChange={(e) => setFormData({ ...formData, next_payment_due: e.target.value })}
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Payment Date</Label>
                  <Input
                    type="date"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                    required
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Issuer Name</Label>
                  <Input
                    value={formData.issuer_name}
                    onChange={(e) => setFormData({ ...formData, issuer_name: e.target.value })}
                    placeholder="e.g. Starlink Nigeria"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Issuer Phone</Label>
                  <Input
                    value={formData.issuer_phone_number}
                    onChange={(e) => setFormData({ ...formData, issuer_phone_number: e.target.value })}
                    placeholder="e.g. +234..."
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Audit/Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Optional notes..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalOpen(false)
                  resetForm()
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting
                  ? editingId
                    ? "Updating..."
                    : "Creating..."
                  : editingId
                    ? "Update Payment"
                    : "Create Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
