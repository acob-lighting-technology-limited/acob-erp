import { redirect } from "next/navigation"

// Root page redirects to My Day (the proxy handles this; this is the fallback)
export default function RootPage() {
  redirect("/home")
}
