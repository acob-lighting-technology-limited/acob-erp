import { FileText, Receipt, Wallet } from "lucide-react"
import { formatNaira } from "@/lib/requisitions/format"
import { FORM_LABELS, PAYMENT_REQUEST_MIN, PETTY_CASH_MAX } from "@/lib/requisitions/limits"
import type { RequisitionFormType } from "@/lib/requisitions/types"

export function FormChoice({ onPick }: { onPick: (type: RequisitionFormType) => void }) {
  const choices: { type: RequisitionFormType; icon: typeof Wallet; title: string; text: string }[] = [
    {
      type: "payment_request",
      icon: FileText,
      title: FORM_LABELS.payment_request,
      text: `${formatNaira(PAYMENT_REQUEST_MIN).replace(".00", "")} and above. For project expenses, vendor invoices, contracts, and major purchases.`,
    },
    {
      type: "petty_cash",
      icon: Receipt,
      title: FORM_LABELS.petty_cash,
      text: `Up to ${formatNaira(PETTY_CASH_MAX).replace(".00", "")}. For minor office expenses, urgent supplies, and daily running costs.`,
    },
  ]
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map(({ type, icon: Icon, title, text }) => (
        <button
          key={type}
          type="button"
          onClick={() => onPick(type)}
          className="hover:border-primary hover:bg-primary/5 focus-visible:ring-ring rounded-lg border p-4 text-left transition focus-visible:ring-2 focus-visible:outline-none"
        >
          <Icon className="text-primary mb-2 h-6 w-6" aria-hidden />
          <p className="font-semibold">{title}</p>
          <p className="text-muted-foreground mt-1 text-sm">{text}</p>
        </button>
      ))}
      <p className="text-muted-foreground text-xs sm:col-span-2">
        Expenses under ₦50,000 must use Petty Cash. For exactly ₦50,000, either form can be used.
      </p>
    </div>
  )
}
