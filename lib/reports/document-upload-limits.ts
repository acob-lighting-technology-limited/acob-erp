export const REPORT_DOC_MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export function formatLimitMb(bytes: number): string {
  return `${Math.round(bytes / (1024 * 1024))}MB`
}
