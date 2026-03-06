const DEFAULT_MESSAGE = "System is under maintenance. Please check back later."

export function canManageMaintenanceMode(role: string | null | undefined): boolean {
  return role === "super_admin" || role === "developer"
}

function parseBooleanLike(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) return true
    if (["false", "0", "no", "off", ""].includes(normalized)) return false
  }
  return false
}

export function parseMaintenanceMode(raw: unknown): {
  enabled: boolean
  message: string
} {
  if (typeof raw === "boolean" || typeof raw === "number" || typeof raw === "string") {
    return {
      enabled: parseBooleanLike(raw),
      message: DEFAULT_MESSAGE,
    }
  }

  if (raw && typeof raw === "object") {
    const value = raw as { enabled?: unknown; message?: unknown }
    return {
      enabled: parseBooleanLike(value.enabled),
      message: typeof value.message === "string" && value.message.trim() ? value.message : DEFAULT_MESSAGE,
    }
  }

  return {
    enabled: false,
    message: DEFAULT_MESSAGE,
  }
}

export { DEFAULT_MESSAGE as DEFAULT_MAINTENANCE_MESSAGE }
