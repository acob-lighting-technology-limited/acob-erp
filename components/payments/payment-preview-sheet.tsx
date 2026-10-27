"use client"

import { useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle,
  Download,
  Edit,
  FileText,
  Loader2,
  MoreVertical,
  Printer,
  Trash2,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import {
  format,
  parseISO,
  isValid,
  differenceInDays,
  startOfDay,
  isBefore,
  addMonths,
  addYears,
  addQuarters,
} from "date-fns"

import { DetailSheet } from "@/components/ui/detail-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { PaymentInfoCard } from "./payment-info-card"
import { PaymentMetaCard } from "./payment-meta-card"
import { ScheduleList } from "./schedule-list"
import { PaymentEditDialog } from "./payment-edit-dialog"
import { PaymentUploadDialog } from "./payment-upload-dialog"
import { PrintReceiptDialog } from "./print-receipt-dialog"
import { usePaymentSchedule } from "./use-payment-schedule"
import { paymentUsesReceipts } from "./payment-types"
import type { Payment, Department, Category, PaymentDocument, PaymentEditFormData } from "./payment-types"

import { apiFetch } from "@/lib/api-client"
import { QUERY_KEYS } from "@/lib/query-keys"

export interface PaymentPreviewSheetProps {
  paymentId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  basePath: string
  scope?: "app" | "admin"
}

interface PaymentPageData {
  payment: Payment | null
  departments: Department[]
  categories: Category[]
}

async function fetchPaymentPageData(id: string): Promise<PaymentPageData> {
  const [paymentRes, deptRes, catRes] = await Promise.all([
    apiFetch(`/api/payments/${id}`),
    apiFetch("/api/departments"),
    apiFetch("/api/payments/categories"),
  ])

  const paymentJson = await paymentRes.json()
  const payment: Payment | null = paymentRes.ok ? (paymentJson.data ?? null) : null
  if (!paymentRes.ok) {
    throw new Error(paymentJson.error ?? "Failed to fetch payment details")
  }

  const departments: Department[] = deptRes.ok ? ((await deptRes.json()).data ?? []) : []
  const categories: Category[] = catRes.ok ? ((await catRes.json()).data ?? []) : []

  return { payment, departments, categories }
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success border-success/20"
    case "due":
      return "bg-warning/10 text-warning border-warning/20"
    case "overdue":
      return "bg-danger/10 text-danger border-danger/20"
    case "cancelled":
      return "bg-muted text-muted-foreground border-transparent"
    default:
      return ""
  }
}

function formatCurrency(amount: number, currency: string = "NGN") {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount)
}

function getRealStatus(p: Payment): "due" | "paid" | "overdue" | "cancelled" {
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

export function PaymentPreviewSheet({
  paymentId,
  open,
  onOpenChange,
  basePath,
  scope = "app",
}: PaymentPreviewSheetProps) {
  const queryClient = useQueryClient()
  const detailKey =
    scope === "admin" ? QUERY_KEYS.adminPaymentDetail(paymentId ?? "") : QUERY_KEYS.appPaymentDetail(paymentId ?? "")

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Upload dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadDate, setUploadDate] = useState<Date | null>(null)
  const [uploadType, setUploadType] = useState<"invoice" | "receipt">("invoice")
  const [uploading, setUploading] = useState(false)
  const [replaceDocumentId, setReplaceDocumentId] = useState<string | null>(null)

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [printDialogOpen, setPrintDialogOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [editFormData, setEditFormData] = useState<PaymentEditFormData>({
    department_id: "",
    payment_type: "",
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
    project_id: "",
  })

  const {
    data: pageData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: detailKey,
    queryFn: () => fetchPaymentPageData(paymentId!),
    enabled: Boolean(open && paymentId),
    staleTime: 10_000,
  })

  const payment = pageData?.payment ?? null
  const departments = pageData?.departments ?? []
  const categories = pageData?.categories ?? []
  const schedule = usePaymentSchedule(payment)

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: detailKey }),
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.paymentsTable() }),
    ])
  }

  const downloadPaymentDocument = (doc: PaymentDocument) => {
    if (!paymentId) return
    const filename = doc.file_name || doc.file_path.split("/").pop() || "document.pdf"
    const toastId = toast.loading("Preparing download...")
    const link = document.createElement("a")
    link.href = `/api/payments/${paymentId}/documents/${doc.id}/download`
    link.download = filename
    link.style.display = "none"
    link.rel = "noopener noreferrer"
    document.body.appendChild(link)
    link.click()
    window.setTimeout(() => {
      document.body.removeChild(link)
    }, 100)
    window.setTimeout(() => {
      toast.dismiss(toastId)
    }, 6000)
  }

  const handleEditClick = () => {
    if (!payment) return
    setEditFormData({
      department_id: payment.department_id,
      payment_type: payment.payment_type,
      category: payment.category,
      title: payment.title,
      description: payment.description || "",
      amount: payment.amount.toString(),
      currency: payment.currency,
      recurrence_period: payment.recurrence_period || "monthly",
      next_payment_due: payment.next_payment_due ? format(parseISO(payment.next_payment_due), "yyyy-MM-dd") : "",
      payment_date: payment.payment_date ? format(parseISO(payment.payment_date), "yyyy-MM-dd") : "",
      issuer_name: payment.issuer_name || "",
      issuer_phone_number: payment.issuer_phone_number || "",
      issuer_address: payment.issuer_address || "",
      payment_reference: payment.payment_reference || "",
      notes: payment.notes || "",
      project_id: payment.project?.id ?? "",
    })
    setEditDialogOpen(true)
  }

  const handleUpdate = async (submittedFormData: PaymentEditFormData) => {
    if (!paymentId) return
    try {
      setUpdating(true)
      const payload = {
        ...submittedFormData,
        payment_type: submittedFormData.payment_type,
        category: submittedFormData.category,
        amount: parseFloat(submittedFormData.amount),
        next_payment_due: submittedFormData.next_payment_due || null,
        payment_date: submittedFormData.payment_date || null,
        project_id: submittedFormData.project_id || null,
      }

      const response = await apiFetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        toast.success("Payment updated successfully")
        setEditDialogOpen(false)
        await refreshAll()
      } else {
        const resJson = await response.json()
        toast.error(resJson.error || "Failed to update payment")
      }
    } catch {
      toast.error("Error updating payment")
    } finally {
      setUpdating(false)
    }
  }

  const handleDelete = async () => {
    if (!paymentId) return
    try {
      setDeleteLoading(true)
      const response = await apiFetch(`/api/payments/${paymentId}`, { method: "DELETE" })
      if (response.ok) {
        toast.success("Payment deleted successfully")
        onOpenChange(false)
        await refreshAll()
      } else {
        const resJson = await response.json()
        toast.error(resJson.error || "Failed to delete payment")
      }
    } catch {
      toast.error("Error deleting payment")
    } finally {
      setDeleteLoading(false)
      setDeleteDialogOpen(false)
    }
  }

  const handleUploadClick = (date: Date, type: "invoice" | "receipt") => {
    setUploadDate(date)
    setUploadType(type)
    setReplaceDocumentId(null)
    setUploadDialogOpen(true)
  }

  const handleReplaceClick = (date: Date, type: "invoice" | "receipt", docId: string) => {
    setUploadDate(date)
    setUploadType(type)
    setReplaceDocumentId(docId)
    setUploadDialogOpen(true)
  }

  const handleFileUpload = async (e: React.FormEvent, inputRef: React.RefObject<HTMLInputElement | null>) => {
    e.preventDefault()
    if (!paymentId || !uploadDate || !inputRef.current?.files?.[0]) return
    const file = inputRef.current.files[0]
    const formData = new FormData()
    formData.append("file", file)
    formData.append("document_type", uploadType)
    formData.append("applicable_date", format(uploadDate, "yyyy-MM-dd"))
    if (replaceDocumentId) {
      formData.append("replace_document_id", replaceDocumentId)
    }

    setUploading(true)
    try {
      const response = await apiFetch(`/api/payments/${paymentId}/documents`, { method: "POST", body: formData })
      if (response.ok) {
        toast.success(replaceDocumentId ? `${uploadType} replaced successfully` : `${uploadType} uploaded successfully`)
        setUploadDialogOpen(false)
        setReplaceDocumentId(null)
        await refreshAll()
      } else {
        const resJson = await response.json()
        toast.error(resJson.error || "Upload failed")
      }
    } catch {
      toast.error("Error uploading file")
    } finally {
      setUploading(false)
    }
  }

  const markAsPaid = async (targetDate?: Date) => {
    if (!payment || !paymentId) return

    if (payment.payment_type === "recurring" && payment.next_payment_due && payment.recurrence_period) {
      const dateToPay = targetDate instanceof Date ? targetDate : parseISO(payment.next_payment_due)
      const dateStr = format(dateToPay, "yyyy-MM-dd")
      const hasReceipt = payment.documents?.some((d) => d.applicable_date === dateStr && d.document_type === "receipt")

      if (paymentUsesReceipts(payment) && !hasReceipt) {
        toast.error("Please upload a payment receipt first.", {
          action: { label: "Upload", onClick: () => handleUploadClick(dateToPay, "receipt") },
          duration: 5000,
        })
        handleUploadClick(dateToPay, "receipt")
        return
      }

      const currentDue = parseISO(payment.next_payment_due)
      let nextDue: Date
      switch (payment.recurrence_period) {
        case "monthly":
          nextDue = addMonths(currentDue, 1)
          break
        case "quarterly":
          nextDue = addQuarters(currentDue, 1)
          break
        case "yearly":
          nextDue = addYears(currentDue, 1)
          break
        default:
          nextDue = addMonths(currentDue, 1)
      }

      try {
        const response = await apiFetch(`/api/payments/${paymentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next_payment_due: format(nextDue, "yyyy-MM-dd") }),
        })
        if (response.ok) {
          toast.success("Payment schedule updated")
          await refreshAll()
        } else {
          const resJson = await response.json()
          toast.error(resJson.error || "Failed to update schedule")
        }
      } catch {
        toast.error("Error updating schedule")
      }
    } else {
      if (paymentUsesReceipts(payment) && !payment.documents?.some((d) => d.document_type === "receipt")) {
        toast.error("Please upload a payment receipt first.", {
          action: { label: "Upload", onClick: () => handleUploadClick(new Date(), "receipt") },
          duration: 5000,
        })
        handleUploadClick(new Date(), "receipt")
        return
      }

      try {
        const response = await apiFetch(`/api/payments/${paymentId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "paid" }),
        })
        if (response.ok) {
          toast.success("Payment marked as paid")
          await refreshAll()
        } else {
          const resJson = await response.json()
          toast.error(resJson.error || "Failed to mark as paid")
        }
      } catch {
        toast.error("Error updating payment")
      }
    }
  }

  const realStatus = payment ? getRealStatus(payment) : "due"
  const fullPageHref = paymentId ? `${basePath}/${paymentId}` : "#"

  return (
    <>
      <DetailSheet
        wide
        flush
        open={open}
        onOpenChange={onOpenChange}
        title={payment ? payment.title : "Payment details"}
        description={
          payment ? (
            <>
              {payment.payment_type === "recurring"
                ? `Recurring (${payment.recurrence_period || "monthly"})`
                : `One-time payment · ${payment.payment_date ? format(parseISO(payment.payment_date), "MMM d, yyyy") : "N/A"}`}
              {payment.department?.name && ` · ${payment.department.name}`}
            </>
          ) : (
            "Loading payment information..."
          )
        }
        badges={
          payment ? (
            <>
              <Badge variant="outline" className="text-xs font-semibold">
                {payment.category}
              </Badge>
              <Badge variant="outline" className={`text-xs capitalize ${getStatusBadgeClass(realStatus)}`}>
                {realStatus}
              </Badge>
              {payment.payment_type === "recurring" && payment.next_payment_due && (
                <Badge variant="secondary" className="text-xs">
                  Next Due: {format(parseISO(payment.next_payment_due), "MMM d, yyyy")}
                </Badge>
              )}
              <div className="flex items-center gap-1.5">
                <Button asChild variant="outline" size="sm" className="h-8 gap-1">
                  <Link href={fullPageHref}>
                    <span>Full page</span>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button aria-label="More actions" variant="outline" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleEditClick}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Payment
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPrintDialogOpen(true)}>
                      <Printer className="mr-2 h-4 w-4" />
                      Download Receipt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Payment
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </>
          ) : null
        }
        footer={
          payment ? (
            <>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button size="sm" variant="default" onClick={handleEditClick} className="gap-1.5">
                <Edit className="h-3.5 w-3.5" />
                Edit Payment
              </Button>
            </>
          ) : null
        }
      >
        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {isLoading && (
            <div className="text-muted-foreground flex min-h-[300px] flex-col items-center justify-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm">Loading payment preview...</p>
            </div>
          )}

          {error && !isLoading && (
            <div className="text-destructive flex min-h-[300px] flex-col items-center justify-center gap-3">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm font-medium">Failed to load payment</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          )}

          {payment && !isLoading && (
            <>
              {/* Prominent Amount Card */}
              <div className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">Amount</p>
                  <p className="text-foreground text-2xl font-extrabold sm:text-3xl">
                    {formatCurrency(payment.amount, payment.currency)}
                  </p>
                </div>
                {(realStatus === "due" || realStatus === "overdue") && (
                  <Button onClick={() => void markAsPaid()} className="shrink-0 gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {payment.payment_type === "recurring" ? "Mark Current Due as Paid" : "Mark as Paid"}
                  </Button>
                )}
              </div>

              {/* Recurring schedule or history */}
              {payment.payment_type === "recurring" && (
                <div className="space-y-4">
                  <div className="space-y-3 rounded-lg border p-4">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="text-muted-foreground h-4 w-4" />
                      Upcoming Schedule
                    </h3>
                    <ScheduleList
                      items={schedule.filter((i) => i.status !== "paid")}
                      receiptsEnabled={paymentUsesReceipts(payment)}
                      onUpload={handleUploadClick}
                      onView={(_, doc) => downloadPaymentDocument(doc)}
                      onMarkPaid={markAsPaid}
                      onReplace={handleReplaceClick}
                    />
                  </div>

                  {schedule.some((i) => i.status === "paid") && (
                    <div className="space-y-3 rounded-lg border p-4">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <FileText className="text-muted-foreground h-4 w-4" />
                        Payment History
                      </h3>
                      <ScheduleList
                        items={schedule.filter((i) => i.status === "paid")}
                        receiptsEnabled={paymentUsesReceipts(payment)}
                        onUpload={handleUploadClick}
                        onView={(_, doc) => downloadPaymentDocument(doc)}
                        onReplace={handleReplaceClick}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* One-time Payment Documents */}
              {payment.payment_type === "one-time" && (
                <div className="space-y-3 rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <FileText className="text-muted-foreground h-4 w-4" />
                      Documents & Receipts
                    </h3>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 text-xs"
                      onClick={() => handleUploadClick(new Date(), "receipt")}
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Upload Document
                    </Button>
                  </div>
                  {payment.documents && payment.documents.length > 0 ? (
                    <div className="divide-y rounded-md border text-sm">
                      {payment.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between p-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                            <div className="truncate">
                              <p className="truncate font-medium">{doc.file_name || "Document"}</p>
                              <p className="text-muted-foreground text-xs capitalize">{doc.document_type}</p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => downloadPaymentDocument(doc)}
                            aria-label={`Download ${doc.file_name || "document"}`}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-xs">No documents uploaded yet.</p>
                  )}
                </div>
              )}

              {/* Info and Meta Cards */}
              <div className="space-y-4">
                <PaymentInfoCard payment={payment} formatCurrency={formatCurrency} />
                <PaymentMetaCard payment={payment} />
              </div>
            </>
          )}
        </div>
      </DetailSheet>

      {/* Nested Dialogs */}
      <PaymentEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        formData={editFormData}
        onFormDataChange={setEditFormData}
        onSubmit={handleUpdate}
        updating={updating}
        departments={departments}
        categories={categories}
        showPaymentTypeField={true}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete this payment record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={handleDelete} loading={deleteLoading}>
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PaymentUploadDialog
        open={uploadDialogOpen}
        onOpenChange={(openModal) => {
          setUploadDialogOpen(openModal)
          if (!openModal) setReplaceDocumentId(null)
        }}
        uploadDate={uploadDate}
        uploadType={uploadType}
        uploading={uploading}
        replaceDocumentId={replaceDocumentId}
        onSubmit={handleFileUpload}
      />

      <PrintReceiptDialog
        open={printDialogOpen}
        onOpenChange={setPrintDialogOpen}
        schedule={schedule}
        onDownloadDocument={downloadPaymentDocument}
      />
    </>
  )
}
