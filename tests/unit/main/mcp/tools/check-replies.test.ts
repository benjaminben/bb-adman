// P10-12 (A-236; security class full): the run_checks and get_check_results pickers name every
// field they pass on. Each input below holds a planted key at every level, and each expected
// reply is written out in full, so a field not named here never reaches an agent. A finding's
// sentence can hold ad copy, so its length and the number of findings are bounded.
import { describe, it, expect } from 'vitest'
import {
  checkResultsFields,
  checkRunFields,
  MAX_FINDING_CHARS,
  MAX_FINDINGS,
} from '@/main/mcp/tools/check-replies'

const ctx = { providers: [] }
const PLANT = { plantedKey: 'made-up-planted-value', path: '/Users/made-up/x.png' }

const warn = {
  checkId: 'prohibited-words',
  group: 'brand-legal',
  status: 'warn',
  findings: [{ layerId: 'l1', message: 'Headline contains “cheap”.', ...PLANT }],
  ...PLANT,
}
const skipped = {
  checkId: 'unapproved-translations',
  group: 'readiness',
  status: 'skipped',
  findings: [{ message: 'This post is in the main language.', ...PLANT }],
  ...PLANT,
}

const WARN_OUT = {
  checkId: 'prohibited-words',
  group: 'brand-legal',
  status: 'warn',
  findings: [{ layerId: 'l1', message: 'Headline contains “cheap”.' }],
}
const SKIPPED_OUT = {
  checkId: 'unapproved-translations',
  group: 'readiness',
  status: 'skipped',
  findings: [{ message: 'This post is in the main language.' }],
}

describe('the check reply pickers [P10-12, A-236] (security class)', () => {
  it('get_check_results: names every field of each variant, check and finding', () => {
    const reply = {
      variants: [
        {
          variantId: 'v1',
          rev: 4,
          checkedRev: 3,
          stale: true,
          ranAt: '2026-01-01T00:00:00.000Z',
          ranBy: 'agent',
          results: [warn, skipped],
          ...PLANT,
        },
      ],
      ...PLANT,
    }
    expect(checkResultsFields(reply, ctx)).toEqual({
      variants: [
        {
          variantId: 'v1',
          rev: 4,
          checkedRev: 3,
          stale: true,
          ranAt: '2026-01-01T00:00:00.000Z',
          ranBy: 'agent',
          results: [WARN_OUT, SKIPPED_OUT],
        },
      ],
    })
  })

  it('run_checks: names every field of each variant, check and finding', () => {
    const reply = { variants: [{ variantId: 'v1', checkedRev: 3, results: [warn], ...PLANT }] }
    expect(checkRunFields(reply, ctx)).toEqual({
      variants: [{ variantId: 'v1', checkedRev: 3, results: [WARN_OUT] }],
    })
  })

  it('cuts a long sentence and keeps no more than the most findings per check', () => {
    const long = 'Ä'.repeat(MAX_FINDING_CHARS + 50)
    const many = Array.from({ length: MAX_FINDINGS + 20 }, (_, i) => ({
      layerId: `l${i}`,
      message: long,
    }))
    const reply = {
      variants: [{ variantId: 'v1', checkedRev: 1, results: [{ ...warn, findings: many }] }],
    }
    const out = checkRunFields(reply, ctx) as {
      variants: Array<{ results: Array<{ findings: Array<{ layerId: string; message: string }> }> }>
    }
    const findings = out.variants[0].results[0].findings
    expect(findings).toHaveLength(MAX_FINDINGS)
    expect(findings[0]).toEqual({ layerId: 'l0', message: 'Ä'.repeat(MAX_FINDING_CHARS) })
    expect(MAX_FINDINGS).toBeLessThanOrEqual(100)
    expect(MAX_FINDING_CHARS).toBeLessThanOrEqual(500)
  })

  it('counts a sentence in code points, so a cut never splits a character', () => {
    const emoji = '\u{1F600}'.repeat(MAX_FINDING_CHARS + 1)
    const reply = {
      variants: [
        {
          variantId: 'v1',
          checkedRev: 1,
          results: [{ ...warn, findings: [{ message: emoji }] }],
        },
      ],
    }
    const out = checkRunFields(reply, ctx) as {
      variants: Array<{ results: Array<{ findings: Array<{ message: string }> }> }>
    }
    expect([...out.variants[0].results[0].findings[0].message]).toHaveLength(MAX_FINDING_CHARS)
  })
})
