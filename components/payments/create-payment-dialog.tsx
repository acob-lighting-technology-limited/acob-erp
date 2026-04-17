"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Building2, Phone, MapPin, Calendar, Receipt } from "lucide-react"
import type { Department } from "./payment-types"

export interface CreatePaymentFormData {
  department_id: string
  payment_type: "one-time" | "recurring" | ""
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

interface CreatePaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: CreatePaymentFormData
  onFormDataChange: (data: CreatePaymentFormData) => void
  onSubmit: (e: React.FormEvent) => void
  submitting: boolean
  receiptFile: File | null
  onReceiptFileChange: (file: File | null) => void
  departments: Department[]
  filterableDepartments: Department[]
  isAdmin: boolean
}

export function CreatePaymentDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit,
  submitting,
  receiptFile,
  onReceiptFileChange,
  departments,
  filterableDepartments,
  isAdmin,
}: CreatePaymentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Payment</DialogTitle>
          <DialogDescription>Create a new payment record. Issuer Name and Phone are required.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Select
                value={formData.department_id}
                onValueChange={(value) => onFormDataChange({ ...formData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {(isAdmin ? departments : filterableDepartments).map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payment-type">Type</Label>
              <Select
                value={formData.payment_type}
                onValueChange={(value: "one-time" | "recurring") =>
                  onFormDataChange({ ...formData, payment_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
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
              onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
              placeholder="e.g., Office Rent 2024"
              required
            />
          </div>

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
                  onChange={(e) => onFormDataChange({ ...formData, issuer_name: e.target.value })}
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
                  onChange={(e) => onFormDataChange({ ...formData, issuer_phone_number: e.target.value })}
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
                  onChange={(e) => onFormDataChange({ ...formData, issuer_address: e.target.value })}
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
                  onChange={(e) => onFormDataChange({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={formData.currency}
                onValueChange={(value) => onFormDataChange({ ...formData, currency: value })}
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

          {formData.payment_type === "recurring" ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period">Recurrence Period</Label>
                <Select
                  value={formData.recurrence_period}
                  onValueChange={(value) => onFormDataChange({ ...formData, recurrence_period: value })}
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
                    onChange={(e) => onFormDataChange({ ...formData, next_payment_due: e.target.value })}
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
                  onChange={(e) => onFormDataChange({ ...formData, payment_date: e.target.value })}
                />
              </div>
            </div>
          )}

          {formData.payment_type === "one-time" && (
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
                  onChange={(e) => onReceiptFileChange(e.target.files?.[0] || null)}
                  className="cursor-pointer"
                />
                {receiptFile && (
                  <p className="text-sm text-green-600 dark:text-green-400">Selected: {receiptFile.name}</p>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="payment_reference">Reference Number (Optional)</Label>
            <Input
              id="payment_reference"
              value={formData.payment_reference}
              onChange={(e) => onFormDataChange({ ...formData, payment_reference: e.target.value })}
              placeholder="e.g., TXN123456789"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
              placeholder="Additional details..."
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
