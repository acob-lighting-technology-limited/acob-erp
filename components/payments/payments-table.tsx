"use client"

import { useEffect, useState } from "react"
import { logger } from "@/lib/logger"

const log = logger("payments-table")
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { QUERY_KEYS } from "@/lib/query-keys"
import { useRouter } from "next/navigation"
import { Plus, Search, Download, CreditCard, Eye, FileSpreadsheet, FileIcon, Printer, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { format, parseISO, isValid, differenceInDays, isBefore, startOfDay } from "date-fns"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createClient } from "@/lib/supabase/client"
import { AdminTablePage } from "@/components/admin/admin-table-page"
import { CreatePaymentDialog } from "./create-payment-dialog"
import { ExportColumnsDialog } from "./export-columns-dialog"
import { ReceiptSelectionDialog } from "./receipt-selection-dialog"
import { PaymentStatsCards } from "./payment-stats-cards"
import { usePaymentExport } from "./use-payment-export"
import type { CreatePaymentFormData } from "./create-payment-dialog"

// Types
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
  issuer_name?: string
  issuer_phone_number?: string
  issuer_address?: string
  payment_reference?: string
  amount_paid?: number
  created_at: string
  department?: {
    name: string
  }
  documents?: {
    id: string
    document_type: string
    file_path: string
    file_name?: string
    applicable_date?: string
    created_at?: string
  }[]
}

interface Department {
  id: string
  name: string
}

interface Category {
  id: string
  name: string
}

interface PaymentsTableData {
  payments: Payment[]
  departments: Department[]
  categories: Category[]
}

async function fetchPaymentsTableData(): Promise<PaymentsTableData> {
  const [paymentsRes, deptRes, catRes] = await Promise.all([
    fetch("/api/payments"),
    fetch("/api/departments"),
    fetch("/api/payments/categories"),
  ])

  if (!paymentsRes.ok) {
    const data = await paymentsRes.json().catch(() => ({}))
    throw new Error(data?.error ?? "Failed to fetch payments")
  }

  const paymentsJson = await paymentsRes.json()
  const departments: Department[] = deptRes.ok ? ((await deptRes.json()).data ?? []) : []
  const categories: Category[] = catRes.ok ? ((await catRes.json()).data ?? []) : []

  return {
    payments: paymentsJson.data ?? [],
    departments,
    categories,
  }
}

interface PaymentsTableProps {
  initialPayments?: Payment[]
  initialDepartments?: Department[]
  initialCategories?: Category[]
  initialError?: string | null
  currentUser: {
    id: string
    department_id: string | null
    isAdmin: boolean
  }
  /** Base path for detail pages - default "/admin/payments" for admin, "/payments" for users */
  basePath?: string
}

export function PaymentsTable({
  initialPayments = [],
  initialDepartments = [],
  initialCategories = [],
  initialError = null,
  currentUser,
  basePath = currentUser.isAdmin ? "/admin/payments" : "/payments",
}: PaymentsTableProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: tableData, isLoading: loading } = useQuery({
    queryKey: QUERY_KEYS.paymentsTable(),
    queryFn: fetchPaymentsTableData,
    initialData:
      initialPayments.length > 0 || initialDepartments.length > 0 || initialCategories.length > 0
        ? { payments: initialPayments, departments: initialDepartments, categories: initialCategories }
        : undefined,
  })

  const payments = tableData?.payments ?? []
  const departments = tableData?.departments ?? []

  // Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [categoryFilter, setCategoryFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" }>({
    key: "date",
    direction: "asc",
  })

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)

  // Receipt Selection Dialog
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false)
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null)

  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [exportType, setExportType] = useState<"excel" | "pdf" | null>(null)
  const [selectedColumns, setSelectedColumns] = useState<Record<string, boolean>>({
    "#": true,
    Category: true,
    Title: true,
    Issuer: true,
    Department: true,
    Amount: true,
    "Amount Due": true,
    Currency: true,
    Type: true,
    Status: true,
    "First Payment Date": true,
    "Number of Payments": true,
    "Next Due Date": true,
    Recurrence: false,
    Reference: true,
  })

  const [formData, setFormData] = useState<CreatePaymentFormData>({
    department_id: currentUser.department_id || "",
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
  })

  useEffect(() => {
    if (initialError) {
      toast.error(initialError)
    }
  }, [initialError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      if (
        !formData.department_id ||
        !formData.category ||
        !formData.amount ||
        !formData.title ||
        !formData.issuer_name ||
        !formData.issuer_phone_number
      ) {
        toast.error("Please fill in all required fields (including Issuer Name & Phone)")
        setSubmitting(false)
        return
      }

      if (formData.category === "recurring" && (!formData.recurrence_period || !formData.next_payment_due)) {
        toast.error("Recurring payments require a period and start date")
        setSubmitting(false)
        return
      }

      if (formData.category === "one-time" && !formData.payment_date) {
        toast.error("One-time payments require a payment date")
        setSubmitting(false)
        return
      }

      if (formData.category === "one-time" && !receiptFile) {
        toast.error("One-time payments require a receipt to be uploaded")
        setSubmitting(false)
        return
      }

      const response = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      })

      if (response.ok) {
        const data = await response.json()
        const paymentId = data.data.id

        if (formData.category === "one-time" && receiptFile) {
          const formDataUpload = new FormData()
          formDataUpload.append("file", receiptFile)
          formDataUpload.append("payment_id", paymentId)
          formDataUpload.append("document_type", "receipt")
          formDataUpload.append("applicable_date", formData.payment_date)

          const uploadResponse = await fetch("/api/payments/documents", {
            method: "POST",
            body: formDataUpload,
          })

          if (!uploadResponse.ok) {
            toast.warning("Payment created, but receipt upload failed. You can upload it later.")
          }
        }

        toast.success("Payment created successfully")
        setIsModalOpen(false)
        setReceiptFile(null)
        setFormData({
          department_id: currentUser.department_id || "",
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
        })
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.paymentsTable() })
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to create payment")
      }
    } catch {
      toast.error("Error creating payment")
    } finally {
      setSubmitting(false)
    }
  }

  // Compute dynamic status based on due dates
  const getRealStatus = (p: Payment): "due" | "paid" | "overdue" | "cancelled" => {
    if (p.payment_type === "one-time") return "paid"
    if (p.status === "paid" || p.status === "cancelled") return p.status

    const dateStr = p.payment_type === "recurring" ? p.next_payment_due : p.payment_date
    if (!dateStr) return "due"

    const date = parseISO(dateStr)
    if (!isValid(date)) return "due"

    const today = startOfDay(new Date())
    const daysDiff = differenceInDays(date, today)

    if (isBefore(date, today)) return "overdue"
    if (daysDiff <= 7) return "due"
    return "paid"
  }

  const getAmountDue = (p: Payment) => {
    const status = getRealStatus(p)
    if (status === "paid" || status === "cancelled") return 0
    if (status === "due") return p.amount

    if (status === "overdue") {
      if (p.payment_type === "recurring" && p.next_payment_due && p.recurrence_period) {
        const dueDate = parseISO(p.next_payment_due)
        if (!isValid(dueDate)) return p.amount

        const today = startOfDay(new Date())
        const daysPastDue = Math.abs(differenceInDays(today, dueDate))

        let periodsOverdue = 1
        if (p.recurrence_period === "monthly") periodsOverdue = Math.floor(daysPastDue / 30) + 1
        else if (p.recurrence_period === "quarterly") periodsOverdue = Math.floor(daysPastDue / 90) + 1
        else if (p.recurrence_period === "yearly") periodsOverdue = Math.floor(daysPastDue / 365) + 1

        return p.amount * periodsOverdue
      }
      return p.amount
    }

    return 0
  }

  const processedPayments = payments.map((p) => ({
    ...p,
    status: getRealStatus(p),
    amountDue: getAmountDue(p),
  }))

  const stats = {
    totalDue: processedPayments
      .filter((p) => {
        if (p.status === "overdue") return true
        if (p.status === "due") {
          const dateStr = p.payment_type === "recurring" ? p.next_payment_due : p.payment_date
          if (!dateStr) return true
          return differenceInDays(parseISO(dateStr), new Date()) <= 7
        }
        return false
      })
      .reduce((sum, p) => sum + p.amount, 0),
    totalPaid: processedPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0),
    countCompleted: processedPayments.filter((p) => p.status === "paid" || (p.amount_paid && p.amount_paid > 0)).length,
    countOverdue: processedPayments.filter((p) => p.status === "overdue").length,
    countDue: processedPayments.filter((p) => p.status === "due").length,
  }

  const filteredPayments = processedPayments.filter((payment) => {
    const matchesSearch =
      payment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.department?.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.issuer_name || "").toLowerCase().includes(searchQuery.toLowerCase())

    const matchesDepartment = departmentFilter === "all" || payment.department_id === departmentFilter
    const matchesType = categoryFilter === "all" || payment.payment_type === categoryFilter
    const matchesStatus = statusFilter === "all" || payment.status === statusFilter

    return matchesSearch && matchesDepartment && matchesType && matchesStatus
  })

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sortedPayments = [...filteredPayments].sort((a, b) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let valA: any = a
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let valB: any = b

    if (sortConfig.key === "category") {
      valA = a.payment_type
      valB = b.payment_type

      if (valA !== valB) {
        return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      const dateStrA = a.payment_type === "recurring" ? a.next_payment_due : a.payment_date
      const dateStrB = b.payment_type === "recurring" ? b.next_payment_due : b.payment_date

      if (!dateStrA && !dateStrB) return 0
      if (!dateStrA) return 1
      if (!dateStrB) return -1

      return new Date(dateStrA).getTime() - new Date(dateStrB).getTime()
    } else if (sortConfig.key === "date") {
      const dateStrA = a.payment_type === "recurring" ? a.next_payment_due : a.payment_date
      const dateStrB = b.payment_type === "recurring" ? b.next_payment_due : b.payment_date

      if (!dateStrA && !dateStrB) return 0
      if (!dateStrA) return 1
      if (!dateStrB) return -1

      valA = new Date(dateStrA).getTime()
      valB = new Date(dateStrB).getTime()
    } else {
      const statusPriority: Record<string, number> = { overdue: 0, due: 1, paid: 2, cancelled: 3 }
      const statusDiff = statusPriority[a.status] - statusPriority[b.status]
      if (statusDiff !== 0) return statusDiff

      const dateStrA = a.payment_type === "recurring" ? a.next_payment_due : a.payment_date
      const dateStrB = b.payment_type === "recurring" ? b.next_payment_due : b.payment_date

      if (!dateStrA && !dateStrB) return 0
      if (!dateStrA) return 1
      if (!dateStrB) return -1

      valA = new Date(dateStrA).getTime()
      valB = new Date(dateStrB).getTime()
    }

    if (valA < valB) return sortConfig.direction === "asc" ? -1 : 1
    if (valA > valB) return sortConfig.direction === "asc" ? 1 : -1
    return 0
  })

  const { handleExportConfirm } = usePaymentExport(sortedPayments, selectedColumns, () => setExportDialogOpen(false))

  const downloadFile = async (url: string, filename: string) => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error("Failed to fetch file")

      const blob = await response.blob()
      const blobUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = blobUrl
      link.download = filename
      link.style.display = "none"
      document.body.appendChild(link)
      link.click()

      setTimeout(() => {
        document.body.removeChild(link)
        window.URL.revokeObjectURL(blobUrl)
      }, 100)
    } catch (error: unknown) {
      log.error("Error downloading file:", error)
      throw error
    }
  }

  const handlePrintDocument = async (payment: Payment, type: "invoice" | "receipt") => {
    if (type === "receipt") {
      const receipts = payment.documents?.filter((d) => d.document_type === "receipt") || []
      if (receipts.length > 1) {
        setSelectedPaymentForReceipt(payment)
        setReceiptDialogOpen(true)
        return
      } else if (receipts.length === 1) {
        try {
          const supabase = createClient()
          const { data } = await supabase.storage.from("payment_documents").createSignedUrl(receipts[0].file_path, 3600)
          if (data?.signedUrl) {
            const filename =
              receipts[0].file_name || `receipt_${payment.payment_reference || payment.id.substring(0, 8)}.pdf`
            await downloadFile(data.signedUrl, filename)
            toast.success("Receipt downloaded successfully")
          } else {
            toast.error("Could not get document URL")
          }
        } catch {
          toast.error("Error downloading document")
        }
        return
      }
    }

    const doc = payment.documents?.find((d) => d.document_type === type)
    if (doc) {
      try {
        const supabase = createClient()
        const { data } = await supabase.storage.from("payment_documents").createSignedUrl(doc.file_path, 3600)
        if (data?.signedUrl) {
          const filename = doc.file_name || `${type}_${payment.payment_reference || payment.id.substring(0, 8)}.pdf`
          await downloadFile(data.signedUrl, filename)
          toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} downloaded successfully`)
        } else {
          toast.error("Could not get document URL")
        }
      } catch {
        toast.error("Error downloading document")
      }
    }
  }

  const handleViewReceipt = async (receiptPath: string) => {
    try {
      const supabase = createClient()
      const { data } = await supabase.storage.from("payment_documents").createSignedUrl(receiptPath, 3600)
      if (data?.signedUrl) {
        setReceiptDialogOpen(false)
        const filename = receiptPath.split("/").pop() || "receipt.pdf"
        await new Promise((resolve) => setTimeout(resolve, 100))
        await downloadFile(data.signedUrl, filename)
        toast.success("Receipt downloaded successfully")
      } else {
        toast.error("Could not get document URL")
      }
    } catch {
      toast.error("Error downloading document")
    }
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
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount)
  }

  const filterableDepartments = currentUser.isAdmin
    ? departments
    : departments.filter((d) => d.id === currentUser.department_id)

  const isAdminPath = basePath.startsWith("/admin")
  const backLinkHref = isAdminPath ? "/admin" : "/profile"
  const backLinkLabel = isAdminPath ? "Back to Admin" : "Back to Dashboard"

  return (
    <AdminTablePage
      title="Payments"
      description="Manage and track department payments and recurring subscriptions."
      icon={CreditCard}
      backLinkHref={backLinkHref}
      backLinkLabel={backLinkLabel}
      actions={
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 sm:flex-none" size="sm">
                <Download className="mr-2 h-4 w-4" />
                <span className="text-xs sm:text-sm">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Export Options</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => {
                  setExportType("excel")
                  setExportDialogOpen(true)
                }}
              >
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setExportType("pdf")
                  setExportDialogOpen(true)
                }}
              >
                <FileIcon className="mr-2 h-4 w-4" /> PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => setIsModalOpen(true)} className="flex-1 sm:flex-none" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            <span className="text-xs sm:text-sm">New Payment</span>
          </Button>
        </div>
      }
      stats={<PaymentStatsCards stats={stats} formatCurrency={formatCurrency} />}
      filters={
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="relative flex-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2.5 h-4 w-4" />
            <Input
              placeholder="Search payments..."
              className="pl-9 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            {currentUser.isAdmin && (
              <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                <SelectTrigger className="flex-1 sm:w-[180px]">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {filterableDepartments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="flex-1 sm:w-[180px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="one-time">One-time</SelectItem>
                <SelectItem value="recurring">Recurring</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="flex-1 sm:w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="due">Due</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted h-40 animate-pulse rounded-lg border" />
          ))}
        </div>
      ) : sortedPayments.length === 0 ? (
        <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed text-center">
          <CreditCard className="text-muted-foreground mb-4 h-12 w-12" />
          <h3 className="text-lg font-semibold">No payments found</h3>
          <p className="text-muted-foreground mb-4 text-sm">Get started by creating your first payment record.</p>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Payment
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table className="[&_td]:py-2 [&_th]:py-2">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">S/N</TableHead>
                <TableHead className="hover:bg-muted/50 cursor-pointer" onClick={() => handleSort("category")}>
                  <div className="flex items-center gap-1">
                    Category
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Issuer</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Amount Due</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hover:bg-muted/50 cursor-pointer" onClick={() => handleSort("date")}>
                  <div className="flex items-center gap-1">
                    Date / Next Due
                    <ArrowUpDown className="h-4 w-4" />
                  </div>
                </TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedPayments.map((payment, index) => (
                <TableRow
                  key={payment.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`${basePath}/${payment.id}`)}
                >
                  <TableCell className="text-muted-foreground font-medium">{index + 1}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        payment.payment_type === "recurring"
                          ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "border-green-300 bg-green-50 text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                      }
                    >
                      {payment.payment_type === "recurring" ? "Recurring" : "One-time"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium">{payment.title}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">{payment.issuer_name || "N/A"}</span>
                      <span className="text-muted-foreground text-xs">{payment.issuer_phone_number || ""}</span>
                    </div>
                  </TableCell>
                  <TableCell>{payment.department?.name || "Unknown"}</TableCell>
                  <TableCell>{formatCurrency(payment.amount, payment.currency)}</TableCell>
                  <TableCell>
                    <span
                      className={
                        payment.status === "overdue"
                          ? "font-semibold text-red-600"
                          : payment.status === "due"
                            ? "font-semibold text-yellow-600"
                            : "text-muted-foreground"
                      }
                    >
                      {formatCurrency(payment.amountDue, payment.currency)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(payment.status)} variant="outline">
                      {payment.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {payment.payment_type === "recurring" ? (
                      <span className={payment.status === "overdue" ? "font-medium text-red-500" : ""}>
                        {payment.next_payment_due ? format(parseISO(payment.next_payment_due), "MMM d, yyyy") : "N/A"}
                      </span>
                    ) : (
                      <span>
                        {payment.payment_date ? format(parseISO(payment.payment_date), "MMM d, yyyy") : "N/A"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Print payment"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuLabel>Print Options</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={!payment.documents?.some((d) => d.document_type === "invoice")}
                            onClick={() => handlePrintDocument(payment, "invoice")}
                          >
                            Print Invoice
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={!payment.documents?.some((d) => d.document_type === "receipt")}
                            onClick={() => handlePrintDocument(payment, "receipt")}
                          >
                            Print Receipt
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="View payment details"
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`${basePath}/${payment.id}`)
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreatePaymentDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        formData={formData}
        onFormDataChange={setFormData}
        onSubmit={handleSubmit}
        submitting={submitting}
        receiptFile={receiptFile}
        onReceiptFileChange={setReceiptFile}
        departments={departments}
        filterableDepartments={filterableDepartments}
        isAdmin={currentUser.isAdmin}
      />

      <ReceiptSelectionDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        payment={selectedPaymentForReceipt}
        onSelectReceipt={handleViewReceipt}
      />

      <ExportColumnsDialog
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        exportType={exportType}
        selectedColumns={selectedColumns}
        onColumnChange={setSelectedColumns}
        onConfirm={() => exportType && handleExportConfirm(exportType)}
      />
    </AdminTablePage>
  )
}
