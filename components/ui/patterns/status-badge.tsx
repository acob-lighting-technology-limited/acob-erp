import { Badge } from "@/components/ui/badge"

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  inactive: "bg-gray-100 text-gray-800",
  pending: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  open: "bg-blue-100 text-blue-800",
  in_progress: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  resolved: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-800",
  rejected: "bg-red-100 text-red-800",
  // Document validity (Sites register conveyance documents).
  valid: "bg-green-100 text-green-800",
  expiring: "bg-yellow-100 text-yellow-800",
  expired: "bg-red-100 text-red-800",
  not_required: "bg-gray-100 text-gray-800",
}

interface StatusBadgeProps {
  status: string
  /** Text to show instead of the status itself; the status still picks the colour. */
  label?: string
  className?: string
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const key = String(status || "").toLowerCase()
  const tone = STATUS_STYLES[key] || "bg-gray-100 text-gray-800"
  const text = label ?? (key.replaceAll("_", " ") || "unknown")
  return <Badge className={`${tone} ${className || ""}`.trim()}>{text}</Badge>
}
