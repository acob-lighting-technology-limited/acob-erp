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
import { Building2, Phone, MapPin, DollarSign } from "lucide-react"
import { FormFieldGroup } from "@/components/ui/patterns"
import type { Department, Category, PaymentEditFormData } from "./payment-types"

interface PaymentEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  formData: PaymentEditFormData
  onFormDataChange: (data: PaymentEditFormData) => void
  onSubmit: (e: React.FormEvent) => void
  updating: boolean
  departments: Department[]
  categories: Category[]
  /** When true, shows a payment_type select instead of using category as type */
  showPaymentTypeField?: boolean
}

export function PaymentEditDialog({
  open,
  onOpenChange,
  formData,
  onFormDataChange,
  onSubmit,
  updating,
  departments,
  categories,
  showPaymentTypeField = false,
}: PaymentEditDialogProps) {
  const isRecurring = showPaymentTypeField ? formData.payment_type === "recurring" : formData.category === "recurring"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Payment</DialogTitle>
          <DialogDescription>Update the payment details below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormFieldGroup label="Department">
              <Select
                value={formData.department_id}
                onValueChange={(value) => onFormDataChange({ ...formData, department_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormFieldGroup>

            {showPaymentTypeField ? (
              <div className="space-y-2">
                <Label htmlFor="payment_type">Payment Type</Label>
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
            ) : (
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: "one-time" | "recurring") =>
                    onFormDataChange({ ...formData, category: value })
                  }
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
            )}

            {showPaymentTypeField && (
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => onFormDataChange({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => onFormDataChange({ ...formData, title: e.target.value })}
              />
            </div>
          </div>

          {/* Issuer Fields */}
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
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="relative">
                <DollarSign className="text-muted-foreground absolute top-2.5 left-3 h-4 w-4" />
                <Input
                  id="amount"
                  type="number"
                  className="pl-9"
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

          {isRecurring ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="recurrence">Recurrence Period</Label>
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
                <Label htmlFor="next_due">Next Payment Due</Label>
                <Input
                  id="next_due"
                  type="date"
                  value={formData.next_payment_due}
                  onChange={(e) => onFormDataChange({ ...formData, next_payment_due: e.target.value })}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="payment_date">Payment Date</Label>
              <Input
                id="payment_date"
                type="date"
                value={formData.payment_date}
                onChange={(e) => onFormDataChange({ ...formData, payment_date: e.target.value })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => onFormDataChange({ ...formData, description: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updating}>
              {updating ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
