"use client"

import { DiagnosticsPanel } from "./DiagnosticsPanel"
import { HELP_DESK_FIX_HINTS, type HelpDeskDiagRow } from "./shared-types"

export function HelpDeskRouteDiagnosticsPanel() {
  return (
    <DiagnosticsPanel<HelpDeskDiagRow>
      title="Help Desk Route Diagnostics"
      description="Checks support/procurement route readiness, including department lead coverage and procurement approvers."
      endpoint="/api/dev/help-desk-route-diagnostics"
      unit="check"
      okToast="Help Desk routes fully configured ✓"
      failToast={(n) => `${n} Help Desk route issue(s) found`}
      groupBy={(row) => row.flow_kind}
      groupLabel={(key) => `${key} flow`}
      rowLabel={(row) => `${row.stage_code} (${row.scope})`}
      fixHint={(row) => HELP_DESK_FIX_HINTS[row.stage_code]}
    />
  )
}
