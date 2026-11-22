// CAMP-3 (spec/phases/design-wave-screens-b.md, "CAMP-3 — Header and one tab strip", C-10): the
// campaign page has one head row and one tab strip "Campaign" holding Variants, Checks,
// Translations and the open variants. Undo and Redo sit at the strip's right while a view shows.
import '../../../shared/scene/fake-fonts'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../../render'
import { variantGet } from '../../editor/editor-fixture'
import { P, campaignApi, campaignGet, renderWith, variant } from './campaign-fixture'

const SQUARE_EN = variant('V1', { title: 'Spring post', sizeLabel: 'Square', isMaster: true })
const SQUARE_DE = variant('V2', { title: 'Spring post', sizeLabel: 'Square', language: 'de' })

function setUp(variants: VariantSummary[], languages = ['en', 'de']) {
  const fake = campaignApi()
  const data = campaignGet(variants)
  data.campaign.languages = languages
  fake.onQuery('campaign.get', () => ({ ok: true, data }))
  fake.onQuery('variant.get', (input) => {
    const id = (input as { variantId: string }).variantId
    return { ok: true, data: variantGet({ variant: { ...variantGet().variant, id } }) }
  })
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: true, canRedo: false } }))
  fake.onQuery('report.list', () => ({ ok: true, data: [] }))
  return fake
}

async function draw(variants = [SQUARE_EN, SQUARE_DE], languages?: string[]) {
  const view = await renderWith(
    <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />,
    setUp(variants, languages),
  )
  await screen.findByRole('tab', { name: 'Variants' })
  return view
}

const strip = () => screen.getByRole('tablist', { name: 'Campaign' })
const tabNames = () =>
  within(strip())
    .getAllByRole('tab')
    .map((t) => t.getAttribute('aria-label') ?? t.textContent)
const tile = (name: RegExp) => screen.getByRole('button', { name })
// Cmd-click (Ctrl-click on Windows) opens the German variant's tab behind the overview.
const openBehind = () => fireEvent.click(tile(/^Spring post · 1080×1080 · de/), { ctrlKey: true })

describe('one tab strip "Campaign" [CAMP-3, C-10]', () => {
  it('holds Variants, Checks, Translations and the open variants, with no "Overview"', async () => {
    await draw()
    await userEvent.dblClick(tile(/^Spring post · 1080×1080 · de/))
    expect(screen.getAllByRole('tablist')).toHaveLength(1)
    expect(tabNames()).toEqual(['Variants', 'Checks', 'Translations', 'Square · de'])
    expect(screen.queryByRole('tab', { name: 'Overview' })).toBeNull()
  })

  it('names a variant tab "{size} · {language}", and puts the title first when titles differ', async () => {
    await draw([SQUARE_EN, { ...SQUARE_DE, title: 'Autumn post' }])
    await userEvent.dblClick(tile(/^Autumn post · /))
    expect(screen.getByRole('tab', { name: 'Autumn post · Square · de' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('shows Checks when Checks is chosen from a variant tab, and the variant again on its tab', async () => {
    await draw()
    await userEvent.dblClick(tile(/^Spring post · 1080×1080 · de/))
    expect(screen.queryByRole('region', { name: 'Checks' })).toBeNull()
    await userEvent.click(screen.getByRole('tab', { name: 'Checks' }))
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('region', { name: 'Checks' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: 'Square · de' }))
    expect(screen.queryByRole('region', { name: 'Checks' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveAttribute('aria-selected', 'false')
  })

  it('moves across every tab with the arrow keys, views and variants alike', async () => {
    await draw()
    openBehind()
    await userEvent.click(screen.getByRole('tab', { name: 'Translations' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Square · de' })).toHaveFocus()
    await userEvent.keyboard('{Home}')
    expect(screen.getByRole('tab', { name: 'Variants' })).toHaveFocus()
    expect(screen.getByRole('tab', { name: 'Variants' })).toHaveAttribute('aria-selected', 'true')
  })

  it('draws a thin divider before the first variant tab', async () => {
    await draw()
    openBehind()
    const variantTab = screen.getByRole('tab', { name: 'Square · de' })
    expect(variantTab).toHaveAttribute('data-divider', 'true')
    expect(screen.getByRole('tab', { name: 'Translations' })).not.toHaveAttribute('data-divider')
  })

  it('keeps Undo and Redo at the strip, icon buttons with the shortcut, shown only with a view', async () => {
    await draw()
    const undo = await screen.findByRole('button', { name: 'Undo' })
    const redo = screen.getByRole('button', { name: 'Redo' })
    await waitFor(() => expect(undo).toBeEnabled())
    expect(redo).toBeDisabled()
    expect(undo.title).toMatch(/^Undo \(.+Z\)$/)
    expect(redo.title).toMatch(/^Redo \(.+\)$/)
    expect(undo.textContent).toBe('')
    const bar = screen.getByRole('group', { name: 'Campaign changes' }).parentElement!
      .parentElement!
    expect(bar).toContainElement(strip())
    await userEvent.dblClick(tile(/^Spring post · 1080×1080 · de/))
    expect(screen.queryByRole('group', { name: 'Campaign changes' })).toBeNull()
  })

  it('shows "One language: {name}" on Translations for a one-language campaign', async () => {
    await draw([SQUARE_EN], ['en'])
    await userEvent.click(screen.getByRole('tab', { name: 'Translations' }))
    expect(screen.getByText('One language: English')).toBeInTheDocument()
    expect(screen.queryByText(/nothing to translate/)).toBeNull()
  })

  it('marks Checks with a real plural of its warnings', async () => {
    const fake = setUp([SQUARE_EN, SQUARE_DE])
    const warn = { checkId: 'text-colours', group: 'brand-legal', status: 'warn', findings: [] }
    const one = { variantId: 'V1', rev: 1, checkedRev: 1, stale: false, ranBy: 'user' }
    const state = { ...one, ranAt: '2026-11-21T00:00:00.000Z', results: [warn] }
    fake.onQuery('check.results', () => ({ ok: true, data: { variants: [state] } }))
    await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, fake)
    expect(await screen.findByRole('tab', { name: 'Checks 1 warning' })).toBeInTheDocument()
  })

  it('has no accessibility violations with a variant tab open', async () => {
    await draw()
    openBehind()
    await act(async () => {})
    expect(await axeViolations()).toEqual([])
  })
})
