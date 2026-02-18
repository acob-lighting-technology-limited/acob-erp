import path from "path"

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
            return callback(null, '{}');
          }
          callback();
        },
      ];
    }

    return config
  },
}

export default nextConfig
