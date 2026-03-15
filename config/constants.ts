/**
 * Centralized organizational constants.
 *
 * Previously these values were scattered across API routes and library files.
 * Collecting them here means a single edit propagates everywhere they are used.
 *
 * If a value needs to be runtime-configurable per environment, move it to the
 * `system_settings` table in Supabase (the infrastructure already exists).
 */

// ---------------------------------------------------------------------------
// Company / Portal
// ---------------------------------------------------------------------------

/** Public URL of the employee web-mail / portal login page. */
export const PORTAL_URL = "https://acoblighting.com/mail"

/** Support email address shown in error pages and emails. */
export const SUPPORT_EMAIL = "ict@acoblighting.com"

// ---------------------------------------------------------------------------
// Business hours (used by the help-desk SLA calculator)
// ---------------------------------------------------------------------------

/** First business hour of the day (inclusive), 24-hour clock. */
export const BUSINESS_HOUR_START = 9 // 09:00

/** Last business hour of the day (exclusive), 24-hour clock. */
export const BUSINESS_HOUR_END = 18 // 18:00

// ---------------------------------------------------------------------------
// Help-desk SLA targets (in business hours / days)
// ---------------------------------------------------------------------------

export const SLA_URGENT_HOURS = 4
export const SLA_HIGH_HOURS = 24
export const SLA_MEDIUM_DAYS = 3
export const SLA_LOW_DAYS = 7

// ---------------------------------------------------------------------------
// Special departments used in routing / escalation logic
// ---------------------------------------------------------------------------

/**
 * Department that houses the Managing Director (MD).
 * Referenced in leave-approval routing and asset-notification escalation.
 */
export const DEPT_EXECUTIVE_MANAGEMENT = "Executive Management"

/**
 * Department that houses the Head of Corporate Services (HCS).
 * Referenced in leave-approval routing and asset-notification escalation.
 */
export const DEPT_CORPORATE_SERVICES = "Corporate Services"
