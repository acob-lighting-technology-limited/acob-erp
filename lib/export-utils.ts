/**
 * Report exports, split by format under lib/export/ (audit 5.10). This barrel
 * keeps the old import path working; new code can import the format module directly.
 */
export { DEPARTMENT_ORDER, sortReportsByDepartment, sanitizeReportText, autoNumberLines } from "./export/shared"
export type { WeeklyReport, ActionItem, WeeklyPptxTheme, WeeklyDeptOrder } from "./export/shared"
export {
  exportToPDF,
  exportAllToPDF,
  exportAllToPDFBase64,
  exportActionPointToPDFBase64,
  exportActionPointToPDF,
} from "./export/pdf"
export { exportToDocx, exportActionPointToDocx, exportAllToDocx } from "./export/docx"
export { exportActionPointToXLSX, exportToXLSX, exportAllToXLSX } from "./export/xlsx"
export { exportActionPointToPPTX, exportToPPTX, exportAllToPPTX } from "./export/pptx"
export type { WeeklyPptxMode } from "./export/pptx"
