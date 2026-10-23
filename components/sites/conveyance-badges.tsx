import { StatusBadge } from "@/components/ui/patterns/status-badge"
import {
  CONVEYANCE_STANDING_LABELS,
  DOCUMENT_STANDING_LABELS,
  documentName,
  documentStanding,
  type ConveyanceStanding,
} from "@/lib/sites/conveyance"
import type { SiteDocumentRecord } from "@/lib/sites/records"
import { formatWATDate } from "@/lib/utils/date"

/** StatusBadge has no "none" tone of its own; an unrecorded site reads as neutral. */
const STANDING_TONE: Record<ConveyanceStanding, string> = {
  expired: "expired",
  expiring: "expiring",
  pending: "pending",
  valid: "valid",
  none: "inactive",
}

export function ConveyanceStandingBadge({ standing }: { standing: ConveyanceStanding }) {
  return <StatusBadge status={STANDING_TONE[standing]} label={CONVEYANCE_STANDING_LABELS[standing]} />
}

/** One chip per document — "NERC · Expired" — with the expiry date on hover. */
export function DocumentBadges({ documents, today }: { documents: SiteDocumentRecord[]; today: string }) {
  if (documents.length === 0) {
    return <span className="text-muted-foreground text-xs">No documents recorded</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {documents.map((doc) => {
        const standing = documentStanding(doc, today)
        return (
          <span key={doc.id} title={doc.expires_on ? `Expires ${formatWATDate(doc.expires_on)}` : "No expiry date"}>
            <StatusBadge
              status={standing}
              label={`${documentName(doc)} · ${DOCUMENT_STANDING_LABELS[standing]}`}
              className="text-xs font-medium"
            />
          </span>
        )
      })}
    </div>
  )
}
