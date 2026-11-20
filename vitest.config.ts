import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: [
            'tests/unit/main/**/*.test.ts',
            'tests/unit/shared/**/*.test.ts',
            'tests/unit/config/**/*.test.ts',
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
