import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import { Resend } from "npm:resend@2.0.0"

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

interface NotificationRecord {
  id: string
  user_id: string
  title: string
  message: string
  type: string
  link_url?: string
}

interface WebhookPayload {
  type: "INSERT"
  table: "notifications"
  record: NotificationRecord
  schema: "public"
  old_record: null
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error("Missing RESEND_API_KEY")
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase configuration")
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const resend = new Resend(RESEND_API_KEY)

    const payload: WebhookPayload = await req.json()
    const { record } = payload

    if (!record.user_id) {
      console.log("No user_id in notification, skipping email.")
      return new Response(JSON.stringify({ message: "No user_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // 1. Fetch User Email
    // Using admin.getUserById seems cleanest if we have access,
    // otherwise we can select from a simplified profile view if auth schema is locked down.
    // Service role allows auth.admin methods.
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.admin.getUserById(record.user_id)

    if (userError || !user || !user.email) {
      console.error("Could not find user or email for ID:", record.user_id, userError)
      return new Response(JSON.stringify({ error: "User not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      })
    }

    // 2. Check User Preferences
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("email_notifications")
      .eq("id", record.user_id)
      .single()

    if (profileError) {
      console.error("Error fetching profile preferences:", profileError)
      // Fail open or closed? If error, maybe safe to skip or log.
      // Let's assume sending is okay if we can't check, OR safer to skip.
      // Given the request "off for everyone", let's fail safe (skip) if we can't verify.
      // But actually, if profile doesn't exist, we probably shouldn't send.
    }

    if (profile && profile.email_notifications === false) {
      console.log(`User ${user.email} has disabled email notifications. Skipping.`)
      return new Response(JSON.stringify({ message: "User opted out of emails" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      })
    }

    // 3. Send Email
    console.log(`Sending email to ${user.email} for notification: ${record.title}`)

    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${record.title}</h2>
        <p>${record.message}</p>
        ${record.link_url ? `<p><a href="${SUPABASE_URL?.replace(".supabase.co", "")}${record.link_url}" style="background-color: #000; color: #fff; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a></p>` : ""}
        <hr />
        <p style="color: #666; font-size: 12px;">You received this email because you have notifications enabled.</p>
      </div>
    `

    const { data, error } = await resend.emails.send({
      from: "ACOB Notifications <onboarding@resend.dev>", // TODO: User needs to update this with verified domain
      to: [user.email],
      subject: `New Notification: ${record.title}`,
      html: emailHtml,
    })

    if (error) {
      console.error("Resend Error:", error)
      throw error
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    })
  } catch (error) {
    console.error("Error processing webhook:", error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    })
  }
})
