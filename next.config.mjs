import path from "path"

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : "*.supabase.co"

const cspDirectives = [
  `default-src 'self'`,
  // Next.js requires unsafe-inline for its runtime; unsafe-eval needed for some libs (xlsx, jspdf)
  // cdn.jsdelivr.net loads pptxgenjs UMD bundle dynamically (see lib/export-utils.ts)
  `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://va.vercel-scripts.com https://cdn.jsdelivr.net`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://${supabaseHost}`,
  `font-src 'self'`,
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost} https://va.vercel-scripts.com`,
  `worker-src 'self' blob:`,
  `frame-src 'none'`,
  `object-src 'none'`,
  ...(process.env.NODE_ENV === "production" ? [`upgrade-insecure-requests`] : []),
].join("; ")

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy", value: cspDirectives },
]

const nextConfig = {
  transpilePackages: ["xlsx", "jspdf", "jspdf-autotable", "docx", "file-saver"],

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }]
  },

  // Ensure build fails on TypeScript errors (matches Vercel behavior)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Ensure build fails on ESLint errors (matches Vercel behavior)
  eslint: {
    ignoreDuringBuilds: false,
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
