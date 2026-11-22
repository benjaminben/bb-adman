// The Checks header's warnings mark shows the number the tab's badge shows: every warned
// result of a current check, of either group (ruled at the CAMP-4 merge). A post changed since
// its check adds nothing; the mark opens the first row with any warning.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CheckPanel } from '@/renderer/screens/campaign/check-panel'
import { warningCount } from '@/renderer/screens/campaign/campaign-overview/check-count'
import type { CheckResult } from '@/shared/schemas/checks'
import type { CheckResultsReply, VariantCheckState } from '@/shared/schemas/queries/check'
import {
  MASTER,
  P,
  SECOND,
  campaignApi,
  campaignGet,
  renderWith,
  variant,
} from './campaign-fixture'

const pass = (checkId: CheckResult['checkId'], group: CheckResult['group']): CheckResult => ({
  checkId,
  group,
  status: 'pass',
  findings: [],
})
const warn = (checkId: CheckResult['checkId'], group: CheckResult['group']): CheckResult => ({
  checkId,
  group,
  status: 'warn',
  findings: [{ message: `${checkId} finding` }],
})

const TWO_BRAND: CheckResult[] = [
  warn('text-colours', 'brand-legal'),
  warn('prohibited-words', 'brand-legal'),
  pass('text-overflow', 'readiness'),
]
const READY_ONLY: CheckResult[] = [
  pass('text-colours', 'brand-legal'),
  warn('text-overflow', 'readiness'),
]

function checked(variantId: string, results: CheckResult[], stale = false): VariantCheckState {
  return {
    variantId,
    rev: stale ? 3 : 2,
    checkedRev: 2,
    stale,
    ranAt: '2026-11-21T00:00:00.000Z',
    ranBy: 'user',
    results,
  }
}

const THIRD = variant('V3', { title: 'Wide post', sizeLabel: '16:9', width: 1920, height: 1080 })

describe('the Checks header warnings mark', () => {
  it('counts every warned result of a current check, as the tab badge does', async () => {
    const states = [
      checked('V1', READY_ONLY),
      checked('V2', TWO_BRAND),
      checked('V3', TWO_BRAND, true),
    ]
    const fake = campaignApi()
    const reply: CheckResultsReply = { variants: states }
    fake.onQuery('check.results', () => ({ ok: true, data: reply }))
    const data = campaignGet([MASTER, SECOND, THIRD])
    await renderWith(<CheckPanel projectId={P} campaignId="C1" data={data} />, fake)
    const region = within(screen.getByRole('region', { name: 'Checks' }))

    expect(warningCount(states)).toBe(3)
    const mark = await region.findByRole('button', { name: /^3 warnings/ })
    await userEvent.click(mark)
    // The first warned row is the one with only a "Text fits" warning.
    const first = region.getAllByRole('button', { expanded: true })
    expect(first).toHaveLength(1)
    expect(region.getByText('text-overflow finding')).toBeInTheDocument()
  })
})
