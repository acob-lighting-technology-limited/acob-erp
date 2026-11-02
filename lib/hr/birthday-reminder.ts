/**
 * Weekly birthday reminder: early every Monday, the chosen recipients get one
 * email listing that week's birthdays. Configured from the Birthday Manager
 * (admin/hr/employees); sent by /api/cron/hr/birthday-reminder.
 */

/** system_settings key holding the reminder's configuration. */
export const BIRTHDAY_REMINDER_SETTINGS_KEY = "birthday_weekly_reminder"

export interface BirthdayReminderConfig {
  enabled: boolean
  /** Employees, resolved to their current email at send time. */
  recipientUserIds: string[]
  /** Addresses that are not an employee's. */
  externalEmails: string[]
  /** Monday (YYYY-MM-DD) of the last week a reminder went out, so a rerun never sends twice. */
  lastSentWeek?: string
}

const stringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []

/** Stored JSON to a config, defaulting to off with nobody selected. */
export function parseBirthdayReminderConfig(value: unknown): BirthdayReminderConfig {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  return {
    enabled: raw.enabled === true,
    recipientUserIds: stringArray(raw.recipientUserIds),
    externalEmails: stringArray(raw.externalEmails),
    ...(typeof raw.lastSentWeek === "string" && { lastSentWeek: raw.lastSentWeek }),
  }
}
