import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Building2 } from "lucide-react"
import { format, parseISO } from "date-fns"
import type { Payment } from "./payment-types"

interface PaymentMetaCardProps {
  payment: Payment
}

export function PaymentMetaCard({ payment }: PaymentMetaCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Meta Info</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-3 border-b pb-4">
            <h4 className="flex items-center gap-2 text-sm font-medium">
              <Building2 className="text-muted-foreground h-4 w-4" />
              Issuer Details
            </h4>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-muted-foreground text-xs">Name</dt>
                <dd className="font-medium">{payment.issuer_name || "N/A"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Phone</dt>
                <dd className="font-medium">{payment.issuer_phone_number || "N/A"}</dd>
              </div>
              {payment.issuer_address && (
                <div>
                  <dt className="text-muted-foreground text-xs">Address</dt>
                  <dd className="text-muted-foreground">{payment.issuer_address}</dd>
                </div>
              )}
            </dl>
          </div>

          <dl className="grid gap-4">
            {payment.payment_reference && (
              <div>
                <dt className="text-muted-foreground text-sm font-medium">Reference</dt>
                <dd className="text-sm break-all">{payment.payment_reference}</dd>
              </div>
            )}
          </dl>

          <div className="flex gap-4 border-t pt-4">
            <div className="pt-0.5 pb-8">
              <p className="text-foreground text-sm font-medium">Created</p>
              <p className="text-muted-foreground text-xs">{format(parseISO(payment.created_at), "PPP")}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
