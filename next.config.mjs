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
      }
    }

    return config
  },
}

export default nextConfig
