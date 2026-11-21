import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import config from '../../../vitest.config'

type Coverage = {
  provider?: string
  include?: string[]
  exclude?: string[]
  thresholds?: Record<string, { lines?: number }>
}

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  scripts: Record<string, string>
  devDependencies: Record<string, string>
}
const coverage = (config.test as { coverage?: Coverage } | undefined)?.coverage

describe('coverage is measured [SPEC 10.1]', () => {
  it('installs @vitest/coverage-v8 at the same version as vitest', () => {
    expect(pkg.devDependencies['@vitest/coverage-v8']).toBe(pkg.devDependencies.vitest)
  })

  it('runs coverage with npm run test:coverage', () => {
    expect(pkg.scripts['test:coverage']).toBe('vitest run --coverage')
  })

  it('sets the two line thresholds in the Vitest configuration: 90% src/shared, 80% src/main, providers included', () => {
    expect(coverage?.provider).toBe('v8')
    expect(coverage?.include).toEqual(['src/shared/**', 'src/main/**'])
    expect(coverage?.exclude ?? []).not.toContain('src/main/providers/**')
    expect(coverage?.thresholds).toEqual({
      'src/shared/**': { lines: 90 },
      'src/main/**': { lines: 80 },
    })
  })

  it('prints the coverage figures in the push workflow without failing a single change', () => {
    const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8')
    expect(ci).toMatch(/- run: npm run test:coverage\n\s+continue-on-error: true/)
  })
})

describe('coverage writes a summary file [SPEC 10.1 1.21, 14 L9]', () => {
  it('adds json-summary beside the default reporters', () => {
    const reporter = (coverage as { reporter?: string[] } | undefined)?.reporter
    expect(reporter).toEqual(['text', 'html', 'clover', 'json', 'json-summary'])
  })
})
