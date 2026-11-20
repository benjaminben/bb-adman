import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    // SPEC 10.1: the two thresholds live here and nowhere else.
    coverage: {
      provider: 'v8',
      include: ['src/shared/**', 'src/main/**'],
      exclude: ['src/main/providers/**'],
      thresholds: {
        'src/shared/**': { lines: 90 },
        'src/main/**': { lines: 80 },
      },
    },
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'tests/unit/main/**/*.test.ts',
            'tests/unit/shared/**/*.test.ts',
            'tests/unit/config/**/*.test.ts',
            'tests/unit/preload/**/*.test.ts',
            'tests/integration/**/*.test.ts',
          ],
        },
      },
      {
        plugins: [react()],
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
