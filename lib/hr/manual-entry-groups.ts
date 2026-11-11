/** One manual attendance record (OOS, waiver, a permission) as the manager lists it. */
export interface ManualRecord {
  id: string
  user_id: string
  user_name: string
  date: string
  manual_comment: string | null
}

/** A run of one person's records with the same comment, shown as one entry. */
export interface EntryGroup {
  user_id: string
  user_name: string
  ids: string[]
  /** The date of each id, in the same order. */
  dates: string[]
  start: string
  end: string
  comment: string | null
}

/** Groups per-day manual records (same employee + comment, contiguous workdays) into ranges. */
export function groupRecords(records: ManualRecord[]): EntryGroup[] {
  const byKey = new Map<string, ManualRecord[]>()
  for (const r of records) {
    const key = `${r.user_id}::${r.manual_comment ?? ""}`
    if (!byKey.has(key)) byKey.set(key, [])
    byKey.get(key)!.push(r)
  }

  const groups: EntryGroup[] = []
  for (const list of byKey.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date))
    let cur: ManualRecord[] = []
    const flush = () => {
      if (cur.length === 0) return
      groups.push({
        user_id: cur[0].user_id,
        user_name: cur[0].user_name,
        ids: cur.map((c) => c.id),
        dates: cur.map((c) => c.date),
        start: cur[0].date,
        end: cur[cur.length - 1].date,
        comment: cur[0].manual_comment,
      })
      cur = []
    }
    for (const r of list) {
      if (cur.length === 0) {
        cur = [r]
        continue
      }
      const prev = cur[cur.length - 1].date
      const gapDays = (Date.parse(`${r.date}T00:00:00Z`) - Date.parse(`${prev}T00:00:00Z`)) / 86_400_000
      // Bridge weekends so Fri→Mon stays one range, but split on real gaps.
      if (gapDays >= 1 && gapDays <= 3) cur.push(r)
      else {
        flush()
        cur = [r]
      }
    }
    flush()
  }

  groups.sort((a, b) => b.start.localeCompare(a.start))
  return groups
}

/**
 * The ids of `group`'s days that fall outside [start, end]: the days an edit takes away. Days
 * still inside the new range are left alone, so the person stays listed while a removal waits.
 */
export function idsLeavingRange(group: Pick<EntryGroup, "ids" | "dates">, start: string, end: string): string[] {
  return group.ids.filter((_, i) => group.dates[i] < start || group.dates[i] > end)
}
