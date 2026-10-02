/**
 * File Icon Component
 * Displays appropriate icon based on file type
 */

import {
  Folder,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileSpreadsheet,
  Presentation,
  FileArchive,
  FileCode,
  File,
  type LucideIcon,
} from "lucide-react"
import type { FileCategory } from "@/lib/onedrive"

interface FileIconProps {
  category: FileCategory
  className?: string
  size?: number
}

const iconMap: Record<FileCategory, LucideIcon> = {
  folder: Folder,
  image: FileImage,
  video: FileVideo,
  audio: FileAudio,
  document: FileText,
  spreadsheet: FileSpreadsheet,
  presentation: Presentation,
  pdf: FileText,
  archive: FileArchive,
  code: FileCode,
  unknown: File,
}

const colorMap: Record<FileCategory, string> = {
  folder: "text-yellow-500",
  image: "text-pink-500",
  video: "text-purple-500",
  audio: "text-green-500",
  document: "text-blue-500",
  spreadsheet: "text-emerald-500",
  presentation: "text-orange-500",
  pdf: "text-red-500",
  archive: "text-amber-600",
  code: "text-cyan-500",
  unknown: "text-gray-400",
}

export function FileIcon({ category, className, size = 24 }: FileIconProps) {
  const Icon = iconMap[category] || File
  const colorClass = colorMap[category] || "text-gray-400"

  return <Icon className={`${colorClass} ${className || ""}`} size={size} />
}

/**
 * Get file extension badge color
 */
export function getExtensionColor(extension: string): string {
  const ext = extension.toLowerCase()

  switch (ext) {
    case "pdf":
      return "bg-danger-muted text-danger-foreground"
    case "doc":
    case "docx":
      return "bg-info-muted text-info-foreground"
    case "xls":
    case "xlsx":
      return "bg-success-muted text-success-foreground"
    case "ppt":
    case "pptx":
      return "bg-warning-muted text-warning-foreground"
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "webp":
      return "bg-pink-100 text-pink-700"
    case "mp4":
    case "mov":
    case "avi":
      return "bg-purple-100 text-purple-700"
    case "zip":
    case "rar":
    case "7z":
      return "bg-warning-muted text-warning-foreground"
    default:
      return "bg-neutral-muted text-neutral-foreground"
  }
}
