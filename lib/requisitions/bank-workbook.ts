import JSZip from "jszip"
import { bankDate, bankFileRows, BANK_FILE_HEADERS } from "./bank-file"
import type { PaymentScheduleItem } from "./types"

/**
 * The bank's bulk-upload workbook, written by hand so the long column titles
 * wrap inside a tall header row and can be read. Account numbers, references
 * and dates are stored as text (leading zeros survive); amounts have two
 * decimals. One sheet, titles on row 1, one payment per row from row 2, as the
 * bank's template has it.
 */
const SHEET_NAME = "BANK UPLOAD SCHEDULE"

const COLUMN_WIDTHS = [30, 28, 26, 28, 34, 24, 40, 26]

/** Tall enough for the longest title (the sort-code note) at its column width. */
const HEADER_HEIGHT_PT = 175

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // XML 1.0 forbids most control characters.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")

const COLUMN_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const

function textCell(ref: string, style: number, value: string) {
  return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`
}

function numberCell(ref: string, style: number, value: number) {
  return `<c r="${ref}" s="${style}"><v>${value}</v></c>`
}

// cellXfs: 0 default · 1 header (bold, wrapped, boxed, shaded) · 2 text · 3 amount 0.00 · 4 whole number
const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="0.00"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF4"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF9AA5B1"/></left><right style="thin"><color rgb="FF9AA5B1"/></right><top style="thin"><color rgb="FF9AA5B1"/></top><bottom style="thin"><color rgb="FF9AA5B1"/></bottom><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="5">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`

export function bankSheetXml(
  items: Pick<
    PaymentScheduleItem,
    "transaction_ref" | "account_name" | "amount" | "beneficiary_code" | "account_number" | "bank_code"
  >[],
  paymentDate: string,
  debitAccount: string
): string {
  const rows = bankFileRows(items, paymentDate, debitAccount)
  const header = `<row r="1" ht="${HEADER_HEIGHT_PT}" customHeight="1">${BANK_FILE_HEADERS.map((title, i) =>
    textCell(`${COLUMN_LETTERS[i]}1`, 1, title)
  ).join("")}</row>`

  const body = rows
    .map((r, i) => {
      const n = i + 2
      return `<row r="${n}">${[
        textCell(`A${n}`, 2, r.reference),
        textCell(`B${n}`, 2, r.name),
        numberCell(`C${n}`, 3, r.amount),
        textCell(`D${n}`, 2, bankDate(r.dueDate)),
        textCell(`E${n}`, 2, r.beneficiaryCode),
        textCell(`F${n}`, 2, r.accountNumber),
        numberCell(`G${n}`, 4, r.sortCode),
        numberCell(`H${n}`, 4, Number(r.debitAccount)),
      ].join("")}</row>`
    })
    .join("")

  const cols = COLUMN_WIDTHS.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${header}${body}</sheetData>
</worksheet>`
}

export async function buildBankWorkbookFile(
  items: Parameters<typeof bankSheetXml>[0],
  paymentDate: string,
  debitAccount: string
): Promise<Buffer> {
  const zip = new JSZip()
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`
  )
  zip.file(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  )
  zip.file(
    "xl/workbook.xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`
  )
  zip.file(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`
  )
  zip.file("xl/styles.xml", STYLES_XML)
  zip.file("xl/worksheets/sheet1.xml", bankSheetXml(items, paymentDate, debitAccount))
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" })
}
