import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// spec/approvals-service.md "Tests": plain Node, no network. Each test file gets its own
// in-memory database from test/db.ts.

// A fresh key per run: no real key is ever written into a file.
const keyBytes = crypto.getRandomValues(new Uint8Array(24))
const testKey = Array.from(keyBytes, (b) => b.toString(16).padStart(2, '0')).join('')

export default defineConfig({
  resolve: {
    alias: { 'server-only': fileURLToPath(new URL('./test/empty.ts', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    env: { API_KEY: testKey },
    testTimeout: 20_000,
  },
})
