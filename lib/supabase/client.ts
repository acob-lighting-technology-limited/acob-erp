import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return document.cookie.split("; ").map((cookie) => {
            const [name, ...rest] = cookie.split("=")
            return { name, value: decodeURIComponent(rest.join("=")) }
          })
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            const cookieString = `${name}=${encodeURIComponent(value)}; path=${options?.path || "/"}; ${
              options?.maxAge ? `max-age=${options.maxAge}; ` : ""
            }${options?.sameSite ? `sameSite=${options.sameSite}; ` : ""}${
              options?.secure ? "secure; " : ""
            }`
            document.cookie = cookieString
          })
        },
      },
    }
  )
}
