import { monitoredFetch } from "@/lib/telemetry/fetch-monitor"
import { reportClientError } from "@/lib/telemetry/client"

// Next runs this before hydration, including requests made before effects mount.
window.fetch = monitoredFetch(
  window.fetch.bind(window),
  window.location.origin,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  (failure) => {
    void reportClientError(failure)
  }
)
