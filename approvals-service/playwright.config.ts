import { randomBytes } from 'node:crypto'
import { mkdtempSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig } from '@playwright/test'

// spec/approvals-service.md "Playwright set-up": `next start` on 127.0.0.1 with a migrated local
// database file and a key made for this run. Playwright starts the web server before any global
// setup and loads this file again in each worker, so the values are made once and handed on
// through the environment the workers inherit.

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      server.close(() => resolve(port))
    })
  })
}

process.env.E2E_FOLDER ??= mkdtempSync(join(tmpdir(), 'adman-e2e-'))
process.env.E2E_API_KEY ??= randomBytes(24).toString('hex')
process.env.E2E_PORT ??= String(await freePort())

const port = process.env.E2E_PORT
const database = `file:${join(process.env.E2E_FOLDER, 'e2e.db')}`

export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  reporter: 'list',
  timeout: 60_000,
  use: { baseURL: `http://127.0.0.1:${port}` },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // The migrations run first, through the same script the stakeholder uses.
    command: `npm run db:migrate && npm run build && npm run start -- -p ${port}`,
    url: `http://127.0.0.1:${port}/robots.txt`,
    reuseExistingServer: false,
    timeout: 240_000,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      API_KEY: process.env.E2E_API_KEY,
      TURSO_DATABASE_URL: database,
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
})
