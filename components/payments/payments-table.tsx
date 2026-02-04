"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Download,
  CreditCard,
  MoreVertical,
  Eye,
  Building2,
  Calendar,
  Phone,
  MapPin,
  ArrowUpDown,
  FileSpreadsheet,
  FileIcon,
  Printer,
  CheckCircle,
  Receipt,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"
import { AdminTablePage } from "@/components/admin/admin-table-page"

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

interface FormData {
  department_id: string
  category: "one-time" | "recurring" | ""
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
}

interface PaymentsTableProps {
  initialPayments?: Payment[]
  initialDepartments?: Department[]
  initialCategories?: Category[]
  currentUser: {
    id: string
    department_id: string | null
    is_admin: boolean
  }
  /** Base path for detail pages - default "/admin/payments" for admin, "/payments" for users */
  basePath?: string
}

export function PaymentsTable({
  initialPayments = [],
  initialDepartments = [],
  initialCategories = [],
  currentUser,
  basePath = currentUser.is_admin ? "/admin/payments" : "/payments",
}: PaymentsTableProps) {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>(initialPayments)
  const [departments, setDepartments] = useState<Department[]>(initialDepartments)
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [loading, setLoading] = useState(initialPayments.length === 0)

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

  const [formData, setFormData] = useState<FormData>({
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
    if (initialPayments.length === 0) {
      fetchData()
    }
    if (initialDepartments.length === 0 || initialCategories.length === 0) {
      fetchAuxData()
    }
  }, [])

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
        fetchData()
      } else {
        const data = await response.json()
        toast.error(data.error || "Failed to create payment")
      }
    } catch (error) {
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

  // Calculate amount due for a payment
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
        if (p.recurrence_period === "monthly") {
          periodsOverdue = Math.floor(daysPastDue / 30) + 1
        } else if (p.recurrence_period === "quarterly") {
          periodsOverdue = Math.floor(daysPastDue / 90) + 1
        } else if (p.recurrence_period === "yearly") {
          periodsOverdue = Math.floor(daysPastDue / 365) + 1
        }

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

  // Calculate Stats
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

  // Filter Logic
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

  // Sorting Logic
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc"
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc"
    }
    setSortConfig({ key, direction })
  }

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    // If user hasn't clicked any sort column yet (default sort), use status priority
    // Otherwise, respect the user's explicit sort choice

    let valA: any = a
    let valB: any = b

    if (sortConfig.key === "category") {
      // Sort by payment_type (one-time vs recurring), then by date within each type
      valA = a.payment_type
      valB = b.payment_type

      if (valA !== valB) {
        // one-time comes before recurring alphabetically
        return sortConfig.direction === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA)
      }

      // Within same type, sort by date (always closest first)
      const dateStrA = a.payment_type === "recurring" ? a.next_payment_due : a.payment_date
      const dateStrB = b.payment_type === "recurring" ? b.next_payment_due : b.payment_date

      if (!dateStrA && !dateStrB) return 0
      if (!dateStrA) return 1
      if (!dateStrB) return -1

      const dateA = new Date(dateStrA).getTime()
      const dateB = new Date(dateStrB).getTime()
      return dateA - dateB // Always ascending (closest dates first)
    } else if (sortConfig.key === "date") {
      // Pure date sort - no status override
      const dateStrA = a.payment_type === "recurring" ? a.next_payment_due : a.payment_date
      const dateStrB = b.payment_type === "recurring" ? b.next_payment_due : b.payment_date

      if (!dateStrA && !dateStrB) return 0
      if (!dateStrA) return 1
      if (!dateStrB) return -1

      valA = new Date(dateStrA).getTime()
      valB = new Date(dateStrB).getTime()
    } else {
      // Default sort: status priority first, then date
      const statusPriority: Record<string, number> = {
        overdue: 0,
        due: 1,
        paid: 2,
        cancelled: 3,
      }

      const statusDiff = statusPriority[a.status] - statusPriority[b.status]
      if (statusDiff !== 0) return statusDiff

      // Within same status, sort by date
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

  // Export helpers
  const formatDateForExport = (dateStr: string | undefined) => {
    if (!dateStr) return "-"
    const date = parseISO(dateStr)
    if (!isValid(date)) return "-"
    return format(date, "dd-MM-yyyy")
  }

  const getExportData = (payments: typeof sortedPayments) => {
    return payments.map((p, index) => {
      const row: Record<string, any> = {}
      const receipts = p.documents?.filter((d) => d.document_type === "receipt" && d.applicable_date) || []

      let firstPaymentDate = "-"
      let numberOfPayments = 0

      if (receipts.length > 0) {
        const sortedReceipts = [...receipts].sort((a, b) => {
          const dateA = a.applicable_date ? new Date(a.applicable_date).getTime() : 0
          const dateB = b.applicable_date ? new Date(b.applicable_date).getTime() : 0
          return dateA - dateB
        })
        firstPaymentDate = formatDateForExport(sortedReceipts[0].applicable_date)
        numberOfPayments = receipts.length
      }

      if (selectedColumns["#"]) row["#"] = index + 1
      if (selectedColumns["Category"]) row["Category"] = p.category || "-"
      if (selectedColumns["Title"]) row["Title"] = p.title
      if (selectedColumns["Issuer"]) row["Issuer"] = p.issuer_name || "-"
      if (selectedColumns["Department"]) row["Department"] = p.department?.name || "-"
      if (selectedColumns["Amount"]) row["Amount"] = p.amount
      if (selectedColumns["Amount Due"]) row["Amount Due"] = p.amountDue
      if (selectedColumns["Currency"]) row["Currency"] = p.currency
      if (selectedColumns["Type"]) row["Type"] = p.payment_type
      if (selectedColumns["Status"]) row["Status"] = p.status
      if (selectedColumns["First Payment Date"]) row["First Payment Date"] = firstPaymentDate
      if (selectedColumns["Number of Payments"]) row["Number of Payments"] = numberOfPayments
      if (selectedColumns["Next Due Date"]) {
        const nextDueDate = p.payment_type === "recurring" ? p.next_payment_due : p.payment_date
        row["Next Due Date"] = formatDateForExport(nextDueDate)
      }
      if (selectedColumns["Recurrence"]) row["Recurrence"] = p.recurrence_period || "-"
      if (selectedColumns["Reference"]) row["Reference"] = p.payment_reference || p.id.substring(0, 8)

      return row
    })
  }

  const handleExportClick = (type: "excel" | "pdf") => {
    setExportType(type)
    setExportDialogOpen(true)
  }

  const exportToExcel = async () => {
    try {
      const dataToExport = getExportData(sortedPayments)
      const ws = XLSX.utils.json_to_sheet(dataToExport)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Payments")

      const maxWidth = 50
      const cols = Object.keys(dataToExport[0] || {}).map((key) => ({
        wch: Math.min(
          Math.max(key.length, ...dataToExport.map((row) => String(row[key as keyof typeof row]).length)),
          maxWidth
        ),
      }))
      ws["!cols"] = cols

      XLSX.writeFile(wb, `payments-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`)
      toast.success("Payments exported to Excel successfully")
      setExportDialogOpen(false)
    } catch (error: any) {
      console.error("Error exporting to Excel:", error)
      toast.error("Failed to export to Excel")
    }
  }

  const exportToPDF = async () => {
    try {
      const doc = new jsPDF({ orientation: "landscape" })
      doc.setFontSize(16)
      doc.text("Payments Report", 14, 15)
      doc.setFontSize(10)
      doc.text(`Generated on: ${format(new Date(), "dd-MM-yyyy")}`, 14, 22)
      doc.text(`Total Payments: ${sortedPayments.length}`, 14, 28)

      const headers: string[] = []
      if (selectedColumns["#"]) headers.push("#")
      if (selectedColumns["Category"]) headers.push("Category")
      if (selectedColumns["Title"]) headers.push("Title")
      if (selectedColumns["Issuer"]) headers.push("Issuer")
      if (selectedColumns["Department"]) headers.push("Department")
      if (selectedColumns["Amount"]) headers.push("Amount")
      if (selectedColumns["Amount Due"]) headers.push("Amount Due")
      if (selectedColumns["Currency"]) headers.push("Currency")
      if (selectedColumns["Type"]) headers.push("Type")
      if (selectedColumns["Status"]) headers.push("Status")
      if (selectedColumns["First Payment Date"]) headers.push("First Payment")
      if (selectedColumns["Number of Payments"]) headers.push("# Payments")
      if (selectedColumns["Next Due Date"]) headers.push("Next Due")
      if (selectedColumns["Recurrence"]) headers.push("Recurrence")
      if (selectedColumns["Reference"]) headers.push("Ref")

      const dataToExport = getExportData(sortedPayments)
      const body = dataToExport.map((row) => {
        const rowData: any[] = []
        if (selectedColumns["#"]) rowData.push(row["#"])
        if (selectedColumns["Category"]) rowData.push(row["Category"])
        if (selectedColumns["Title"]) rowData.push(row["Title"])
        if (selectedColumns["Issuer"]) rowData.push(row["Issuer"])
        if (selectedColumns["Department"]) rowData.push(row["Department"])
        if (selectedColumns["Amount"]) rowData.push(`${row["Currency"]} ${row["Amount"].toLocaleString()}`)
        if (selectedColumns["Amount Due"]) rowData.push(`${row["Currency"]} ${row["Amount Due"].toLocaleString()}`)
        if (selectedColumns["Currency"]) rowData.push(row["Currency"])
        if (selectedColumns["Type"]) rowData.push(row["Type"])
        if (selectedColumns["Status"]) rowData.push(row["Status"])
        if (selectedColumns["First Payment Date"]) rowData.push(row["First Payment Date"])
        if (selectedColumns["Number of Payments"]) rowData.push(row["Number of Payments"])
        if (selectedColumns["Next Due Date"]) rowData.push(row["Next Due Date"])
        if (selectedColumns["Recurrence"]) rowData.push(row["Recurrence"])
        if (selectedColumns["Reference"]) rowData.push(row["Reference"])
        return rowData
      })

      autoTable(doc, {
        head: [headers],
        body: body,
        startY: 35,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 247, 250] },
      })

      doc.save(`payments-export-${format(new Date(), "yyyy-MM-dd")}.pdf`)
      toast.success("Payments exported to PDF successfully")
      setExportDialogOpen(false)
    } catch (error: any) {
      console.error("Error exporting to PDF:", error)
      toast.error("Failed to export to PDF")
    }
  }

  const handleExportConfirm = async () => {
    if (exportType === "excel") await exportToExcel()
    else if (exportType === "pdf") await exportToPDF()
  }

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
    } catch (error) {
      console.error("Error downloading file:", error)
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
          const { data, error } = await supabase.storage
            .from("payment_documents")
            .createSignedUrl(receipts[0].file_path, 3600)
          if (data?.signedUrl) {
            const filename =
              receipts[0].file_name || `receipt_${payment.payment_reference || payment.id.substring(0, 8)}.pdf`
            await downloadFile(data.signedUrl, filename)
            toast.success("Receipt downloaded successfully")
          } else {
            toast.error("Could not get document URL")
          }
        } catch (error) {
          toast.error("Error downloading document")
        }
        return
      }
    }

    const doc = payment.documents?.find((d) => d.document_type === type)
    if (doc) {
      try {
        const supabase = createClient()
        const { data, error } = await supabase.storage.from("payment_documents").createSignedUrl(doc.file_path, 3600)
        if (data?.signedUrl) {
          const filename = doc.file_name || `${type}_${payment.payment_reference || payment.id.substring(0, 8)}.pdf`
          await downloadFile(data.signedUrl, filename)
          toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} downloaded successfully`)
        } else {
          toast.error("Could not get document URL")
        }
      } catch (error) {
        toast.error("Error downloading document")
      }
    }
  }

  const handleViewReceipt = async (receiptPath: string) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage.from("payment_documents").createSignedUrl(receiptPath, 3600)
      if (data?.signedUrl) {
        setReceiptDialogOpen(false)
        const filename = receiptPath.split("/").pop() || "receipt.pdf"
        await new Promise((resolve) => setTimeout(resolve, 100))
        await downloadFile(data.signedUrl, filename)
        toast.success("Receipt downloaded successfully")
      } else {
        toast.error("Could not get document URL")
      }
    } catch (error) {
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
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency,
    }).format(amount)
  }

  // Get departments list for filter (if admin, show all; otherwise just user's dept)
  const filterableDepartments = currentUser.is_admin
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
              <DropdownMenuItem onClick={() => handleExportClick("excel")}>
                <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportClick("pdf")}>
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
      stats={
        <div className="grid grid-cols-6 gap-2 md:gap-3 lg:grid-cols-5">
          <Card className="col-span-6 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <CardTitle className="text-[10px] font-medium md:text-sm">Total Outstanding</CardTitle>
              <CreditCard className="text-muted-foreground h-3.5 w-3.5" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-base font-bold md:text-2xl">{formatCurrency(stats.totalDue, "NGN")}</div>
              <p className="text-muted-foreground text-[9px] md:text-xs">Overdue + Up Next (7 days)</p>
            </CardContent>
          </Card>
          <Card className="col-span-6 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <CardTitle className="text-[10px] font-medium md:text-sm">Total Paid</CardTitle>
              <Building2 className="text-muted-foreground h-3.5 w-3.5" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-base font-bold md:text-2xl">{formatCurrency(stats.totalPaid, "NGN")}</div>
              <p className="text-muted-foreground text-[9px] md:text-xs">Lifetime collected</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <CardTitle className="text-[10px] font-medium md:text-sm">Completed</CardTitle>
              <CheckCircle className="h-3.5 w-3.5 text-green-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-base font-bold text-green-600 md:text-2xl">{stats.countCompleted}</div>
              <p className="text-muted-foreground text-[9px] md:text-xs">Paid Items & History</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <CardTitle className="text-[10px] font-medium md:text-sm">Overdue Payments</CardTitle>
              <CreditCard className="h-3.5 w-3.5 text-red-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-base font-bold text-red-600 md:text-2xl">{stats.countOverdue}</div>
              <p className="text-muted-foreground text-[9px] md:text-xs">Requires immediate attention</p>
            </CardContent>
          </Card>
          <Card className="col-span-2 lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 pb-2">
              <CardTitle className="text-[10px] font-medium md:text-sm">Due Payments</CardTitle>
              <Calendar className="h-3.5 w-3.5 text-yellow-500" />
            </CardHeader>
            <CardContent className="p-3 pt-0">
              <div className="text-base font-bold text-yellow-600 md:text-2xl">{stats.countDue}</div>
              <p className="text-muted-foreground text-[9px] md:text-xs">Due within 7 days</p>
            </CardContent>
          </Card>
        </div>
      }
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
            {currentUser.is_admin && (
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
                          <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
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

      {/* Create Payment Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Payment</DialogTitle>
            <DialogDescription>Create a new payment record. Issuer Name and Phone are required.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Select
                  value={formData.department_id}
                  onValueChange={(value) => setFormData({ ...formData, department_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Department" />
                  </SelectTrigger>
                  <SelectContent>
                    {(currentUser.is_admin ? departments : filterableDepartments).map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: "one-time" | "recurring") => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one-time">One-time</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Payment Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Office Rent 2024"
                required
              />
            </div>

            {/* Issuer Details */}
            <div className="bg-muted/20 mt-2 grid grid-cols-2 gap-4 rounded-md border p-3">
              <div className="text-muted-foreground col-span-2 mb-1 text-sm font-semibold">Issuer Details</div>
              <div className="space-y-2">
                <Label htmlFor="issuer_name">Issuer Name *</Label>
                <div className="relative">
                  <Building2 className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                  <Input
                    id="issuer_name"
                    className="pl-9"
                    value={formData.issuer_name}
                    onChange={(e) => setFormData({ ...formData, issuer_name: e.target.value })}
                    placeholder="Company or Person Name"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuer_phone">Issuer Phone *</Label>
                <div className="relative">
                  <Phone className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                  <Input
                    id="issuer_phone"
                    className="pl-9"
                    value={formData.issuer_phone_number}
                    onChange={(e) => setFormData({ ...formData, issuer_phone_number: e.target.value })}
                    placeholder="+234..."
                    required
                  />
                </div>
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="issuer_address">Issuer Address</Label>
                <div className="relative">
                  <MapPin className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                  <Input
                    id="issuer_address"
                    className="pl-9"
                    value={formData.issuer_address}
                    onChange={(e) => setFormData({ ...formData, issuer_address: e.target.value })}
                    placeholder="Address (Optional)"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <div className="relative">
                  <span className="text-muted-foreground absolute top-2.5 left-3 font-semibold">₦</span>
                  <Input
                    id="amount"
                    type="number"
                    className="pl-8"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NGN">NGN (₦)</SelectItem>
                    <SelectItem value="USD">USD ($)</SelectItem>
                    <SelectItem value="EUR">EUR (€)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.category === "recurring" ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="period">Recurrence Period</Label>
                  <Select
                    value={formData.recurrence_period}
                    onValueChange={(value) => setFormData({ ...formData, recurrence_period: value })}
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
                  <Label htmlFor="start_date">Next Payment Due</Label>
                  <div className="relative">
                    <Calendar className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                    <Input
                      id="start_date"
                      type="date"
                      className="pl-9"
                      value={formData.next_payment_due}
                      onChange={(e) => setFormData({ ...formData, next_payment_due: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="payment_date">Payment Date</Label>
                <div className="relative">
                  <Calendar className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                  <Input
                    id="payment_date"
                    type="date"
                    className="pl-9"
                    value={formData.payment_date}
                    onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Receipt Upload for One-Time Payments */}
            {formData.category === "one-time" && (
              <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                <div className="space-y-2">
                  <Label htmlFor="receipt" className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-green-600" />
                    Payment Receipt *
                  </Label>
                  <p className="text-muted-foreground mb-2 text-sm">
                    Since this is a one-time payment, please upload the payment receipt as proof of payment.
                  </p>
                  <Input
                    id="receipt"
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                    className="cursor-pointer"
                  />
                  {receiptFile && (
                    <p className="text-sm text-green-600 dark:text-green-400">✓ Selected: {receiptFile.name}</p>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="payment_reference">Reference Number (Optional)</Label>
              <Input
                id="payment_reference"
                value={formData.payment_reference}
                onChange={(e) => setFormData({ ...formData, payment_reference: e.target.value })}
                placeholder="e.g., TXN123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional details..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receipt Selection Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Receipt to Print</DialogTitle>
            <DialogDescription>Choose which receipt you want to print for this payment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedPaymentForReceipt?.documents
              ?.filter((d) => d.document_type === "receipt")
              .map((receipt, index) => (
                <Button
                  key={receipt.id}
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleViewReceipt(receipt.file_path)}
                >
                  <Receipt className="mr-2 h-4 w-4" />
                  <div className="flex flex-col items-start">
                    <span className="font-medium">{receipt.file_name || `Receipt ${index + 1}`}</span>
                    {receipt.applicable_date && (
                      <span className="text-muted-foreground text-xs">
                        Date: {format(parseISO(receipt.applicable_date), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </Button>
              ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceiptDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Column Selection Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Select Columns to Export</DialogTitle>
            <DialogDescription>
              Choose which columns you want to include in your {exportType?.toUpperCase()} export
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            {Object.keys(selectedColumns).map((column) => (
              <div key={column} className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id={column}
                  checked={selectedColumns[column]}
                  onChange={(e) =>
                    setSelectedColumns((prev) => ({
                      ...prev,
                      [column]: e.target.checked,
                    }))
                  }
                  className="text-primary focus:ring-primary h-4 w-4 rounded border-gray-300"
                />
                <label
                  htmlFor={column}
                  className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  {column}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleExportConfirm} disabled={!Object.values(selectedColumns).some((v) => v)}>
              Export to {exportType?.toUpperCase()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminTablePage>
  )
}
