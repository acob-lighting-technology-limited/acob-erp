import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { Resend } from "npm:resend@2.0.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
const DB_TRIGGER_SECRET = Deno.env.get("DB_TRIGGER_SECRET")
const LEGACY_TRIGGER_SECRET = Deno.env.get("LEGACY_TRIGGER_SECRET")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders })

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!)
    const resend = new Resend(RESEND_API_KEY!)
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET")
    const signature = req.headers.get("x-webhook-secret")
    const authHeader = req.headers.get("Authorization")

    // Auth Check
    const bearerToken = authHeader?.replace("Bearer ", "")
    const isServiceRole = bearerToken === SUPABASE_SERVICE_ROLE_KEY
    const isSecretValid =
      (webhookSecret && signature === webhookSecret) ||
      signature === DB_TRIGGER_SECRET ||
      signature === LEGACY_TRIGGER_SECRET

    if (!isServiceRole && !isSecretValid) {
      console.error(`[AUTH] Unauthorized webhook signature. Signature prefix: ${signature?.slice(0, 5) ?? "none"}`)
      return new Response("Unauthorized", { status: 401 })
    }

    console.log(`[INFO] Received notification request. Type: ${req.headers.get("Content-Type")}`)

    const payload = await req.json()
    const record = payload.record
    if (!record?.user_id) return new Response("Missing user_id", { status: 200 })

    let notificationData = {}
    try {
      notificationData = typeof record.data === "string" ? JSON.parse(record.data) : record.data || {}
    } catch {
      console.warn("[WARN] Failed to parse record.data, using empty object")
    }
    const assetCode = (notificationData as any).asset_code || (notificationData as any).unique_code

    // 1. Fetch User (Recipient)
    const { data: recipientUser, error: userError } = await supabase.auth.admin.getUserById(record.user_id)
    if (userError || !recipientUser.user.email) return new Response("User not found or no email", { status: 200 })
    const email = recipientUser.user.email

    const { data: recipientProfile } = await supabase
      .from("profiles")
      .select("full_name, department")
      .eq("id", record.user_id)
      .single()

    const recipientName = recipientProfile?.full_name || "Staff Member"
    const recipientFirstName = recipientName.split(" ")[0]
    const recipientDept = recipientProfile?.department || "Unassigned"

    // 2. Fetch Asset & Assignment Data
    let assetType = "Asset"
    let assetModel = "Unknown"
    let serialNumber = "N/A"
    let assetName = "Asset"
    let assignedByName = "System Admin"
    let assignedDate = new Date().toLocaleDateString("en-GB")

    if (assetCode) {
      const { data: assetData } = await supabase
        .from("assets")
        .select("asset_type, asset_model, serial_number, asset_name")
        .eq("unique_code", assetCode)
        .single()

      if (assetData) {
        assetName = assetData.asset_name || assetData.asset_model || "Asset"
        // Get Friendly Label for Type
        const { data: typeData } = await supabase
          .from("asset_types")
          .select("label")
          .eq("code", assetData.asset_type)
          .single()
        assetType = typeData?.label || assetData.asset_type || "Asset"
        assetModel = assetData.asset_model || "Unknown"
        serialNumber = assetData.serial_number || "N/A"
      }

      // Try fetch specific assignment if possible
      if ((notificationData as any).assigned_by || (notificationData as any).actor_id) {
        const actorId = (notificationData as any).assigned_by || (notificationData as any).actor_id

        // If it's a UUID, fetch the name. If it's already a name, use it.
        const isUuid = typeof actorId === "string" && actorId.length === 36 && actorId.includes("-")

        if (isUuid) {
          const { data: actorProfile } = await supabase.from("profiles").select("full_name").eq("id", actorId).single()
          if (actorProfile) {
            assignedByName = actorProfile.full_name
          }
        } else if (actorId) {
          assignedByName = actorId
        }
      }
    }

    // 3. Configure Email Content based on Type
    const emailType = record.type || "asset_assigned"
    console.log(`Processing ${emailType} for ${email}. Assigner: ${assignedByName}`)

    let subject = "Asset Notification"
    let title = "Asset Notification"
    let introText = "You have a new asset notification."
    let headerText = "Details"
    let headerColorClass = "status-header-neutral"
    const ctaText = "View My Assets"
    const ctaUrl = "https://erp.acoblighting.com/portal/assets"
    const supportText =
      'If you experience any issue, please contact <br><a href="mailto:ict@acoblighting.com">ict@acoblighting.com</a>'

    switch (emailType) {
      case "asset_assigned":
      case "asset_assignment":
        subject = `Asset Officially Assigned - ${assetCode}`
        title = "Asset Officially Assigned"
        introText =
          "This is to officially notify you that an organizational asset has been assigned to you. Kindly review the details below."
        headerText = "Assignment Details"
        headerColorClass = "status-header-neutral"
        break

      case "asset_transfer_outgoing":
        subject = `Asset Transfer Initiated - ${assetCode}`
        title = "Asset Transfer Initiated"
        introText = "This asset has been transferred from your custody. It is no longer assigned to your account."
        headerText = "Transfer Details"
        headerColorClass = "status-header-neutral"
        break

      case "asset_transfer_incoming":
        subject = `Asset Transfer Received - ${assetCode}`
        title = "Asset Transfer Received"
        introText = "An asset has been transferred to your custody. You are now responsible for this item."
        headerText = "Incoming Transfer"
        headerColorClass = "status-header-success"
        break

      case "asset_returned":
        subject = `Asset Officially Returned - ${assetCode}`
        title = "Asset Officially Returned"
        introText =
          "We confirm that you have returned the following asset. It has been successfully unassigned from your account."
        headerText = "Return Receipt"
        headerColorClass = "status-header-neutral"
        break

      case "asset_status_alert":
        subject = `Asset Status Alert - ${assetCode}`
        title = "Asset Status Alert"
        introText = `The status of the following asset has been updated to <strong>${((notificationData as any).status_action || "REPORTED").toUpperCase()}</strong>.`
        headerText = "Status Change: Alert"
        headerColorClass = "status-header-alert"
        break

      case "asset_status_fixed":
      case "system_restored":
        subject = `Asset Status Restored - ${assetCode}`
        title = "Asset Status Restored"
        introText = "The following asset has been repaired and is now fully <strong>OPERATIONAL</strong>."
        headerText = "Status Change: Operational"
        headerColorClass = "status-header-success"
        break
    }

    // 4. Construct HTML
    const row = (label: string, value: string, isCode = false, isMono = false) => {
      const displayValue = isCode ? `<span class="asset-code">${value}</span>` : value
      return `
        <tr>
            <td class="label">${label}</td>
            <td class="value"${isMono ? ' style="font-family:monospace;"' : ""}>
                ${displayValue}
            </td>
        </tr>`
    }

    // Base rows for ALL emails
    let tableRows = `
        ${row("Asset Code", assetCode || "N/A", true)}
        ${row("Asset Type", assetType)}
        ${row("Model", assetModel)}
        ${row("Serial Number", serialNumber, false, true)}
        ${row("Assigned To", recipientName)}
        ${row("Department", recipientDept)}
        ${row("Email Address", email)}
    `

    // Specific rows appended after base rows
    if (emailType === "asset_transfer_outgoing") {
      tableRows += row("Authorized By", (notificationData as any).authorized_by || assignedByName)
      tableRows += row("Transfer Date", assignedDate)
    } else if (emailType === "asset_transfer_incoming") {
      tableRows += row("Condition", (notificationData as any).condition || "Good / Working")
      tableRows += row("Assigned By", assignedByName)
      tableRows += row("Assigned Date", assignedDate)
    } else if (emailType === "asset_returned") {
      tableRows += row("Returned By", recipientName)
      tableRows += row("Authorized By", (notificationData as any).authorized_by || assignedByName)
      tableRows += row("Return Date", assignedDate)
    } else if (emailType === "asset_status_alert") {
      tableRows += row(
        "Status Note",
        (notificationData as any).status_description || (notificationData as any).status_action || "Updated",
        false,
        false
      )
      tableRows += row("Reported By", (notificationData as any).reported_by || assignedByName)
      tableRows += row("Date", assignedDate)
    } else if (emailType === "asset_status_fixed") {
      tableRows += row("Resolution Note", (notificationData as any).resolution_note || "Issue Resolved", false, false)
      tableRows += row("Date", assignedDate)
    } else {
      // Default: Initial Assignment
      tableRows += row("Assigned By", assignedByName)
      tableRows += row("Assigned Date", assignedDate)
    }

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { margin: 0; padding: 0; background: #fff; font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; }
        .outer-header { background: #000; width: 100%; padding: 20px 0; text-align: center; border-bottom: 3px solid #16a34a; }
        .wrapper { max-width: 600px; margin: 0 auto; background: #fff; padding: 32px 28px; }
        .title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 14px; }
        .text { font-size: 15px; color: #374151; line-height: 1.6; margin: 0 0 18px 0; }
        .card { margin-top: 22px; border: 1px solid #d1d5db; overflow: hidden; background: #f9fafb; }
        .card-header { padding: 12px 18px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; border-bottom: 1px solid #d1d5db; }
        .status-header-success { background: #dcfce7; color: #166534; border-bottom-color: #bbf7d0; }
        .status-header-alert { background: #fee2e2; color: #991b1b; border-bottom-color: #fecaca; }
        .status-header-neutral { background: #eff6ff; color: #1e40af; border-bottom-color: #bfdbfe; }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 12px 18px; font-size: 14px; border-bottom: 1px solid #d1d5db; }
        tr:last-child td { border-bottom: none; }
        .label { width: 40%; color: #4b5563; font-weight: 500; border-right: 1px solid #d1d5db; }
        .value { color: #111827; font-weight: 600; }
        .asset-code { background: #000; color: #fff; font-family: monospace; padding: 4px 8px; border-radius: 4px; font-size: 12px; letter-spacing: .5px; }
        .cta { text-align: center; margin-top: 32px; }
        .button { display: inline-block; background: #000; color: #fff; text-decoration: none; padding: 14px 32px; border-radius: 6px; font-weight: 600; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; }
        .support { text-align: center; font-size: 14px; color: #4b5563; margin-top: 24px; line-height: 1.5; }
        .support a { color: #16a34a; font-weight: 600; text-decoration: none; }
        .footer { background: #000; padding: 20px; text-align: center; font-size: 11px; color: #9ca3af; border-top: 3px solid #16a34a; }
        .footer strong { color: #fff; }
        .footer-system { color: #16a34a; font-weight: 600; }
        .footer-note { color: #9ca3af; font-style: italic; }
    </style>
</head>
<body>
    <div class="outer-header">
        <img src="https://erp.acoblighting.com/images/acob-logo-dark.webp" height="40" alt="ACOB Lighting">
    </div>
    <div class="wrapper">
        <div class="title" style="${emailType === "asset_status_alert" ? "color: #991b1b;" : emailType === "asset_status_fixed" || emailType === "asset_transfer_incoming" ? "color: #166534;" : ""}">
            ${title}
        </div>
        <p class="text">Dear ${recipientFirstName},</p>
        <p class="text">${introText}</p>
        <div class="card">
            <div class="card-header ${headerColorClass}">${headerText}</div>
            <table>
                ${tableRows}
            </table>
        </div>

        <div class="support">${supportText}</div>
    </div>
    <div class="footer">
        <strong>ACOB Lighting Technology Limited</strong><br>
        ACOB Admin & HR Department<br>
        <span class="footer-system">Asset Management System</span>
        <br><br>
        <i class="footer-note">This is an automated system notification. Please do not reply directly to this email.</i>
    </div>
</body>
</html>`

    const { error } = await resend.emails.send({
      from: "ACOB Admin & HR <notifications@acoblighting.com>",
      to: email,
      subject: subject,
      html: emailHtml,
    })

    if (error) {
      console.error(`[Resend Error] Failed to send email to user ${record.user_id}:`, JSON.stringify(error))
      return new Response(JSON.stringify(error), { status: 400 })
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (err: any) {
    console.error("Global Error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    })
  }
})
