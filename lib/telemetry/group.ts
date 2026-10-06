interface ErrorSignature {
  id: string
  message: string
  source: string
  route: string
  user_name: string
  resolved: boolean
}

type ErrorGroup<T> = T & { eventIds: string[]; occurrences: number; users: string[] }

/**
 * One row per distinct failure, not per person: the same bug hitting twenty
 * staff is one problem to fix, so users are collected rather than keyed on.
 * Input is newest first, so each group retains the latest diagnostic details.
 */
export function groupErrors<T extends ErrorSignature>(rows: T[]): ErrorGroup<T>[] {
  const groups = new Map<string, ErrorGroup<T>>()
  for (const row of rows) {
    const key = JSON.stringify([row.source, row.route, row.message, row.resolved])
    const user = row.user_name || "Anonymous"
    const existing = groups.get(key)
    if (existing) {
      existing.eventIds.push(row.id)
      existing.occurrences++
      if (!existing.users.includes(user)) existing.users.push(user)
    } else groups.set(key, { ...row, eventIds: [row.id], occurrences: 1, users: [user] })
  }
  return [...groups.values()]
}
