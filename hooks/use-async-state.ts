import { useCallback, useState } from "react"

export type AsyncStateStatus = "idle" | "loading" | "success" | "empty" | "error"

export function useAsyncState<T>(initialData: T | null = null) {
  const [status, setStatus] = useState<AsyncStateStatus>("idle")
  const [data, setData] = useState<T | null>(initialData)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (fn: () => Promise<T>) => {
    setStatus("loading")
    setError(null)
    try {
      const result = await fn()
      setData(result)
      if (Array.isArray(result) && result.length === 0) {
        setStatus("empty")
      } else {
        setStatus("success")
      }
      return result
    } catch (e: any) {
      setError(e?.message || "Request failed")
      setStatus("error")
      throw e
    }
  }, [])

  return { status, data, error, run, setData, setStatus }
}
