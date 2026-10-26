export const REPORT_DOC_MAX_SIZE_BYTES = 4.2 * 1024 * 1024 // 4.2MB (safe ceiling for Vercel 4.5MB limit)

export function formatLimitMb(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  return `${Number(mb.toFixed(1))}MB`
}
