import { describe, expect, it } from 'vitest'
import { runAllChecks } from '@/shared/checks/run-all'
import { input, text } from './fixtures'

describe('runAllChecks [FR-114, FR-116]', () => {
  it('gives the six results in order, with their groups', () => {
    const results = runAllChecks(input({ layers: [text('t', 'Vexlo')] }))
    expect(results.map((r) => [r.checkId, r.group, r.status])).toEqual([
      ['required-assets', 'brand-legal', 'skipped'],
      ['text-colours', 'brand-legal', 'skipped'],
      ['prohibited-words', 'brand-legal', 'skipped'],
      ['required-words', 'brand-legal', 'skipped'],
      ['unapproved-translations', 'readiness', 'skipped'],
      ['text-overflow', 'readiness', 'pass'],
    ])
  })
})
