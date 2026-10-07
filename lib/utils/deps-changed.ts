/**
 * For React's "adjust state while rendering" pattern — the replacement for
 * `useEffect(() => { setX(...) }, [a, b])`, which paints stale state for a
 * frame and then renders again:
 *
 *   const [synced, setSynced] = useState<readonly unknown[] | null>(null)
 *   const deps = [open, record] as const
 *   if (depsChanged(synced, deps)) {
 *     setSynced(deps)
 *     // reset / seed state from `open` and `record` here
 *   }
 *
 * `null` means "never synced", so the block also runs on the first render,
 * as the effect did on mount. Compared element by element with Object.is,
 * like an effect's dependency array.
 */
export function depsChanged(prev: readonly unknown[] | null, next: readonly unknown[]): boolean {
  if (prev === null || prev.length !== next.length) return true
  return prev.some((value, index) => !Object.is(value, next[index]))
}
