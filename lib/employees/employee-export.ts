import { exportTable, getRecordExportColumns } from "@/lib/export/table-export"
/**
 * @deprecated Client-side exports expose sensitive data to the browser.
 * Use the server-side endpoint POST /api/admin/employees/export instead.
 * This file is kept for backwards compatibility during migration.
 */
import { formatName } from "@/lib/utils"
import { getRoleDisplayName } from "@/lib/permissions"
import { logger } from "@/lib/logger"
import { toast } from "sonner"
import type { UserRole, EmploymentStatus } from "@/types/database"
import { toLocalISODate, formatWATDate, formatDateOfBirth, formatDDMMYYYY } from "@/lib/utils/date"

export interface Employee {
  id: string
  employee_number: string | null
  first_name: string
  last_name: string
  other_names: string | null
  company_email: string
  additional_email: string | null
  department: string
  designation: string | null
  role: UserRole
  admin_routes?: string[] | null
  phone_number: string | null
  additional_phone: string | null
  residential_address: string | null
  office_location: string | null
  date_of_birth: string | null
  birthday: string | null
  employment_date: string | null
  confirmation_date?: string | null
  is_admin: boolean
  is_department_lead: boolean
  lead_departments: string[]
  employment_status: EmploymentStatus
  employment_type?: string | null
  contract_categories?: { name: string; code: string } | null
  created_at: string
}

export interface ExportOptions {
  selectedColumns: Record<string, boolean>
}

const log = logger("employees-export")

/** Build flat export rows from employee list + selected columns */
export function buildEmployeeExportRows(employees: Employee[], opts: ExportOptions): Record<string, unknown>[] {
  const { selectedColumns } = opts
  return employees.map((member, index) => {
    const row: Record<string, unknown> = {}
    if (selectedColumns["#"]) row["#"] = index + 1
    if (selectedColumns["Employee No."]) row["Employee No."] = member.employee_number || "-"
    if (selectedColumns["Last Name"]) row["Last Name"] = formatName(member.last_name) || "-"
    if (selectedColumns["First Name"]) row["First Name"] = formatName(member.first_name) || "-"
    if (selectedColumns["Other Names"]) row["Other Names"] = member.other_names || "-"
    if (selectedColumns["Email"]) row["Email"] = member.company_email || "-"
    if (selectedColumns["Additional Email"]) row["Additional Email"] = member.additional_email || "-"
    if (selectedColumns["Department"]) row["Department"] = member.department || "-"
    if (selectedColumns["Role"]) row["Role"] = getRoleDisplayName(member.role)
    if (selectedColumns["Designation"]) row["Designation"] = member.designation || "-"
    if (selectedColumns["Phone Number"]) row["Phone Number"] = member.phone_number || "-"
    if (selectedColumns["Additional Phone"]) row["Additional Phone"] = member.additional_phone || "-"
    if (selectedColumns["Residential Address"]) row["Residential Address"] = member.residential_address || "-"
    if (selectedColumns["Office Location"]) row["Office Location"] = member.office_location || "-"
    if (selectedColumns["Date of Birth"])
      row["Date of Birth"] = formatDateOfBirth(member.date_of_birth, member.birthday) || "-"
    if (selectedColumns["Employment Date"])
      row["Employment Date"] = member.employment_date
        ? formatDDMMYYYY(member.employment_date) || member.employment_date
        : "-"
    if (selectedColumns["Confirmation Date"])
      row["Confirmation Date"] = member.confirmation_date
        ? formatDDMMYYYY(member.confirmation_date) || member.confirmation_date
        : "-"
    if (selectedColumns["Employment Type"]) {
      const type = member.employment_type || "full_time"
      row["Employment Type"] =
        type === "full_time"
          ? "Full Time"
          : type === "part_time"
            ? "Part Time"
            : member.contract_categories?.name || "Contract Staff"
    }
    if (selectedColumns["Contract Category"]) {
      row["Contract Category"] = member.contract_categories?.name
        ? `${member.contract_categories.name} (${member.contract_categories.code})`
        : "-"
    }
    if (selectedColumns["Is Lead"]) row["Is Lead"] = member.is_department_lead ? "Yes" : "No"
    if (selectedColumns["Lead Departments"])
      row["Lead Departments"] = member.lead_departments?.length ? member.lead_departments.join(", ") : "-"
    if (selectedColumns["Created At"]) row["Created At"] = member.created_at ? formatWATDate(member.created_at) : "-"
    return row
  })
}

/** Excel export */
export async function exportEmployeesToExcel(rows: Record<string, unknown>[], filename?: string): Promise<void> {
  try {
    if (rows.length === 0) {
      toast.error("No employees data to export")
      return
    }

    await exportTable(
      rows,
      getRecordExportColumns(rows),
      { filename: filename ?? `employees-export-${toLocalISODate()}` },
      "xlsx",
      { sheetName: "Employees", maxColumnWidth: 60 }
    )
    toast.success("Employees exported to Excel successfully")
  } catch (error: unknown) {
    log.error({ err: String(error) }, "error exporting to excel")
    toast.error("Failed to export employees to Excel")
  }
}

/** PDF export */
export async function exportEmployeesToPDF(
  employees: Employee[],
  opts: ExportOptions,
  filename?: string
): Promise<void> {
  try {
    if (employees.length === 0) {
      toast.error("No employees data to export")
      return
    }

    const rows = buildEmployeeExportRows(employees, opts)
    await exportTable(
      rows,
      getRecordExportColumns(rows),
      { filename: filename ?? `acob-employee-report-${toLocalISODate()}`, title: "ACOB Employee Report" },
      "pdf",
      {
        pdf: {
          orientation: "landscape",
          headingLines: [`Generated on: ${formatWATDate(new Date())}`, `Total Employees: ${employees.length}`],
          startY: 35,
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [34, 197, 94], textColor: 255 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
        },
      }
    )
    toast.success("Employees exported to PDF successfully")
  } catch (error: unknown) {
    log.error({ err: String(error) }, "error exporting to pdf")
    toast.error("Failed to export employees to PDF")
  }
}

/** Word export */
export async function exportEmployeesToWord(rows: Record<string, unknown>[], filename?: string): Promise<void> {
  try {
    if (rows.length === 0) {
      toast.error("No employees data to export")
      return
    }

    const {
      Document,
      Packer,
      Paragraph,

      Table,
      TableCell,
      TableRow,
      WidthType,
      AlignmentType,
      HeadingLevel,
      TextRun,
    } = await import("docx")
    const { default: saveAs } = await import("file-saver")

    const columnKeys = Object.keys(rows[0] || {})

    // Build header row

    const headerCells: any[] = columnKeys.map(
      (column) =>
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: column, bold: true })] })],
        })
    )

    const tableRows = [
      new TableRow({ children: headerCells }),
      ...rows.map((row) => {
        const rowCells: any[] = columnKeys.map(
          (column) => new TableCell({ children: [new Paragraph(String(row[column] ?? "-"))] })
        )
        return new TableRow({ children: rowCells })
      }),
    ]

    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({
              text: "ACOB Employee Report",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `Generated on: ${formatWATDate(new Date())}`,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({
              text: `Total Employees: ${rows.length}`,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: tableRows,
            }),
          ],
        },
      ],
    })

    const blob = await Packer.toBlob(doc)
    const outputFilename = filename ? `${filename}.docx` : `employees-export-${toLocalISODate()}.docx`
    saveAs(blob, outputFilename)
    toast.success("Employee exported to Word successfully")
  } catch (error: unknown) {
    log.error({ err: String(error) }, "error exporting to word")
    toast.error("Failed to export employees to Word")
  }
}
