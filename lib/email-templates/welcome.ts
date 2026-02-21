import { escapeHtml } from "./utils"

export interface PendingUser {
  first_name: string
  last_name: string
  department: string
  company_role: string
  company_email: string
  personal_email: string
  current_work_location: string
  office_location?: string
}

interface WelcomeEmailProps {
  pendingUser: PendingUser
  employeeId: string
  setupUrl: string
}

export function renderWelcomeEmail({ pendingUser, employeeId, setupUrl }: WelcomeEmailProps) {
  const firstName = escapeHtml(pendingUser.first_name)
  const lastName = escapeHtml(pendingUser.last_name)
  const dept = escapeHtml(pendingUser.department)
  const role = escapeHtml(pendingUser.company_role)
  const email = escapeHtml(pendingUser.company_email)
  const workLoc = escapeHtml(pendingUser.current_work_location)
  const officeLoc = pendingUser.office_location ? escapeHtml(pendingUser.office_location) : ""
  const empId = escapeHtml(employeeId)
  const safeSetupUrl = escapeHtml(setupUrl)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to ACOB Lighting</title>
    <style>
        body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
        .email-shell { max-width: 600px; margin: 0 auto; overflow: hidden; }
        .outer-header { background: #0f2d1f; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }
        .title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 14px; }
        .text { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 18px 0; }
        .card { margin-top: 22px; border: 1px solid #d1d5db; overflow: hidden; background: #f9fafb; }
        .card-header { padding: 12px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #d1d5db; }
        .status-header-neutral { background: #eff6ff; color: #1e40af; border-bottom-color: #bfdbfe; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 18px; font-size: 14px; border-bottom: 1px solid #d1d5db; }
        tr:last-child td { border-bottom: none; }
        .label { width: 40%; color: #4b5563; font-weight: 500; border-right: 1px solid #d1d5db; }
        .value { color: #111827; font-weight: 600; }
        .credential { background: #e5e7eb; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 13px; border: 1px solid #d1d5db; }
        .cta { text-align: center; margin-top: 32px; }
        .button { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }
        .support a { color: #16a34a; font-weight: 600; text-decoration: none; }
        .footer { background: #0f2d1f; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
        .footer strong { color: #fff; }
        .footer-system { color: #16a34a; font-weight: 600; }
        .footer-note { color: #9ca3af; font-style: italic; }
    </style>
</head>
<body>
    <div class="email-shell">
    <div class="outer-header" style="background-color:#0f2d1f;">
        <img src="https://erp.acoblighting.com/images/acob-logo-dark.png" alt="ACOB Lighting" height="40">
    </div>
    <div class="wrapper">
        <div class="title">Welcome to the Team</div>
        <p class="text">Dear ${firstName},</p>
        <p class="text">We are thrilled to welcome you to the team at ACOB Lighting Technology Limited.</p>
        <p class="text">An official employee account has been created for you. Please find your login credentials and details below.</p>
        
        <div class="card">
            <div class="card-header status-header-neutral">Employee Profile</div>
            <table>
                <tr>
                    <td class="label">Full Name</td>
                    <td class="value">${firstName} ${lastName}</td>
                </tr>
                 <tr>
                    <td class="label">Employee ID</td>
                    <td class="value">${empId}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">${dept}</td>
                </tr>
                <tr>
                    <td class="label">Role</td>
                    <td class="value">${role}</td>
                </tr>
                <tr>
                    <td class="label">Work Location</td>
                    <td class="value">
                        ${workLoc}
                        ${officeLoc && officeLoc !== workLoc ? `(${officeLoc})` : ""}
                    </td>
                </tr>
            </table>
        </div>

        <div class="card" style="margin-top: 20px;">
            <div class="card-header status-header-neutral" style="background: #f0fdf4; color: #15803d; border-bottom-color: #bbf7d0;">Account Activation</div>
            <table>
                <tr>
                    <td class="label">Setup URL</td>
                    <td class="value"><a href="${safeSetupUrl}" style="color: #16a34a; text-decoration: none; font-weight: 700;">ACTIVATE MY ACCOUNT</a></td>
                </tr>
                <tr>
                    <td class="label">Company Email</td>
                    <td class="value"><span class="credential">${email}</span></td>
                </tr>
            </table>
        </div>

        <div class="cta">
            <a href="${safeSetupUrl}" class="button">Set Up Password</a>
        </div>
        <div class="support">
            Please log in and change your password immediately.<br>
            If you have any questions, contact <a href="mailto:ict@acoblighting.com">ict@acoblighting.com</a>
        </div>
    </div>
    <div class="footer" style="background-color:#0f2d1f;">
        <strong>ACOB Lighting Technology Limited</strong><br>
        ACOB Internal Systems – Admin & HR Department<br>
        <span class="footer-system">Employee Management System</span>
        <br><br>
        <i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>
    </div>
    </div>
</body>
</html>
  `
}
