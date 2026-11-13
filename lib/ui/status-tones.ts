/**
 * Status tones: the one map of status colours (badges, pills, chips).
 *
 * Tones come from the `--success/--warning/--danger/--info/--purple` tokens in
 * `app/globals.css`, which carry their own dark values: no `dark:` overrides here.
 *
 * Each entry is complete on any `Badge` variant: it clears the default variant's
 * border, shadow and `hover:bg-primary`, so a toned badge never flashes primary.
 * Prefer `<StatusBadge>` from `@/components/ui/patterns/status-badge`; use these
 * classes only for a badge that cannot be one.
 */
const TONE_BASE = "border-transparent shadow-none"

export type StatusTone = "success" | "warning" | "danger" | "info" | "purple" | "neutral"

export const TONE_CLASSES: Readonly<Record<StatusTone, string>> = {
  success: `${TONE_BASE} bg-success/15 text-success hover:bg-success/15`,
  warning: `${TONE_BASE} bg-warning/15 text-warning hover:bg-warning/15`,
  danger: `${TONE_BASE} bg-danger/15 text-danger hover:bg-danger/15`,
  info: `${TONE_BASE} bg-info/15 text-info hover:bg-info/15`,
  purple: `${TONE_BASE} bg-purple/15 text-purple hover:bg-purple/15`,
  neutral: `${TONE_BASE} bg-muted text-muted-foreground hover:bg-muted`,
}
