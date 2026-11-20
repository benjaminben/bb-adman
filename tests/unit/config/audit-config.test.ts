import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('dependency audit in the push workflow [SPEC 7.5, correction 19]', () => {
  const ci = fs.readFileSync('.github/workflows/ci.yml', 'utf8')

  it('runs npm audit at high severity in its own job, on every push and pull request', () => {
    expect(ci).toMatch(/\n {2}audit:\n/)
    expect(ci).toMatch(/on:\n\s+push:\n\s+pull_request:/)
  })

  it('reports and does not fail the run', () => {
    expect(ci).toMatch(/- run: npm audit --audit-level=high\n\s+continue-on-error: true/)
  })
})
