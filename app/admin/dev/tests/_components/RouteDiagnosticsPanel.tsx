"use client"

import { DiagnosticsPanel } from "./DiagnosticsPanel"
import { FIX_HINTS, type DiagRow } from "./shared-types"

export function RouteDiagnosticsPanel() {
  return (
    <DiagnosticsPanel<DiagRow>
      title="Leave Route Diagnostics"
      description="Validates every approval stage in the DB. Run this to spot missing approver assignments before running the flow test."
      endpoint="/api/dev/leave-route-diagnostics"
      unit="stage"
      okToast="All routes fully configured ✓"
      failToast={(n) => `${n} broken stage(s) found`}
      groupBy={(row) => row.requester_kind}
      rowLabel={(row) => `Stage ${row.stage_order}: ${row.approver_role_code}`}
      fixHint={(row) => FIX_HINTS[row.approver_role_code]}
    />
  )
}
