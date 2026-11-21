import { defineConfig } from 'vitest/config'
import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'

// spec/approvals-service.md "Tests": local Miniflare only. The migrations are read here, in
// Node, and handed to the setup file, which applies them to the test database.
const migrations = await readD1Migrations('./migrations')

// A fresh key per run: no real key is ever written into a file.
const keyBytes = crypto.getRandomValues(new Uint8Array(24))
const testKey = Array.from(keyBytes, (b) => b.toString(16).padStart(2, '0')).join('')

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      miniflare: { bindings: { TEST_MIGRATIONS: migrations, API_KEY: testKey } },
    }),
  ],
  test: {
    setupFiles: ['./test/setup.ts'],
    testTimeout: 20_000,
  },
})
