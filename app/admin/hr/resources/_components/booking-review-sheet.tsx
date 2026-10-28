"use client"

import { Button } from "@/components/ui/button"
import { DetailSheet } from "@/components/ui/detail-sheet"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DetailList, SectionHeading } from "@/components/ui/detail-list"
import type { FleetAttachment, FleetBooking } from "./fleet-types"

type BookingReviewSheetProps = {
  selectedBooking: FleetBooking | null
  attachments: FleetAttachment[]
  adminNote: string
  reviewing: boolean
  formatDateTime: (value: string) => string
  onAdminNoteChange: (value: string) => void
  onClose: () => void
  onReview: (action: "approve" | "reject") => void
}

export function BookingReviewSheet({
  selectedBooking,
  attachments,
  adminNote,
  reviewing,
  formatDateTime,
  onAdminNoteChange,
  onClose,
  onReview,
}: BookingReviewSheetProps) {
  const decided = selectedBooking && selectedBooking.status !== "pending"
  return (
    <DetailSheet
      open={Boolean(selectedBooking)}
      onOpenChange={(open) => (!open ? onClose() : null)}
      title={selectedBooking?.resource?.name || "Resource booking"}
      description="Confirm the reason and supporting files before approval."
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {selectedBooking?.status === "pending" ? (
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={() => onReview("reject")} disabled={reviewing}>
                Reject
              </Button>
              <Button size="sm" onClick={() => onReview("approve")} disabled={reviewing}>
                Approve
              </Button>
            </div>
          ) : null}
        </>
      }
    >
      {selectedBooking ? (
        <>
          <div className="space-y-3">
            <SectionHeading title="Booking" />
            <DetailList
              items={[
                { label: "From", value: formatDateTime(selectedBooking.start_at) },
                { label: "To", value: formatDateTime(selectedBooking.end_at) },
                { label: "Reason", value: selectedBooking.reason, wide: true },
              ]}
            />
          </div>

          {decided ? (
            <div className="space-y-3">
              <SectionHeading title={selectedBooking.status === "rejected" ? "Rejected by" : "Decision by"} />
              <DetailList
                items={[
                  {
                    label: "Reviewer",
                    value: `${selectedBooking.reviewer?.full_name || "Unknown"}${
                      selectedBooking.reviewer?.department ? ` — ${selectedBooking.reviewer.department}` : ""
                    }`,
                  },
                  {
                    label: "When",
                    value: selectedBooking.reviewed_at
                      ? formatDateTime(selectedBooking.reviewed_at)
                      : "Time not recorded",
                  },
                ]}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <SectionHeading title="Attachments" />
            {attachments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No attachments provided.</p>
            ) : null}
            {attachments.map((file) => (
              <div key={file.id} className="flex items-center justify-between rounded border p-2 text-sm">
                <div>
                  <p>{file.file_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {file.mime_type} • {(file.file_size / 1024).toFixed(1)} KB
                  </p>
                </div>
                {file.signed_url ? (
                  <a
                    href={file.signed_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary text-sm hover:underline"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-muted-foreground text-xs">Unavailable</span>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Admin note</Label>
            <Textarea
              value={adminNote}
              onChange={(event) => onAdminNoteChange(event.target.value)}
              rows={3}
              placeholder="Add a note to explain your decision..."
            />
          </div>
        </>
      ) : null}
    </DetailSheet>
  )
}
