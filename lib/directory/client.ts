"use client"

import { apiJson } from "@/lib/api-client"

/**
 * The single queryFn for QUERY_KEYS.directory(). Every caller shares the same
 * cache entry, so each one narrows the row type to the fields it reads and
 * shapes the data with `select`, never with a different queryFn.
 */
export async function fetchDirectoryRows<T>(): Promise<T[]> {
  const payload = await apiJson<{ data?: T[] }>("/api/directory", { cache: "no-store" })
  return payload.data ?? []
}
