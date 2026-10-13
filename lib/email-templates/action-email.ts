import { escapeHtml } from "./utils"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://matrix.acoblighting.com"

const BAND =
  'bgcolor="#000000" style="background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;"'

function detailRow(label: string, value: string, last: boolean): string {
  const border = last ? "" : "border-bottom: 1px solid #e5e7eb;"
  return (
    "<tr>" +
    `<td style="width: 35%; color: #64748b; font-weight: 500; border-right: 1px solid #e5e7eb; padding: 12px 18px; font-size: 13px; ${border}">${escapeHtml(label)}</td>` +
    `<td style="color: #0f172a; font-weight: 600; padding: 12px 18px; font-size: 13px; ${border}">${escapeHtml(value)}</td>` +
    "</tr>"
  )
}

/**
 * The house email for "something needs you": heading, greeting, one paragraph,
 * a details table and one button. Same look as the task emails.
 */
export function renderActionEmail(params: {
  recipientFirstName: string
  heading: string
  intro: string
  detailsTitle: string
  details: Array<[string, string]>
  ctaLabel: string
  ctaPath: string
  footerLabel: string
}): string {
  const rows = params.details.map(([label, value], index) =>
    detailRow(label, value, index === params.details.length - 1)
  )
  return (
    "<!DOCTYPE html>" +
    '<html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    `<title>${escapeHtml(params.heading)}</title>` +
    '<style>body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }</style>' +
    "</head><body>" +
    '<div style="max-width: 600px; margin: 0 auto; overflow: hidden;">' +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${BAND}>` +
    '<tr><td align="center" style="padding:20px 0;">' +
    '<img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" height="65" alt="ACOB Lighting">' +
    "</td></tr></table>" +
    '<div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px;">' +
    `<div style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px;">${escapeHtml(params.heading)}</div>` +
    `<p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0;">Hi ${escapeHtml(params.recipientFirstName || "there")},</p>` +
    `<p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0;">${escapeHtml(params.intro)}</p>` +
    '<div style="margin-top: 22px; border: 1px solid #e5e7eb; overflow: hidden; background: #fbfbfb; border-radius: 6px;">' +
    `<div style="padding: 12px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #e5e7eb; background: #f8fafc; color: #64748b;">${escapeHtml(params.detailsTitle)}</div>` +
    `<table style="width: 100%; border-collapse: collapse;">${rows.join("")}</table>` +
    "</div>" +
    '<div style="text-align: center; margin: 28px 0;">' +
    `<a href="${SITE_URL}${params.ctaPath}" style="display: inline-block; background: #166534; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px;">${escapeHtml(params.ctaLabel)}</a>` +
    "</div></div>" +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" ${BAND}>` +
    '<tr><td align="center" style="padding:20px;font-size:11px;color:#d1d5db;">' +
    '<strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>' +
    `<span style="color:#16a34a;font-weight:600;">${escapeHtml(params.footerLabel)}</span>` +
    "<br><br>" +
    '<i style="color:#9ca3af;">This is an automated notification.</i>' +
    "</td></tr></table>" +
    "</div></body></html>"
  )
}
