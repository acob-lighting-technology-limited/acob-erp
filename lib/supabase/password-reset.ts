import { createClient } from "@supabase/supabase-js"

/**
 * Sends the Supabase "Reset Password" email WITHOUT the PKCE flow.
 *
 * The recovery email template links to
 * `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`, which
 * /auth/confirm redeems with verifyOtp — so the link works on any device.
 *
 * The app's normal clients (@supabase/ssr) always use PKCE. A PKCE-initiated
 * reset stores the token as `pkce_<hash>`, which the token_hash link cannot
 * redeem ("One-time token not found"), and PKCE's own link only works in the
 * browser that requested it — which broke every reset IT requested on a staff
 * member's behalf. Hence this one-off implicit-flow client.
 *
 * The 6-digit code in the same email (used by /auth/setup-account) works either way.
 */
export function requestPasswordResetEmail(email: string) {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: {
      flowType: "implicit",
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
  return supabase.auth.resetPasswordForEmail(email)
}
