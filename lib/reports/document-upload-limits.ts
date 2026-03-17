export const REPORT_DOC_MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export function formatLimitMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}
