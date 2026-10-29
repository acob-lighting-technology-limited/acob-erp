"use client"

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { initOfficeYearAnchors } from "@/lib/meeting-week"
import { ApiError } from "@/lib/api-client"

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** Opt-in: toast this (or the server's error) when the query fails. */
      errorMessage?: string
    }
  }
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void initOfficeYearAnchors()
  }, [])

  const [queryClient] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            const fallback = query.meta?.errorMessage
            if (fallback) toast.error(error instanceof Error && error.message ? error.message : fallback)
          },
        }),
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            // A 4xx will not fix itself: retrying a 403 or 404 only delays the error.
            retry: (count, error) =>
              count < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
            refetchOnWindowFocus: true,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  )
}
