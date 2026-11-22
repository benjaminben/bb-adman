// R2C-1 (spec/phases/round-2-campaign.md, design addition 1, items 9 and R-8): inside the
// overview, the view bar holds the tab list "Campaign views" (Variants, Checks with its warning
// badge, Translations) and the campaign's Undo and Redo. Checks holds the check panel then the
// rule set; Translations the translation panel, or one line when there is nothing to translate.
// The panels are their slices' own; here they are stand-ins.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { NavScope } from '@/renderer/app/nav-context'
import {
  CampaignOverview,
  type CampaignViewName,
} from '@/renderer/screens/campaign/campaign-overview'
import type { CheckResult } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import type { Result } from '@/shared/schemas/result'
import { axeViolations } from '../../render'
import { MASTER, P, campaignApi, campaignGet, renderWith } from './campaign-fixture'
import { heldReply } from './held-reply'

type PanelProps = { projectId: string; campaignId: string }
const { panel } = vi.hoisted(() => ({
  panel: (name: string) => (props: PanelProps) => (
    <p>
      {name} {props.projectId.length > 0 ? 'P' : '?'} {props.campaignId}
    </p>
  ),
}))

vi.mock('@/renderer/screens/campaign/rule-set-panel', () => ({ RuleSetPanel: panel('rules') }))
vi.mock('@/renderer/screens/campaign/check-panel', async (original) => ({
  ...(await original<object>()),
  CheckPanel: panel('checks'),
}))
vi.mock('@/renderer/screens/campaign/translation-panel', () => ({
  TranslationPanel: panel('translations'),
}))

const warn: CheckResult = { checkId: 'text-colours', group: 'brand-legal', status: 'warn', findings: [] }
const state = (variantId: string, warnings: number, stale = false): VariantCheckState => ({
  variantId,
  rev: stale ? 3 : 2,
  checkedRev: 2,
  stale,
  ranAt: '2026-11-21T00:00:00.000Z',
  ranBy: 'user',
  results: Array.from({ length: warnings }, () => warn),
})

const THREE = [state('V1', 2), state('V2', 1), state('V3', 4, true)]

function Harness(props: { languages: string[] }) {
  const [view, setView] = useState<CampaignViewName>('variants')
  const data = campaignGet([MASTER])
  data.campaign.languages = props.languages
  return (
    <NavScope>
      <main>
        <CampaignOverview
          projectId={P}
          campaignId="C1"
          data={data}
          view={view}
          onView={setView}
          variants={<p>the grids</p>}
        />
      </main>
    </NavScope>
  )
}

type Answer = () => Result<unknown> | Promise<Result<unknown>>
function draw(opts: { languages?: string[]; checks?: Answer } = {}) {
  const fake = campaignApi()
  fake.onQuery('check.results', opts.checks ?? (() => ({ ok: true, data: { variants: [] } })))
  return renderWith(<Harness languages={opts.languages ?? ['en', 'de']} />, fake)
}

const tabs = () =>
  within(screen.getByRole('tablist', { name: 'Campaign views' })).getAllByRole('tab')
const panels = () =>
  screen.queryAllByText(/^(rules|checks|translations) P C1$|^the grids$/).map((p) => p.textContent)

describe('CampaignOverview [R2C-1]', () => {
  it('has three tabs in the list "Campaign views", their icons hidden', async () => {
    await draw()
    expect(tabs().map((t) => t.textContent)).toEqual(['Variants', 'Checks', 'Translations'])
    for (const tab of tabs()) {
      expect(tab.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it('shows Variants first, then the check panel and the rule set on Checks', async () => {
    await draw()
    expect(screen.getByRole('tab', { name: 'Variants' })).toHaveAttribute('aria-selected', 'true')
    expect(panels()).toEqual(['the grids'])
    await userEvent.click(screen.getByRole('tab', { name: 'Checks' }))
    expect(panels()).toEqual(['checks P C1', 'rules P C1'])
  })

  it('shows the translation panel on Translations', async () => {
    await draw()
    await userEvent.click(screen.getByRole('tab', { name: 'Translations' }))
    expect(panels()).toEqual(['translations P C1'])
  })

  it('says there is nothing to translate when the campaign has one language [A-304]', async () => {
    await draw({ languages: ['en'] })
    await userEvent.click(screen.getByRole('tab', { name: 'Translations' }))
    expect(panels()).toEqual([])
    expect(
      screen.getByText(
        'This campaign has one language, English, so there is nothing to translate.',
      ),
    ).toBeInTheDocument()
  })

  it('moves between tabs with the arrow keys', async () => {
    await draw()
    await userEvent.click(screen.getByRole('tab', { name: 'Variants' }))
    await userEvent.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveAttribute('aria-selected', 'true')
    expect(panels()).toEqual(['checks P C1', 'rules P C1'])
    await userEvent.keyboard('{End}')
    expect(screen.getByRole('tab', { name: 'Translations' })).toHaveFocus()
    expect(panels()).toEqual(['translations P C1'])
  })

  it('marks Checks with the number of current warnings [R-8]', async () => {
    await draw({ checks: () => ({ ok: true, data: { variants: THREE } }) })
    const tab = await screen.findByRole('tab', { name: 'Checks 3 warning(s)' })
    expect(within(tab).getByRole('img', { name: '3 warning(s)' })).toHaveTextContent('3')
  })

  it('has no badge at 0, nor while check.results is being read', async () => {
    const zero = await draw({ checks: () => ({ ok: true, data: { variants: [state('V1', 0)] } }) })
    await waitFor(() =>
      expect(zero.fake.queries.some((q) => q.name === 'check.results')).toBe(true),
    )
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveTextContent(/^Checks$/)
    zero.unmount()

    const held = heldReply()
    await draw({ checks: held.answer })
    expect(screen.getByRole('tab', { name: 'Checks' })).toHaveTextContent(/^Checks$/)
    await act(async () => held.release({ ok: true, data: { variants: THREE } }))
    expect(await screen.findByRole('tab', { name: 'Checks 3 warning(s)' })).toBeInTheDocument()
  })

  it('has no badge when check.results is refused', async () => {
    const refused = { ok: false, error: { code: 'NOT_FOUND', message: 'No such campaign.' } }
    const { fake } = await draw({ checks: () => refused as Result<unknown> })
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'check.results')).toBe(true))
    expect(screen.queryByRole('img', { name: /warning/ })).toBeNull()
  })

  it('follows project.changed', async () => {
    let variants = [state('V1', 1)]
    const { fake } = await draw({ checks: () => ({ ok: true, data: { variants } }) })
    expect(await screen.findByRole('tab', { name: 'Checks 1 warning(s)' })).toBeInTheDocument()
    variants = THREE
    act(() =>
      fake.emit('project.changed', { projectId: P, changed: {}, removed: {}, actor: 'user' }),
    )
    expect(await screen.findByRole('tab', { name: 'Checks 3 warning(s)' })).toBeInTheDocument()
  })

  it("puts the campaign's Undo and Redo in the same bar as the tabs", async () => {
    await draw()
    // The bar holds the tab row's box and the Undo box side by side.
    const bar = screen.getByRole('group', { name: 'Campaign changes' }).parentElement!
      .parentElement!
    expect(within(bar).getByRole('tablist', { name: 'Campaign views' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Undo' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Redo' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await draw({ checks: () => ({ ok: true, data: { variants: THREE } }) })
    await screen.findByRole('tab', { name: 'Checks 3 warning(s)' })
    expect(await axeViolations()).toEqual([])
  })
})
