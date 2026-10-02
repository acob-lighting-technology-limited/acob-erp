"use client"

import { DiagnosticsPanel } from "./DiagnosticsPanel"
import { TASK_FIX_HINTS, type TaskDiagRow } from "./shared-types"

export function TaskRouteDiagnosticsPanel() {
  return (
    <DiagnosticsPanel<TaskDiagRow>
      title="Task Route Diagnostics"
      description="Checks department lead coverage and department assignment targets for task visibility and notifications."
      endpoint="/api/dev/task-route-diagnostics"
      unit="check"
      okToast="Task route checks passed ✓"
      failToast={(n) => `${n} Task routing issue(s) found`}
      rowLabel={(row) => `${row.check_code} (${row.scope})`}
      fixHint={(row) => TASK_FIX_HINTS[row.check_code]}
    />
  )
}
