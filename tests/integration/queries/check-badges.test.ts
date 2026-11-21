// P6-3 (spec/phases/phase-06.md, design addition 5, "Badges"): the tile marks "Check warning"
// and "Not checked" come from the variant's variant_check row and its rev now. checkWarning:
// a fresh row with a brand-legal warn; checkStale: a row older than the variant's rev.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { openCheckProject } from '../checks/check-fixture'
import { checkBadges } from '@/main/checks/badges'
import type { CheckResult } from '@/shared/schemas/checks'
import type { VariantCheckRow } from '@/shared/schemas/rows/variant-check'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

const result = (group: CheckResult['group'], status: CheckResult['status']): CheckResult => ({
  checkId: group === 'brand-legal' ? 'text-colours' : 'text-overflow',
  group,
  status,
  findings: status === 'warn' ? [{ layerId: 'L1', message: 'A finding.' }] : [],
})

const BRAND_WARN = [result('brand-legal', 'warn'), result('readiness', 'pass')]
const READINESS_WARN = [result('brand-legal', 'pass'), result('readiness', 'warn')]

type Case = [string, { results: CheckResult[]; behind: number } | null, object]
const CASES: Case[] = [
  ['no row', null, { checkWarning: false, checkStale: false }],
  [
    'a fresh row with a brand-legal warn',
    { results: BRAND_WARN, behind: 0 },
    { checkWarning: true, checkStale: false },
  ],
  [
    'a fresh row with only a readiness warn',
    { results: READINESS_WARN, behind: 0 },
    { checkWarning: false, checkStale: false },
  ],
  ['a stale row', { results: BRAND_WARN, behind: 1 }, { checkWarning: false, checkStale: true }],
]

describe('check badges [P6-3, design addition 5]', () => {
  it.each(CASES)('checkBadges: %s', (_, given, marks) => {
    const rev = 4
    const row: VariantCheckRow | null = given && {
      variantId: 'V1',
      checkedRev: rev - given.behind,
      ranAt: '2026-01-01T00:00:00.000Z',
      ranBy: 'user',
      results: given.results,
    }
    expect(checkBadges(row, rev)).toEqual(marks)
  })

  it.each(CASES)('campaign.get marks the tile: %s', async (_, given, marks) => {
    f = makeFixture()
    const p = await openCheckProject(f)
    const [id = ''] = p.variantIds()
    const db = p.db()
    db.prepare('UPDATE variant SET rev = 3 WHERE id = ?').run(id)
    if (given) {
      db.prepare(
        `INSERT INTO variant_check (variant_id, checked_rev, ran_at, ran_by, results)
         VALUES (?, ?, '2026-01-01T00:00:00.000Z', 'agent', ?)`,
      ).run(id, 3 - given.behind, JSON.stringify(given.results))
    }
    const tile = (await p.campaign()).variants.find((v) => v.id === id)
    expect(tile?.badges).toMatchObject(marks)
  })
})
