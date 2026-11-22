// P6-11 (spec/phases/phase-06.md, design addition 8): the "Checks" region. "Run checks" sends
// check.run { campaignId } and shows "Checking…" while it runs; the summary marks and one row
// per checked variant come from check.results, read again on project.changed (CAMP-4: blocks
// became table rows, "Name: Status" badges cell marks, the summary line two marks).
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CheckPanel } from '@/renderer/screens/campaign/check-panel'
import type { CheckResult } from '@/shared/schemas/checks'
import type { CheckResultsReply, VariantCheckState } from '@/shared/schemas/queries/check'
import { MASTER, P, SECOND, campaignApi, campaignGet, renderWith, sent } from './campaign-fixture'
import { REFUSED, heldReply } from './held-reply'
import { axeViolations } from '../../render'

const PASSES: CheckResult[] = [
  { checkId: 'required-assets', group: 'brand-legal', status: 'pass', findings: [] },
  {
    checkId: 'text-colours',
    group: 'brand-legal',
    status: 'warn',
    findings: [{ layerId: 'L1', message: 'Headline uses #FF0000, which is not in the palette.' }],
  },
  {
    checkId: 'prohibited-words',
    group: 'brand-legal',
    status: 'skipped',
    findings: [{ message: 'There are no prohibited words for en.' }],
  },
  { checkId: 'required-words', group: 'brand-legal', status: 'pass', findings: [] },
  { checkId: 'unapproved-translations', group: 'readiness', status: 'pass', findings: [] },
  { checkId: 'text-overflow', group: 'readiness', status: 'pass', findings: [] },
]

function checked(variantId: string, stale = false): VariantCheckState {
  return {
    variantId,
    rev: stale ? 3 : 2,
    checkedRev: 2,
    stale,
    ranAt: '2026-11-21T00:00:00.000Z',
    ranBy: 'user',
    results: PASSES,
  }
}

function setup(states: VariantCheckState[]) {
  const fake = campaignApi()
  let reply: CheckResultsReply = { variants: states }
  fake.onQuery('check.results', () => ({ ok: true, data: reply }))
  const answer = (next: VariantCheckState[]) => {
    reply = { variants: next }
  }
  const data = campaignGet([MASTER, SECOND])
  const ui = <CheckPanel projectId={P} campaignId="C1" data={data} />
  return { fake, answer, ui }
}

const region = () => screen.getByRole('region', { name: 'Checks' })
// A post's row group, found by its row button "{size} · {language}".
const postRow = async (name: RegExp) =>
  (await within(region()).findByRole('button', { name })).closest('tbody') as HTMLElement
const resultReads = (fake: ReturnType<typeof campaignApi>) =>
  fake.queries.filter((q) => q.name === 'check.results')

describe('CheckPanel [P6-11]', () => {
  it('reads check.results for the campaign and shows the summary', async () => {
    const { fake, ui } = setup([checked('V1')])
    await renderWith(ui, fake)
    expect(await within(region()).findByRole('button', { name: /^1 warning\b/ })).toBeVisible()
    expect(within(region()).queryByRole('button', { name: /not checked/ })).toBeNull()
    expect(resultReads(fake)[0]?.input).toEqual({ projectId: P, campaignId: 'C1' })
  })

  it('sends check.run and shows "Checking…" while it runs', async () => {
    const { fake, ui } = setup([])
    const held = heldReply()
    fake.onCommand('check.run', held.answer)
    await renderWith(ui, fake)
    await userEvent.click(within(region()).getByRole('button', { name: 'Run checks' }))
    expect(sent(fake, 'check.run').map((c) => c.input)).toEqual([
      { projectId: P, campaignId: 'C1' },
    ])
    expect(within(region()).getByRole('status')).toHaveTextContent('Checking…')
    expect(within(region()).getByRole('button', { name: 'Run checks' })).toBeDisabled()
    await act(async () => held.release({ ok: true, data: { variants: [] } }))
    expect(within(region()).queryByText('Checking…')).toBeNull()
    expect(within(region()).getByRole('button', { name: 'Run checks' })).toBeEnabled()
  })

  it('shows a refused run its own message', async () => {
    const { fake, ui } = setup([])
    fake.onCommand('check.run', () => REFUSED)
    await renderWith(ui, fake)
    await userEvent.click(within(region()).getByRole('button', { name: 'Run checks' }))
    expect(await within(region()).findByRole('alert')).toHaveTextContent('The run was refused.')
  })

  it('shows one row per checked variant with six cells and the findings', async () => {
    const { fake, ui } = setup([checked('V1')])
    await renderWith(ui, fake)
    const block = await postRow(/^1:1 · en/)
    const rows = within(block).getAllByRole('cell').slice(0, 6)
    expect(rows.map((cell) => cell.textContent)).toEqual([
      'Required files: passed',
      'Text colours: warning',
      'Prohibited words: skipped. There are no prohibited words for en.',
      'Required words: passed',
      'Translations approved: passed',
      'Text fits: passed',
    ])
    await userEvent.click(within(block).getByRole('button', { name: /^1:1 · en/ }))
    expect(
      within(block).getByText('Headline uses #FF0000, which is not in the palette.'),
    ).toBeInTheDocument()
    expect(within(block).getByText('There are no prohibited words for en.')).toBeInTheDocument()
    expect(within(block).queryByTitle('Changed since the last check')).toBeNull()
    expect(within(region()).queryByRole('button', { name: /· de/ })).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('marks a stale row "Changed since the last check"', async () => {
    const { fake, ui } = setup([checked('V1'), checked('V2', true)])
    await renderWith(ui, fake)
    const block = await postRow(/^1:1 · de/)
    expect(within(block).getByTitle('Changed since the last check')).toBeInTheDocument()
    expect(within(region()).getByRole('button', { name: /^1 warning\b/ })).toBeVisible()
    expect(within(region()).getByRole('button', { name: /^1 not checked/ })).toBeVisible()
  })

  it('reads check.results again on project.changed for this project only', async () => {
    const { fake, answer, ui } = setup([])
    await renderWith(ui, fake)
    await waitFor(() => expect(resultReads(fake)).toHaveLength(1))
    act(() =>
      fake.emit('project.changed', { projectId: 'other', changed: {}, removed: {}, actor: 'user' }),
    )
    expect(resultReads(fake)).toHaveLength(1)
    answer([checked('V1')])
    act(() =>
      fake.emit('project.changed', { projectId: P, changed: {}, removed: {}, actor: 'user' }),
    )
    expect(await postRow(/^1:1 · en/)).toBeInTheDocument()
    expect(resultReads(fake)).toHaveLength(2)
  })

  it('draws a finding as text, never as markup', async () => {
    const results: CheckResult[] = PASSES.map((r) =>
      r.checkId === 'prohibited-words'
        ? {
            ...r,
            status: 'warn',
            findings: [{ layerId: 'L2', message: '<b>Bold</b> contains “!”.' }],
          }
        : r,
    )
    const { fake, ui } = setup([{ ...checked('V1'), results }])
    await renderWith(ui, fake)
    await userEvent.click(await within(region()).findByRole('button', { name: /^1:1 · en/ }))
    expect(await within(region()).findByText('<b>Bold</b> contains “!”.')).toBeInTheDocument()
    expect(region().querySelector('b')).toBeNull()
  })
})
