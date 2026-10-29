import { appealAuditSteps, type AuditStepState, type AuditableAppeal } from "@/lib/hr/appeal-audit"
import { formatWATDateTime } from "@/lib/utils/date"

const STATE_TONE: Record<AuditStepState, string> = {
  done: "text-success font-medium",
  waiting: "text-warning font-medium",
  rejected: "text-danger font-medium",
  skipped: "text-muted-foreground font-medium",
  override: "text-warning font-medium",
  none: "text-muted-foreground",
}

/** The steps an attendance appeal went through, one row each. */
export function AppealAuditTrail({ appeal }: { appeal: AuditableAppeal }) {
  return (
    <div className="bg-background/80 divide-y rounded-lg border text-xs">
      {appealAuditSteps(appeal).map((step) => (
        <div key={step.key} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground w-28 shrink-0 font-semibold">{step.label}</span>
              <span className={STATE_TONE[step.state]}>{step.text}</span>
            </div>
            {step.by && (
              <span className="text-muted-foreground">
                by <strong className="text-foreground font-medium">{step.by}</strong>
              </span>
            )}
            {step.note && (
              <span className="text-muted-foreground truncate italic">
                {step.state === "override" ? "Reason: " : ""}&ldquo;{step.note}&rdquo;
              </span>
            )}
          </div>
          {step.at && (
            <span className="text-muted-foreground shrink-0 whitespace-nowrap">{formatWATDateTime(step.at)}</span>
          )}
        </div>
      ))}
    </div>
  )
}

/** The same steps as one line each, for plain field lists. */
export function appealAuditLines(appeal: AuditableAppeal): Array<{ label: string; value: string }> {
  return appealAuditSteps(appeal).map((step) => ({
    label: step.label,
    value: [
      step.text,
      step.by ? `by ${step.by}` : null,
      step.note ? `— "${step.note}"` : null,
      step.at ? `(${formatWATDateTime(step.at)})` : null,
    ]
      .filter(Boolean)
      .join(" "),
  }))
}
