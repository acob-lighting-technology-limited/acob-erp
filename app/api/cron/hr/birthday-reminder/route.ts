import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isCronRequest } from "@/lib/security/bearer-auth"
import { logger } from "@/lib/logger"
import { toLocalISODate } from "@/lib/utils/date"
import { birthdayWeekOf } from "@/lib/hr/birthdays"
import { BIRTHDAY_REMINDER_SETTINGS_KEY, parseBirthdayReminderConfig } from "@/lib/hr/birthday-reminder"
import { renderActionEmail } from "@/lib/email-templates/action-email"
import { isSystemNotificationChannelEnabled } from "@/lib/notifications/delivery-policy"
import { sendNotificationEmailWithRetry } from "@/lib/notifications/email-gateway"
import { ORG_EMAIL_SENDERS, ORG_MAIL_ROUTING } from "@/lib/org-config"

const log = logger("cron-hr-birthday-reminder")

/**
 * Monday birthday reminder.
 *
 * Runs at 00:00 WAT on Mondays, with a 07:00 WAT rerun in case the first call
 * failed. Emails each configured recipient the week's
 * birthdays (Monday to Sunday), one email per person so the greeting is theirs.
 * A week with no birthdays sends nothing.
 *
 * Idempotent per week: lastSentWeek in the setting records the Monday it went
 * out, so a retry or a manual rerun the same week sends nothing new.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Missing configuration" }, { status: 500 })
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { data: setting, error: settingError } = await supabase
      .from("system_settings")
      .select("value")
      .eq("key", BIRTHDAY_REMINDER_SETTINGS_KEY)
      .maybeSingle()
    if (settingError) throw settingError

    const config = parseBirthdayReminderConfig(setting?.value)
    const week = birthdayWeekOf(toLocalISODate())
    if (!config.enabled) return NextResponse.json({ data: { skipped: "disabled" } })
    if (config.lastSentWeek === week.monday) return NextResponse.json({ data: { skipped: "already_sent" } })
    if (!(await isSystemNotificationChannelEnabled(supabase, "birthdays", "email"))) {
      return NextResponse.json({ data: { skipped: "birthday_email_disabled" } })
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("first_name, last_name, department, birthday")
      .eq("employment_status", "active")
      .in(
        "birthday",
        week.days.map((day) => day.mmdd)
      )
    if (profilesError) throw profilesError

    const dayByMMDD = new Map(week.days.map((day, index) => [day.mmdd, { ...day, index }]))
    const celebrants = (profiles || [])
      .map((p) => ({
        name: [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unnamed",
        department: p.department || "Organization",
        day: dayByMMDD.get(p.birthday as string)!,
      }))
      .sort((a, b) => a.day.index - b.day.index || a.name.localeCompare(b.name))
    if (celebrants.length === 0) return NextResponse.json({ data: { skipped: "no_birthdays", week: week.monday } })

    const recipients: Array<{ email: string; firstName: string }> = config.externalEmails.map((email) => ({
      email,
      firstName: "",
    }))
    if (config.recipientUserIds.length > 0) {
      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("first_name, company_email, additional_email, employment_status")
        .in("id", config.recipientUserIds)
      if (peopleError) throw peopleError
      for (const person of people || []) {
        const email = person.company_email || person.additional_email
        if (email && person.employment_status !== "exited") {
          recipients.push({ email, firstName: person.first_name || "" })
        }
      }
    }
    if (recipients.length === 0) return NextResponse.json({ data: { skipped: "no_recipients" } })

    const count = `${celebrants.length} birthday${celebrants.length === 1 ? "" : "s"}`
    const subject = `Birthdays this week: ${week.label}`
    let sent = 0
    for (const recipient of recipients) {
      const result = await sendNotificationEmailWithRetry({
        to: [recipient.email],
        subject,
        from: ORG_EMAIL_SENDERS.system,
        ...ORG_MAIL_ROUTING.Birthday,
        html: renderActionEmail({
          recipientFirstName: recipient.firstName,
          heading: "Birthdays this week",
          intro: `There ${celebrants.length === 1 ? "is" : "are"} ${count} this week (${week.label}).`,
          detailsTitle: `Week of ${week.label}`,
          details: celebrants.map((c) => [c.day.label, `${c.name} · ${c.department}`]),
          ctaLabel: "Open Birthday Spotlight",
          ctaPath: "/birthday",
          footerLabel: "Human Resources",
        }),
      })
      if (result.sent) sent++
      else log.warn({ reason: result.reason, error: "error" in result ? result.error : undefined }, "send failed")
    }

    // Record the week only once someone has it, so the 07:00 rerun retries a failed send.
    if (sent > 0) {
      const { error: saveError } = await supabase
        .from("system_settings")
        .update({ value: { ...config, lastSentWeek: week.monday } })
        .eq("key", BIRTHDAY_REMINDER_SETTINGS_KEY)
      if (saveError) log.error({ err: saveError.message }, "Could not record the sent week")
    }

    return NextResponse.json({
      data: { week: week.monday, celebrants: celebrants.length, recipients: recipients.length, sent },
    })
  } catch (error) {
    log.error({ err: error instanceof Error ? error.message : String(error) }, "Birthday reminder failed")
    return NextResponse.json({ error: "Birthday reminder failed" }, { status: 500 })
  }
}
