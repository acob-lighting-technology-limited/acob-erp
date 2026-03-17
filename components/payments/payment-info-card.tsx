import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Payment } from "./payment-types"

interface PaymentInfoCardProps {
  payment: Payment
  formatCurrency: (amount: number, currency?: string) => string
}

export function PaymentInfoCard({ payment, formatCurrency }: PaymentInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Amount</p>
            <p className="text-2xl font-bold">{formatCurrency(payment.amount, payment.currency)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">Department</p>
            <p className="text-lg font-medium">{payment.department?.name || "Unknown"}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground text-sm font-medium">Category</p>
            <Badge variant="outline">{payment.category}</Badge>
          </div>
          <div>
            <p className="text-muted-foreground text-sm font-medium">Type</p>
            <span className="capitalize">{payment.payment_type}</span>
          </div>
        </div>

        {payment.description && (
          <div>
            <p className="text-muted-foreground text-sm font-medium">Description</p>
            <p className="mt-1 text-sm">{payment.description}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
