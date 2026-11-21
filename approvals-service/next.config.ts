// spec/approvals-gallery.md "Next.js settings". Nothing else is set: no headers(), rewrites(),
// redirects(), output, cacheComponents or experimental values.
import type { NextConfig } from 'next'

const config: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: { unoptimized: true },
  skipTrailingSlashRedirect: true,
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['@libsql/client', 'libsql'],}

export default config
