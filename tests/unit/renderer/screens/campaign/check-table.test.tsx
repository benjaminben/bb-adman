// CAMP-4 (spec/phases/design-wave-screens-b.md, "CAMP-4"): the Checks tab as a table. One row
// per checked post with six cell marks named "{check}: {state}"; a row opens its findings word
// for word; "{n} warnings" leads to the first warned row; "{n} not checked" runs checks; a
// post never checked is not listed. The Rules section folds with its summary always shown.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CheckPanel } from '@/renderer/screens/campaign/check-panel'
import { RuleSetPanel } from '@/renderer/screens/campaign/rule-set-panel'
import type { CheckResult } from '@/shared/schemas/checks'
import type { CheckResultsReply, VariantCheckState } from '@/shared/schemas/queries/check'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import {
  MASTER,
  P,
  SECOND,
  campaignApi,
  campaignGet,
  renderWith,
  sent,
  variant,
} from './campaign-fixture'
import { axeViolations } from '../../render'

const COLOUR_WARN = 'Headline uses #FF0000, which is not in the palette.'
const SKIP_REASON = 'There are no prohibited words for en.'

const RESULTS: CheckResult[] = [
  { checkId: 'required-assets', group: 'brand-legal', status: 'pass', findings: [] },
  {
    checkId: 'text-colours',
    group: 'brand-legal',
    status: 'warn',
    findings: [{ layerId: 'L1', message: COLOUR_WARN }],
  },
  {
    checkId: 'prohibited-words',
    group: 'brand-legal',
    status: 'skipped',
    findings: [{ message: SKIP_REASON }],
  },
  { checkId: 'required-words', group: 'brand-legal', status: 'pass', findings: [] },
  { checkId: 'unapproved-translations', group: 'readiness', status: 'pass', findings: [] },
  { checkId: 'text-overflow', group: 'readiness', status: 'pass', findings: [] },
]

const PASSED = RESULTS.map((r) => ({ ...r, status: 'pass' as const, findings: [] }))

function checked(variantId: string, opts: { stale?: boolean; results?: CheckResult[] } = {}) {
  const s: VariantCheckState = {
    variantId,
    rev: opts.stale ? 3 : 2,
    checkedRev: 2,
    stale: opts.stale ?? false,
    ranAt: '2026-11-21T00:00:00.000Z',
    ranBy: 'user',
    results: opts.results ?? RESULTS,
  }
  return s
}

const THIRD = variant('V3', { title: 'Wide post', sizeLabel: '16:9', width: 1920, height: 1080 })
const FOURTH = variant('V4', { title: 'Tall post', sizeLabel: '9:16', width: 1080, height: 1920 })

async function draw(states: VariantCheckState[], variants = [MASTER, SECOND, THIRD]) {
  const fake = campaignApi()
  const reply: CheckResultsReply = { variants: states }
  fake.onQuery('check.results', () => ({ ok: true, data: reply }))
  const data = campaignGet(variants)
  await renderWith(<CheckPanel projectId={P} campaignId="C1" data={data} />, fake)
  return fake
}

const region = () => within(screen.getByRole('region', { name: 'Checks' }))
const posts = () => region().getAllByRole('rowgroup').slice(1)
const rowButton = (name: RegExp) => region().getByRole('button', { name })

describe('the check table [CAMP-4]', () => {
  it('lists one row per checked post, in grid order, with six cell marks', async () => {
    await draw([checked('V3'), checked('V1')])
    await region().findByRole('table')
    const heads = region()
      .getAllByRole('columnheader')
      .map((h) => [h.textContent, h.getAttribute('title')])
    expect(heads.slice(1)).toEqual([
      ['Files', 'Required files'],
      ['Colours', 'Text colours'],
      ['Prohibited', 'Prohibited words'],
      ['Required', 'Required words'],
      ['Translated', 'Translations approved'],
      ['Fits', 'Text fits'],
    ])
    expect(posts()).toHaveLength(2)
    expect(within(rowButton(/^1:1 · en\s?Master/)).getByTitle('Master')).toBeInTheDocument()
    expect(within(posts()[1] as HTMLElement).getByRole('button')).toHaveTextContent('16:9 · en')
    expect(within(posts()[0] as HTMLElement).getAllByRole('cell')).toHaveLength(6)
    expect(region().queryByText(/· de/)).toBeNull()
  })

  it("names each cell by the check's full name and its state, in the cell's tooltip too", async () => {
    await draw([checked('V1')])
    const warned = await region().findByRole('cell', { name: 'Text colours: warning' })
    expect(within(warned).getByTitle('Text colours: warning')).toBeInTheDocument()
    expect(region().getByRole('cell', { name: 'Required files: passed' })).toBeInTheDocument()
    expect(
      region().getByRole('cell', { name: `Prohibited words: skipped. ${SKIP_REASON}` }),
    ).toBeInTheDocument()
  })

  it('opens the findings under a row on a click or Enter, word for word', async () => {
    await draw([checked('V1')])
    const button = await region().findByRole('button', { name: /^1:1 · en/ })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(region().queryByText(COLOUR_WARN)).toBeNull()
    await userEvent.click(region().getByRole('cell', { name: 'Required files: passed' }))
    expect(button).toHaveAttribute('aria-expanded', 'true')
    const findings = within(posts()[0] as HTMLElement)
    expect(findings.getByText('Text colours')).toBeInTheDocument()
    expect(findings.getByText(COLOUR_WARN)).toBeInTheDocument()
    expect(findings.getByText(SKIP_REASON)).toBeInTheDocument()
    button.focus()
    await userEvent.keyboard('{Enter}')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(region().queryByText(COLOUR_WARN)).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('leads the "3 warnings" mark to the first warned row', async () => {
    const variants = [MASTER, SECOND, THIRD, FOURTH]
    await draw(
      [checked('V1', { results: PASSED }), checked('V2'), checked('V3'), checked('V4')],
      variants,
    )
    await userEvent.click(await region().findByRole('button', { name: /^3 warnings/ }))
    const first = rowButton(/^1:1 · de/)
    expect(first).toHaveAttribute('aria-expanded', 'true')
    expect(first).toHaveFocus()
    expect(rowButton(/^16:9 · en/)).toHaveAttribute('aria-expanded', 'false')
  })

  it('counts a post changed since its check apart, marks it, and runs checks from its mark', async () => {
    const fake = await draw([checked('V1', { stale: true }), checked('V2')])
    const stale = await region().findByRole('button', { name: /^1:1 · en/ })
    expect(within(stale).getByTitle('Changed since the last check')).toBeInTheDocument()
    expect(region().getByRole('button', { name: /^1 warning\b/ })).toBeInTheDocument()
    expect(region().queryByText('Changed since the last check.')).toBeNull()
    await userEvent.click(region().getByRole('button', { name: /^1 not checked/ }))
    expect(sent(fake, 'check.run').map((c) => c.input)).toEqual([
      { projectId: P, campaignId: 'C1' },
    ])
  })

  it('shows "Not checked yet" with "Run checks" when no post is checked', async () => {
    const fake = await draw([])
    await region().findByText('Not checked yet')
    expect(region().queryByRole('table')).toBeNull()
    await userEvent.click(region().getByRole('button', { name: 'Run checks' }))
    expect(sent(fake, 'check.run')).toHaveLength(1)
    expect(await axeViolations()).toEqual([])
  })
})

function rules(over: Partial<CampaignGet['ruleSet']>): CampaignGet {
  const d = campaignGet([MASTER])
  d.ruleSet = {
    campaignId: 'C1',
    palette: [],
    requiredAssetIds: [],
    requiredWords: {},
    prohibitedWords: {},
    ...over,
  }
  return d
}

describe('the Rules section [CAMP-4]', () => {
  it('starts closed when a colour is set, with its summary showing', async () => {
    const d = rules({ palette: ['#1A2B3C'], prohibitedWords: { en: ['cheap', 'free'] } })
    await renderWith(<RuleSetPanel projectId={P} campaignId="C1" data={d} />)
    const section = screen.getByRole('region', { name: 'Rules' })
    expect(within(section).getByRole('button', { name: 'Rules' })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(section).toHaveTextContent('1 colour · 0 files · 2 words')
    expect(within(section).getByRole('button', { name: 'About Rules' })).toBeInTheDocument()
  })

  it('keeps a refused hex colour and its message under the row', async () => {
    await renderWith(<RuleSetPanel projectId={P} campaignId="C1" data={rules({})} />)
    const section = within(screen.getByRole('region', { name: 'Rules' }))
    await userEvent.click(section.getByRole('button', { name: 'Add colour' }))
    const field = section.getByRole('textbox', { name: 'Hex colour' })
    expect(field).toHaveAttribute('placeholder', '#1A2B3C')
    await userEvent.type(field, 'orange{Enter}')
    expect(section.getByRole('alert')).toHaveTextContent('Use a colour like #1A2B3C.')
    expect(field).toHaveValue('orange')
    expect(await axeViolations()).toEqual([])
  })
})
