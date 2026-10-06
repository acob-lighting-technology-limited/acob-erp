import type { Instrumentation } from "next"

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const [{ scheduleFailure }, { setErrorReporter }, { monitoredFetch }] = await Promise.all([
    import("@/lib/telemetry/server"),
    import("@/lib/logger"),
    import("@/lib/telemetry/fetch-monitor"),
  ])
  setErrorReporter((namespace, message, data) => {
    const err = data.err ?? data.error ?? data.extra
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : err && typeof err === "object" && "message" in err
            ? String(err.message)
            : ""
    scheduleFailure({
      source: "server.logger",
      message: `${message}${detail ? `: ${detail}` : ""}`,
      stack: err instanceof Error ? err.stack : null,
      context: { namespace },
    })
  })
  globalThis.fetch = monitoredFetch(
    globalThis.fetch.bind(globalThis),
    "https://server.invalid",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    (failure) => scheduleFailure(failure)
  )
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  const { persistFailure } = await import("@/lib/telemetry/server")
  await persistFailure({
    source: "server.exception",
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : null,
    route: request.path,
    userId: typeof request.headers["x-telemetry-user-id"] === "string" ? request.headers["x-telemetry-user-id"] : null,
    context: {
      method: request.method,
      routeType: context.routeType,
      requestId: request.headers["x-request-id"],
      digest: error && typeof error === "object" && "digest" in error ? error.digest : undefined,
    },
  })
}
