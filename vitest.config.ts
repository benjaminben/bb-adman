import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { srcAlias } from './path-alias.config.js'

export default defineConfig({
  test: {
    // SPEC 10.1: the two thresholds live here and nowhere else.
    coverage: {
      provider: 'v8',
      include: ['src/shared/**', 'src/main/**'],
      // [1.21] L9: the defaults, plus json-summary so the per-folder totals come from the tool.
      reporter: ['text', 'html', 'clover', 'json', 'json-summary'],
      thresholds: {
        'src/shared/**': { lines: 90 },
        'src/main/**': { lines: 80 },
      },
    },
    projects: [
      {
        resolve: { alias: srcAlias },
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'tests/unit/main/**/*.test.ts',
            'tests/unit/shared/**/*.test.ts',
            'tests/unit/config/**/*.test.ts',
            'tests/unit/preload/**/*.test.ts',
            'tests/unit/live/**/*.test.ts',
            'tests/unit/e2e-real/**/*.test.ts',
            'tests/integration/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
        resolve: { alias: srcAlias },
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['tests/unit/renderer/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/unit/renderer/setup.ts'],
        },
      },
    ],
  },
})
