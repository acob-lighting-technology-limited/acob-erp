import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react"
import type { NubanResult } from "@/lib/requisitions/nuban"

/** What the bank said about one account number at one bank. */
export type AccountLookup =
  | { status: "loading" }
  | { status: "found"; accountName: string }
  | { status: "not_found" }
  | { status: "unavailable" }

/**
 * One line under a beneficiary: first the check digit (instant, catches
 * typos), then whether the bank confirmed the account and gave its name.
 */
export function AccountCheck({
  nuban,
  lookup,
  otherBank,
  onPickBank,
}: {
  nuban: NubanResult | null
  lookup: AccountLookup | undefined
  otherBank: boolean
  onPickBank: (code: string) => void
}) {
  if (otherBank) {
    return (
      <p className="text-muted-foreground text-xs">
        This bank cannot be checked. Type the account name exactly as the bank has it.
      </p>
    )
  }
  if (nuban?.status === "invalid") {
    return (
      <div className="text-danger space-y-1 text-xs" role="alert">
        <p className="flex items-start gap-1.5">
          <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
          This is not a valid {nuban.bank.name} account number. Check the digits, or the bank.
        </p>
        {nuban.fits.length ? (
          <p className="text-muted-foreground flex flex-wrap items-center gap-1 pl-5">
            It fits:
            {nuban.fits.slice(0, 4).map((bank) => (
              <button
                key={bank.code}
                type="button"
                onClick={() => onPickBank(bank.code)}
                className="text-foreground hover:bg-muted rounded border px-1.5 py-0.5"
              >
                {bank.name}
              </button>
            ))}
          </p>
        ) : null}
      </div>
    )
  }
  if (!lookup) {
    return (
      <p className="text-muted-foreground text-xs">
        Enter the account number and pick the bank; the account name comes from the bank.
      </p>
    )
  }
  if (lookup.status === "loading") {
    return (
      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> Checking the account with the bank…
      </p>
    )
  }
  if (lookup.status === "not_found") {
    return (
      <p className="text-danger flex items-start gap-1.5 text-xs" role="alert">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        The bank has no account with this number. Check the number and the bank.
      </p>
    )
  }
  if (lookup.status === "unavailable") {
    return (
      <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
        <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0" />
        Could not reach the bank. Type the account name; signers will see it was not confirmed.
      </p>
    )
  }
  return (
    <p className="text-success flex items-center gap-1.5 text-xs">
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Account name confirmed by the bank.
    </p>
  )
}
