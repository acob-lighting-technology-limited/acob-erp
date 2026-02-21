import { escapeHtml } from "./utils"
import { type PendingUser } from "./welcome"

interface InternalNotificationEmailProps {
  pendingUser: PendingUser
  employeeId: string
}

export function renderInternalNotificationEmail({ pendingUser, employeeId }: InternalNotificationEmailProps) {
  const firstName = escapeHtml(pendingUser.first_name)
  const lastName = escapeHtml(pendingUser.last_name)
  const dept = escapeHtml(pendingUser.department)
  const email = escapeHtml(pendingUser.company_email)
  const workLoc = escapeHtml(pendingUser.current_work_location)
  const officeLoc = pendingUser.office_location ? escapeHtml(pendingUser.office_location) : ""
  const empId = escapeHtml(employeeId)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Employee Onboarding Notification</title>
    <style>
        body { margin: 0; padding: 0; background: #f3f4f6; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
        .email-shell { max-width: 600px; margin: 0 auto; overflow: hidden; }
        .outer-header { background: #0f2d1f; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }
        .title { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px; }
        .text { font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 18px 0; }
        .card { margin-top: 22px; border: 1px solid #e5e7eb; overflow: hidden; background: #fbfbfb; border-radius: 6px; }
        .card-header { padding: 12px 18px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #e5e7eb; background: #f8fafc; color: #64748b; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 18px; font-size: 13px; border-bottom: 1px solid #e5e7eb; }
        tr:last-child td { border-bottom: none; }
        .label { width: 35%; color: #64748b; font-weight: 500; border-right: 1px solid #e5e7eb; }
        .value { color: #0f172a; font-weight: 600; }
        .cta { text-align: center; margin-top: 32px; }
        .button { display: inline-block; background: #16a34a; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 13px; }
        .footer { background: #0f2d1f; padding: 40px 0; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
    </style>
</head>
<body>
    <div class="email-shell">
    <div class="outer-header" style="background-color:#0f2d1f;">
        <img src="https://erp.acoblighting.com/images/acob-logo-dark.png" alt="ACOB Lighting" height="35">
    </div>
    <div class="wrapper">
        <div class="title">New Employee Onboarded</div>
        <p class="text">Hello Team,</p>
        <p class="text">This is an automated notification that a new employee has been successfully approved and added to the system.</p>
        
        <div class="card">
            <div class="card-header">Onboarding Details</div>
            <table>
                <tr>
                    <td class="label">Employee Name</td>
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
                    <td class="label">Official Email</td>
                    <td class="value">${email}</td>
                </tr>
                <tr>
                    <td class="label">Work Location</td>
                    <td class="value">
                        ${workLoc}
                        ${officeLoc && officeLoc !== workLoc ? `(${officeLoc})` : ""}
                    </td>
                </tr>
                <tr>
                    <td class="label">Approved Date</td>
                    <td class="value">${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</td>
                </tr>
            </table>
        </div>


    </div>
    <div class="footer" style="background-color:#0f2d1f;">
        <strong style="color: #fff;">ACOB Lighting Technology Limited</strong><br>
        <span style="color: #16a34a; font-weight: 600; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">ACOB Admin & HR</span>
        <div style="margin-top: 12px; font-style: italic; font-size: 10px; opacity: 0.7; max-width: 500px; margin-left: auto; margin-right: auto; padding: 0 20px;">
            This is an automated system notification. Please do not reply directly to this email.
        </div>
    </div>
    </div>
</body>
</html>
  `
}
