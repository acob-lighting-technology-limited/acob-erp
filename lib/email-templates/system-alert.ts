import { escapeHtml } from "./utils"

export interface SystemAlertTable {
  heading?: string
  headers: string[]
  rows: string[][]
}

interface SystemAlertEmailProps {
  title: string
  /** Plain-text paragraphs, escaped here. */
  paragraphs: string[]
  tables?: SystemAlertTable[]
}

const DARK_LOCK =
  "background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;"

function bar(content: string, padding: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="${DARK_LOCK}border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;"><tr><td align="center" style="padding:${padding};${DARK_LOCK}font-size:11px;color:#d1d5db;">${content}</td></tr></table>`
}

function renderTable(table: SystemAlertTable): string {
  const cell = "padding:6px 8px;border:1px solid #e5e7eb;font-size:12px;vertical-align:top;text-align:left;"
  const head = table.headers.map((h) => `<th style="${cell}background:#f3f4f6;">${escapeHtml(h)}</th>`).join("")
  const body = table.rows
    .map((row) => `<tr>${row.map((value) => `<td style="${cell}">${escapeHtml(value)}</td>`).join("")}</tr>`)
    .join("")
  const heading = table.heading
    ? `<div style="font-size:14px;font-weight:600;color:#111827;margin:20px 0 8px;">${escapeHtml(table.heading)}</div>`
    : ""
  return `${heading}<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;width:100%;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

/** Branded operational alert: a red title, a few paragraphs and optional data tables. */
export function renderSystemAlertEmail({ title, paragraphs, tables = [] }: SystemAlertEmailProps): string {
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head>' +
    '<body style="margin:0;padding:0;background:#fff;font-family:Segoe UI, Tahoma, Geneva, Verdana, sans-serif;">' +
    '<div style="max-width:720px;margin:0 auto;">' +
    bar(
      '<img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" height="60" alt="ACOB Lighting">',
      "20px 0"
    ) +
    '<div style="padding:28px 24px;">' +
    `<div style="font-size:20px;font-weight:700;color:#991b1b;margin:0 0 12px;">${escapeHtml(title)}</div>` +
    paragraphs
      .map((p) => `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 10px;">${escapeHtml(p)}</p>`)
      .join("") +
    tables.map(renderTable).join("") +
    "</div>" +
    bar(
      '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br><span style="color:#16a34a;font-weight:600;">IT &amp; Communications</span><br><br><i style="color:#9ca3af;">This is an automated notification.</i>',
      "20px"
    ) +
    "</div></body></html>"
  )
}
