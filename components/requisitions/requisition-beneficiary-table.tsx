import { CheckCircle2, TriangleAlert } from "lucide-react"
import { CopyButton } from "@/components/ui/copy-button"
import { formatNaira } from "@/lib/requisitions/format"
import { accountNamesMatch } from "@/lib/requisitions/nuban"
import type { BeneficiaryDetail } from "@/lib/requisitions/types"
import { cn } from "@/lib/utils"

/** A beneficiary value with a copy button beside it. Empty values show a dash and nothing to copy. */
function CopyableCell({
  value,
  display,
  label,
  className,
}: {
  value: string | null | undefined
  display?: string
  label: string
  className?: string
}) {
  if (!value) return <>—</>
  return (
    <span className={cn("flex items-center gap-1", className)}>
      <span className="min-w-0 break-words">{display ?? value}</span>
      <CopyButton value={value} label={label} />
    </span>
  )
}

/**
 * What the bank said when the requisition was raised. Older requisitions,
 * and banks typed by hand, were never checked and show nothing.
 */
function BankConfirmation({ beneficiary: b }: { beneficiary: BeneficiaryDetail }) {
  if (!b.bank_code) return null
  if (!b.verified_account_name) {
    return <p className="text-muted-foreground mt-0.5 text-xs font-normal">Name not confirmed by the bank</p>
  }
  if (accountNamesMatch(b.account_name, b.verified_account_name)) {
    return (
      <p className="text-success mt-0.5 flex items-center gap-1 text-xs font-normal">
        <CheckCircle2 className="h-3 w-3 shrink-0" /> Confirmed by the bank
      </p>
    )
  }
  return (
    <p className="text-warning mt-0.5 flex items-start gap-1 text-xs font-normal">
      <TriangleAlert className="mt-px h-3 w-3 shrink-0" />
      <span>
        Bank has: <span className="font-semibold">{b.verified_account_name}</span>
      </span>
    </p>
  )
}

/** Who gets paid, with every value copyable for the bank's transfer form. */
export function RequisitionBeneficiaryTable({ beneficiaries }: { beneficiaries: BeneficiaryDetail[] }) {
  const showAmounts = beneficiaries.some((b) => b.amount != null)
  const showPurpose = beneficiaries.some((b) => b.purpose)
  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-muted/50 text-muted-foreground border-b font-medium">
            <th className="p-2 text-left">Account name</th>
            <th className="p-2 text-left">Account no</th>
            <th className="p-2 text-left">Bank</th>
            {showPurpose ? <th className="p-2 text-left">Purpose</th> : null}
            {showAmounts ? <th className="p-2 text-right">Amount</th> : null}
          </tr>
        </thead>
        <tbody>
          {beneficiaries.map((b, idx) => (
            <tr key={`row-${idx}`} className="border-b last:border-b-0">
              <td className="p-2 font-medium">
                <CopyableCell value={b.account_name} label="account name" />
                <BankConfirmation beneficiary={b} />
              </td>
              <td className="p-2 font-mono">
                <CopyableCell value={b.account_number} label="account number" />
              </td>
              <td className="p-2">
                <CopyableCell value={b.bank_name} label="bank name" />
              </td>
              {showPurpose ? <td className="p-2">{b.purpose || "—"}</td> : null}
              {showAmounts ? (
                <td className="p-2 text-right font-mono">
                  {b.amount != null ? (
                    // Copies the bare figure, which pastes cleanly into a bank's transfer form.
                    <CopyableCell
                      value={String(Number(b.amount))}
                      display={formatNaira(b.amount)}
                      label="amount"
                      className="justify-end"
                    />
                  ) : (
                    "—"
                  )}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
