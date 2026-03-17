import path from "path"

// ---------------------------------------------------------------------------
// Security headers applied to all routes
// ---------------------------------------------------------------------------
const supabaseHost = "https://itqegqxeqkeogwrvlzlj.supabase.co"

const securityHeaders = [
  // Prevent browsers from sniffing a different MIME type than declared
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Block page from being framed by other origins (clickjacking protection)
  { key: "X-Frame-Options", value: "SAMEORIGIN" },

  // Enforce HTTPS for 1 year, including subdomains
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },

  // Restrict browser feature access
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },

  // Referrer information limited to same-origin
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Content Security Policy
  // Sources:
  //   - 'self'                    : App origin
  //   - supabaseHost              : Supabase API & storage
  //   - va.vercel-scripts.com     : Vercel Web Analytics script
  //   - vitals.vercel-insights.com: Vercel Speed Insights beacon
  //
  // Note: 'unsafe-inline' is required for:
  //   - style-src: Tailwind CSS + Radix UI inject inline styles at runtime.
  //     Remove once CSS-in-JS is eliminated or a nonce/hash approach is used.
  //   - script-src 'unsafe-inline': Next.js inlines small hydration scripts.
  //     Remove once Next.js supports nonce-based CSP (tracked roadmap item).
  //   - script-src 'unsafe-eval': Required by xlsx, jspdf, and docx packages
  //     which use eval() internally for formula parsing / rendering. Cannot be
  //     removed until those libs ship eval-free builds or are replaced.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Scripts: self + Next.js inline hydration + xlsx/jspdf eval + Vercel Analytics
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com",
      // Styles: self + inline (Tailwind/Radix)
      "style-src 'self' 'unsafe-inline'",
      // Images: self + data URIs (avatar initials) + Supabase storage
      `img-src 'self' data: blob: ${supabaseHost}`,
      // Fonts: self-hosted Geist font only
      "font-src 'self'",
      // API calls: self + Supabase
      `connect-src 'self' ${supabaseHost} wss://itqegqxeqkeogwrvlzlj.supabase.co https://vitals.vercel-insights.com`,
      // No frames from external origins
      "frame-src 'none'",
      // No plugins
      "object-src 'none'",
      // Base URI restricted to self
      "base-uri 'self'",
      // Form submissions only to self
      "form-action 'self'",
    ].join("; "),
  },
]

const nextConfig = {
  transpilePackages: ["xlsx", "jspdf", "jspdf-autotable", "docx", "file-saver"],

  // Ensure build fails on TypeScript errors (matches Vercel behavior)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Ensure build fails on ESLint errors (matches Vercel behavior)
  eslint: {
    ignoreDuringBuilds: false,
  },

  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: "/(.*)",
        headers: securityHeaders,
      },
    ]
  },

  webpack: (config, { isServer }) => {
    // Handle canvas module for jsPDF
    config.resolve.alias.canvas = false
    config.resolve.alias.encoding = false

    // Externalize certain modules that have issues with webpack
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        http: false,
        https: false,
      }

      // Handle node: scheme for modern Node modules
      config.resolve.alias = {
        ...config.resolve.alias,
        "node:fs": false,
        "node:net": false,
        "node:tls": false,
        "node:path": false,
        "node:stream": false,
        "node:crypto": false,
        "node:http": false,
        "node:https": false,
      }

      // Specifically handle 'node:' scheme imports by treating them as externals or ignoring them
      config.externals = [
        ...(config.externals || []),
        ({ request }, callback) => {
          if (/^node:/.test(request)) {
            return callback(null, "{}")
          }
          callback()
        },
      ]
    }

    return config
  },
}

export default nextConfig
