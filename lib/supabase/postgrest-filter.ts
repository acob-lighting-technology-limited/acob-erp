/**
 * Quotes a value for a PostgREST filter string (`.or("col.eq.<value>,…")`).
 *
 * `.or()` takes raw filter syntax, so an unquoted value containing `,`, `.`,
 * `(` or `)` can add filters of its own — e.g. a "phone number" of
 * `x,id.not.is.null` matching every row. Double-quoting with `\` and `"`
 * escaped makes the value a literal. Use it for every user-supplied value.
 */
export function quotePostgrestValue(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}
