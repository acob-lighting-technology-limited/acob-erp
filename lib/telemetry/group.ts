interface ErrorSignature {
  id: string
  message: string
  source: string
  route: string
  user_name: string
  resolved: boolean
}

/** Input is newest first, so each group retains the latest diagnostic details. */
export function groupErrors<T extends ErrorSignature>(rows: T[]): (T & { eventIds: string[]; occurrences: number })[] {
  const groups = new Map<string, T & { eventIds: string[]; occurrences: number }>()
  for (const row of rows) {
    const key = JSON.stringify([row.source, row.route, row.message, row.user_name, row.resolved])
    const existing = groups.get(key)
    if (existing) {
      existing.eventIds.push(row.id)
      existing.occurrences++
    } else groups.set(key, { ...row, eventIds: [row.id], occurrences: 1 })
  }
  return [...groups.values()]
}
