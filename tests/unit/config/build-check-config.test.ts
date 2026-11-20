import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
}

describe('built-page check is wired up [SPEC 8.2, 7.5]', () => {
  it('runs tests/build with npm run test:build, outside npm test', () => {
    expect(pkg.scripts['test:build']).toBe('vitest run --config vitest.build.config.ts')
  })

  it('runs npm run test:build in the push workflow right after the build', () => {
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8')
    expect(ci).toMatch(/- run: npm run build\n\s+- run: npm run test:build/)
  })
})
