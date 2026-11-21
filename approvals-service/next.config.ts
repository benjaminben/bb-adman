// spec/approvals-gallery.md "Next.js settings". Nothing else is set: no headers(), rewrites(),
// redirects(), output, cacheComponents or experimental values.
import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  skipTrailingSlashRedirect: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['@libsql/client', 'libsql'],
  // The service folder is the build's root; the repository's own lockfile above it is not.
  outputFileTracingRoot: import.meta.dirname,
  turbopack: { root: import.meta.dirname },
}

export default config
