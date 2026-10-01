import { escapeHtml } from "./utils"

export interface OnboardingIctSetupEmailProps {
  employee: {
    first_name: string
    last_name: string
    department: string
    designation: string
    company_email: string
    employee_number?: string | null
    office_location?: string | null
  }
  approvedBy?: {
    name?: string | null
    designation?: string | null
    department?: string | null
  }
  employeesUrl?: string
}

function row(label: string, value: string, last = false) {
  const border = last ? "" : " border-bottom: 1px solid #e5e7eb;"
  return `
                <tr>
                    <td style="width: 35%; color: #64748b; font-weight: 500; border-right: 1px solid #e5e7eb; padding: 12px 18px; font-size: 13px;${border}">${label}</td>
                    <td style="color: #0f172a; font-weight: 600; padding: 12px 18px; font-size: 13px;${border}">${value}</td>
                </tr>`
}

/**
 * Sent to the ICT inbox when HR approves an onboarding application: create the
 * official mailbox, then send the credentials from the employee's record in
 * Matrix (which mails the employee and notifies HCS, HR and their lead).
 */
export function renderOnboardingIctSetupEmail({
  employee,
  approvedBy,
  employeesUrl,
}: OnboardingIctSetupEmailProps): string {
  const name = `${escapeHtml(employee.first_name)} ${escapeHtml(employee.last_name)}`
  const companyEmail = escapeHtml(employee.company_email)
  const approvedByName = escapeHtml((approvedBy?.name || "Admin and HR Lead").trim())
  const approvedByDesignation = escapeHtml((approvedBy?.designation || "").trim())
  const approvedByDepartment = escapeHtml((approvedBy?.department || "Admin and HR").trim())
  const actionUrl = escapeHtml(
    employeesUrl || `${process.env.NEXT_PUBLIC_PORTAL_URL || "https://matrix.acoblighting.com"}/admin/hr/employees`
  )

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Webmail Setup Required</title>
    <style>
        body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
    </style>
</head>
<body>
    <div style="max-width: 600px; margin: 0 auto; overflow: hidden;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;">
        <tr><td align="center" style="padding:20px 0;background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;">
            <img src="https://matrix.acoblighting.com/images/acob-logo-dark.png" alt="ACOB Lighting" height="65">
        </td></tr>
    </table>
    <div style="max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px;">
        <div style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 12px;">Webmail Setup Required</div>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">Dear ICT Team,</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">The onboarding application for <strong>${name}</strong> has been approved. Please create their official company mailbox on webmail.</p>
        <p style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 20px 0;">Once the mailbox exists, open the employee in Matrix and use <strong>Send Webmail Credentials</strong> with the password you set. That sends the employee their onboarding email and notifies HCS, Admin &amp; HR and their department lead.</p>

        <div style="margin-top: 20px; border: 1px solid #e5e7eb; overflow: hidden; background: #fbfbfb; border-radius: 6px;">
            <div style="padding: 12px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #e5e7eb; background: #f8fafc; color: #64748b;">Mailbox Details</div>
            <table style="width: 100%; border-collapse: collapse;">${row("Mailbox to Create", companyEmail)}${row("Employee Name", name)}${row(
              "Employee ID",
              employee.employee_number ? escapeHtml(employee.employee_number) : "N/A"
            )}${row("Department", escapeHtml(employee.department))}${row("Designation", escapeHtml(employee.designation))}${row(
              "Office / Room",
              employee.office_location ? escapeHtml(employee.office_location) : "N/A",
              true
            )}
            </table>
        </div>

        <div style="text-align: center; margin-top: 28px; margin-bottom: 8px;">
            <a href="${actionUrl}"
               style="display: inline-block; background: #000000; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                Open Employees
            </a>
        </div>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;border-top:3px solid #16a34a;border-bottom:3px solid #16a34a;mso-line-height-rule:exactly;">
        <tr><td align="center" style="padding:20px;background:#000000 !important;background-color:#000000 !important;background-image:linear-gradient(#000000,#000000) !important;font-size:11px;color:#d1d5db;">
            <span style="color:#f3f4f6;">Approved by ${approvedByName}</span><br>
            ${approvedByDesignation ? `<span style="color:#d1d5db;">${approvedByDesignation}</span><br>` : ""}
            <span style="color:#d1d5db;">${approvedByDepartment}</span><br>
            <strong style="color:#fff;">ACOB Lighting Technology Limited</strong><br>
            <span style="color:#16a34a; font-weight:600;">Employee Management System</span>
            <br><br>
            <i style="color:#9ca3af; font-style:italic;">This is an automated notification, but replies are read — reply to this email to reach the HR team.</i>
        </td></tr>
    </table>
    </div>
</body>
</html>
`
}
