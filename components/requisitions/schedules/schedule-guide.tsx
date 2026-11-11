import { Check } from "lucide-react"
import type { PaymentScheduleStatus } from "@/lib/requisitions/types"
import { cn } from "@/lib/utils"

interface Step {
  title: string
  who: string
}

const STEPS: Step[] = [
  { title: "Add payments", who: "Accounts officer" },
  { title: "Finalize and check the sheet", who: "Accounts officer" },
  { title: "MD pays at the bank", who: "MD" },
  { title: "Record what was paid", who: "Accounts officer" },
  { title: "Approve what was paid", who: "MD" },
]

/** Which step the schedule is on, and what that step needs from whom. */
function currentStep(status: PaymentScheduleStatus, hasLines: boolean, pending: number, awaitingApproval: boolean) {
  if (status === "draft") return hasLines ? 1 : 0
  if (status === "sent") return pending > 0 ? 2 : 4
  return awaitingApproval ? 4 : 5
}

const NEXT: Record<number, string> = {
  0: "Add the verified Payment Requests that are going to the MD for this payment date.",
  1: "Click Finalize. The list is locked and the bank file is emailed to you to check. The MD is not contacted yet: once you are happy with the sheet, click Notify MD.",
  2: "The MD pays at the bank. When you have the receipts back, click Record what was paid (top right of this page) and mark each line Paid or Not paid.",
  4: "The paid requests are waiting for the MD's Approved signature. Anything not paid has gone back to be scheduled again.",
  5: "Every line has an outcome and every paid request is approved. This schedule is finished.",
}

export function ScheduleGuide({
  status,
  hasLines,
  pendingCount,
  awaitingApproval,
}: {
  status: PaymentScheduleStatus
  hasLines: boolean
  pendingCount: number
  awaitingApproval: boolean
}) {
  const step = currentStep(status, hasLines, pendingCount, awaitingApproval)
  return (
    <section className="bg-card mb-4 rounded-lg border p-3" aria-label="What happens next">
      <ol className="flex flex-wrap gap-x-5 gap-y-2">
        {STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <li key={s.title} className="flex items-center gap-2 text-xs">
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  done && "border-success bg-success text-white",
                  active && !done && "border-info bg-info/15 text-info",
                  !done && !active && "text-muted-foreground"
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span className={cn(active ? "font-medium" : done ? "text-foreground/80" : "text-muted-foreground")}>
                {s.title}
                <span className="text-muted-foreground"> · {s.who}</span>
              </span>
            </li>
          )
        })}
      </ol>
      {NEXT[step] ? <p className="text-muted-foreground mt-2 text-xs">{NEXT[step]}</p> : null}
    </section>
  )
}
