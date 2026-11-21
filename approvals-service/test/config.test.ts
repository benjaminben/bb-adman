import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import nextConfig from '../next.config'

// spec/approvals-service.md "Folder and tooling" and spec/approvals-gallery.md "Next.js settings".

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

type Lock = { packages: Record<string, { version?: string; license?: string }> }
type Package = {
  engines?: Record<string, string>
  scripts: Record<string, string>
  dependencies: Record<string, string>
  devDependencies: Record<string, string>
  allowScripts: Record<string, boolean>
}
const pkg = JSON.parse(read('package.json')) as Package
const lock = JSON.parse(read('package-lock.json')) as Lock
const named = { ...pkg.dependencies, ...pkg.devDependencies }

// Every .ts and .tsx file under a folder, as paths from the service folder.
function sourceFiles(folder: string): string[] {
  const start = join(ROOT, folder)
  if (!existsSync(start)) return []
  return readdirSync(start, { recursive: true, encoding: 'utf8' })
    .map((name) => join(start, name))
    .filter((path) => /\.tsx?$/.test(path) && statSync(path).isFile())
    .map((path) => relative(ROOT, path))
}

const ROOT_CONFIGS = ['next.config.ts', 'playwright.config.ts', 'vitest.config.ts', 'proxy.ts']
const shipped = [
  ...sourceFiles('app'),
  ...sourceFiles('src'),
  ...sourceFiles('scripts'),
  ...ROOT_CONFIGS.filter((name) => existsSync(join(ROOT, name))),
]

describe('package.json', () => {
  it('pins the packages of the table exactly', () => {
    expect(named).toEqual({
      '@libsql/client': '0.18.0',
      next: '16.4.6',
      react: '19.3.1',
      'react-dom': '19.3.1',
      'server-only': '0.0.1',
      zod: '4.6.7',
      '@playwright/test': '1.65.1',
      '@types/node': '24.10.1',
      '@types/react': '19.3.0',
      '@types/react-dom': '19.3.0',
      typescript: '6.0.3',
      vitest: '5.1.1',
    })
    expect(pkg.engines).toEqual({ node: '24.x' })
  })

  it('installs no banned package and no GPL or AGPL licence', () => {
    const banned =
      /(^|\/)(wrangler|vercel|miniflare|workerd)$|^@vercel\/|^@cloudflare\/|analytics|speed-insights|telemetry/
    for (const [path, entry] of Object.entries(lock.packages)) {
      if (path === '') continue
      const name = path.replace(/^.*node_modules\//, '')
      expect(name, path).not.toMatch(banned)
      expect(entry.license ?? '', path).not.toMatch(/(^|[^L])GPL/)
    }
  })

  it('has the scripts of the spec, with telemetry off wherever next runs', () => {
    expect(pkg.scripts).toEqual({
      dev: 'NEXT_TELEMETRY_DISABLED=1 next dev -H 127.0.0.1 -p 3000',
      build: 'NEXT_TELEMETRY_DISABLED=1 next build',
      start: 'NEXT_TELEMETRY_DISABLED=1 next start -H 127.0.0.1',
      typecheck: 'tsc --noEmit -p tsconfig.json && tsc --noEmit -p test/tsconfig.json',
      test: 'vitest run',
      'test:e2e': 'NEXT_TELEMETRY_DISABLED=1 playwright test',
      'db:migrate': 'node scripts/migrate.ts',
    })
    for (const script of Object.values(pkg.scripts)) {
      if (/\b(next|playwright)\b/.test(script)) {
        expect(script.startsWith('NEXT_TELEMETRY_DISABLED=1 ')).toBe(true)
      }
    }
  })

  it('runs no install script', () => {
    expect(pkg.allowScripts).toEqual({ 'fsevents@2.3.3': false, 'sharp@0.35.5': false })
  })
})

describe('next.config.ts', () => {
  it('holds exactly the listed settings', () => {
    expect(nextConfig).toEqual({
      poweredByHeader: false,
      reactStrictMode: true,
      images: { unoptimized: true },
      skipTrailingSlashRedirect: true,
      productionBrowserSourceMaps: false,
      serverExternalPackages: ['@libsql/client', 'libsql'],
    })
  })
})

describe('the service code', () => {
  it.each(['src/db', 'src/crypto', 'src/pictures', 'src/server'])(
    'starts every file in %s with the server-only line',
    (folder) => {
      const files = sourceFiles(folder)
      expect(files.length).toBeGreaterThan(0)
      for (const file of files) {
        expect(read(file).split('\n')[0], file).toBe("import 'server-only'")
      }
    },
  )

  it('reads process.env only in its four files', () => {
    const allowed = ['src/server/env.ts', 'scripts/migrate.ts', ...ROOT_CONFIGS.slice(0, 2)]
    const readers = shipped.filter((file) => read(file).includes('process.env'))
    expect(readers.filter((file) => !allowed.includes(file))).toEqual([])
  })

  it('imports nothing that fetches from another company, under app/ and src/ui/', () => {
    const files = [...sourceFiles('app'), ...sourceFiles('src/ui')]
    for (const file of files) {
      expect(read(file), file).not.toMatch(/from '(next\/font|next\/image|next\/script|@vercel\/)/)
    }
  })

  it("has no 'use server', and 'use client' only in the two error boundaries", () => {
    const boundaries = ['app/error.tsx', 'app/global-error.tsx']
    for (const file of shipped) {
      const text = read(file)
      expect(text, file).not.toMatch(/['"]use server['"]/)
      if (!boundaries.includes(file)) expect(text, file).not.toMatch(/['"]use client['"]/)
    }
  })
})
