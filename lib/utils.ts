import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a name string to have only the first letter of each word capitalized
 * Example: "JOHN DOE" -> "John Doe", "mary jane" -> "Mary Jane"
 */
export function formatName(name?: string | null): string {
  if (!name) return ""
  return name
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ")
}

/**
 * Formats a full name (first, middle/other, last) consistently
 */
export function formatFullName(firstName?: string | null, lastName?: string | null, otherNames?: string | null): string {
  const parts = [formatName(firstName), formatName(otherNames), formatName(lastName)].filter(Boolean)
  return parts.join(" ")
}
