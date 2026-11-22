// Design wave CAMP-2 (AP-3, AP-7, AP-8, AP-13): a tile's actions are the eye "Quick look at
// {title}" and a More menu "{title}" (Open, Open in a tab, Quick look, Delete… but not on the
// master); a direction's header is one line: the name, the count chip, "Fan out…", "Sync {n}"
// only when something is out of date, and a More menu "{name}" (New direction…, Rename…,
// Delete direction…). Each delete keeps its warning with "Keep" focused [D-099]; nothing is
// sent before the warning's own button, and one click sends one delete.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../../render'
import { BEACH_MASTER, GERMAN, twoDirections } from '../../dialogs/tile-actions-fixture'
import { P, campaignApi, renderWith, sent } from './campaign-fixture'

const STALE = { ...GERMAN.badges, outOfDate: true }

async function drawGrids(campaign: CampaignGet = twoDirections()) {
  const fake = campaignApi()
  fake.onQuery('sync.preview', () => ({
    ok: true,
    data: { directionId: 'D1', masterVariantId: 'V1', masterRev: 1, variants: [] },
  }))
  fake.onQuery('variant.get', () => ({ ok: true, data: { layers: [] } }))
  const view = await renderWith(
    <main>
      <h2>Campaign</h2>
      <DirectionGrids
        projectId={P}
        campaign={campaign}
        chosenId="V1"
        onChoose={() => {}}
        onOpenBehind={() => {}}
      />
    </main>,
    fake,
  )
  return { ...view, fake }
}

async function drawGrid() {
  const calls = { onOpen: vi.fn(), onOpenBehind: vi.fn(), onQuickLook: vi.fn(), onDelete: vi.fn() }
  const onChoose = vi.fn()
  const view = await renderWith(
    <main>
      <VariantGrid variants={[BEACH_MASTER, GERMAN]} chosenId="V1" onChoose={onChoose} {...calls} />
    </main>,
  )
  return { ...view, ...calls, onChoose }
}

const more = (name: string) => screen.getByRole('button', { name: `More actions for ${name}` })

async function choose(name: string, item: string) {
  await userEvent.click(more(name))
  await userEvent.click(screen.getByRole('menuitem', { name: item }))
}

const itemNames = () => screen.getAllByRole('menuitem').map((el) => el.textContent)

describe('tile actions [CAMP-2]', () => {
  it('lists Open, Open in a tab, Quick look and Delete… in order; the master has no Delete…', async () => {
    await drawGrid()
    await userEvent.click(more('German post'))
    expect(itemNames()).toEqual(['Open', 'Open in a tab', 'Quick look', 'Delete…'])
    await userEvent.keyboard('{Escape}')
    await userEvent.click(more('Master post'))
    expect(itemNames()).toEqual(['Open', 'Open in a tab', 'Quick look'])
  })

  it('keeps the eye "Quick look at {title}" on the strip, with its title', async () => {
    const { onQuickLook } = await drawGrid()
    const eye = screen.getByRole('button', { name: 'Quick look at German post' })
    expect(eye).toHaveAttribute('title', 'Quick look at German post')
    await userEvent.click(eye)
    expect(onQuickLook.mock.calls).toEqual([['V2']])
  })

  it('each item calls its own action once: open, open behind, quick look, delete', async () => {
    const calls = await drawGrid()
    await choose('German post', 'Open')
    await choose('German post', 'Open in a tab')
    await choose('German post', 'Quick look')
    await choose('German post', 'Delete…')
    for (const call of [calls.onOpen, calls.onOpenBehind, calls.onQuickLook, calls.onDelete])
      expect(call.mock.calls).toEqual([['V2']])
    expect(calls.onChoose).not.toHaveBeenCalled()
  })

  it('leaves the arrow keys to the grid while the menu is closed', async () => {
    const { onChoose } = await drawGrid()
    screen.getByRole('button', { name: /^Master post · / }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onChoose.mock.calls).toEqual([['V2']])
    expect(screen.getByRole('button', { name: /^German post · / })).toHaveFocus()
  })

  it('"Delete…" opens "Delete {title}?" with "Keep" focused; one click sends one delete', async () => {
    const { fake } = await drawGrids()
    await choose('German post', 'Delete…')
    const dialog = screen.getByRole('dialog', { name: 'Delete German post?' })
    expect(dialog).toHaveTextContent('This cannot be undone.')
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    expect(sent(fake, 'variant.delete')).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete variant' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'variant.delete').map((c) => c.input)).toEqual([
      { projectId: P, variantId: 'V2' },
    ])
  })

  it('has no accessibility violations with the menu open', async () => {
    await drawGrids()
    await userEvent.click(more('German post'))
    expect(await axeViolations()).toEqual([])
  })
})

describe('direction header [CAMP-2]', () => {
  it('shows the count chip, no "Direction" button and no "Nothing to sync"', async () => {
    await drawGrids()
    const beach = screen.getByRole('region', { name: 'Beach day' })
    const chip = (_: string, el: Element | null) =>
      el?.tagName === 'SPAN' && el.textContent === '2 variants'
    expect(within(beach).getByText(chip)).toHaveTextContent(/^2 variants$/)
    expect(within(beach).queryByRole('button', { name: 'Direction' })).toBeNull()
    expect(screen.queryByText('Nothing to sync')).toBeNull()
    expect(within(beach).queryByRole('button', { name: /^Sync/ })).toBeNull()
  })

  it('with 2 out of date shows "Sync 2", named "Sync 2 out of date…"', async () => {
    const stale = [BEACH_MASTER, { ...GERMAN, badges: STALE }]
    const v3 = { ...GERMAN, id: 'V4', title: 'Story post', badges: STALE }
    await drawGrids(twoDirections([...stale, v3]))
    const sync = screen.getByRole('button', { name: 'Sync 2 out of date…' })
    expect(sync).toHaveTextContent(/^Sync 2$/)
    expect(sync).toHaveAttribute('title', 'Sync 2 out of date…')
  })

  it('the tile\'s "Out of date" mark opens the sync review and sends nothing', async () => {
    const { fake } = await drawGrids(twoDirections([BEACH_MASTER, { ...GERMAN, badges: STALE }]))
    await userEvent.click(screen.getByRole('button', { name: 'Out of date' }))
    expect(await screen.findByRole('dialog', { name: 'Sync Beach day' })).toBeInTheDocument()
    expect(fake.commands).toEqual([])
  })

  it('"Fan out…" opens the fan-out dialog and sends nothing', async () => {
    const { fake } = await drawGrids()
    const beach = screen.getByRole('region', { name: 'Beach day' })
    await userEvent.click(within(beach).getByRole('button', { name: 'Fan out…' }))
    expect(await screen.findByRole('dialog', { name: 'Fan out Beach day' })).toBeInTheDocument()
    expect(fake.commands).toEqual([])
  })

  it('the direction menu is "More actions for {name}" with three items', async () => {
    await drawGrids()
    await userEvent.click(more('Beach day'))
    expect(itemNames()).toEqual(['New direction…', 'Rename…', 'Delete direction…'])
  })

  it('"Delete direction…" warns with the real plural and "Keep" focused, then sends one delete', async () => {
    const { fake } = await drawGrids()
    await choose('Beach day', 'Delete direction…')
    const dialog = screen.getByRole('dialog', { name: 'Delete Beach day?' })
    expect(dialog).toHaveTextContent('Its 2 variants go with it. This cannot be undone.')
    expect(dialog).toHaveAccessibleDescription('Its 2 variants go with it. This cannot be undone.')
    expect(within(dialog).getByRole('button', { name: 'Keep' })).toHaveFocus()
    const buttons = within(dialog)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(buttons.slice(-2)).toEqual(['Keep', 'Delete direction'])
    expect(sent(fake, 'direction.delete')).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete direction' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(sent(fake, 'direction.delete').map((c) => c.input)).toEqual([
      { projectId: P, directionId: 'D1' },
    ])
  })

  it('gives the select-and-open hint as an InfoTip on the first direction only', async () => {
    await drawGrids()
    const tips = screen.getAllByRole('button', { name: 'About Variants' })
    expect(tips).toHaveLength(1)
    const beach = screen.getByRole('region', { name: 'Beach day' })
    expect(beach).toContainElement(tips[0]!)
  })

  // With no master there is nothing to fan out from, so no dead "Fan out…" is drawn.
  it('an empty direction shows "No variants" and no grid', async () => {
    await drawGrids(twoDirections([BEACH_MASTER, GERMAN]))
    const night = screen.getByRole('region', { name: 'City night' })
    expect(within(night).getByText('No variants')).toBeInTheDocument()
    expect(within(night).queryByRole('list')).toBeNull()
    expect(within(night).queryByRole('button', { name: 'Fan out…' })).toBeNull()
  })

  it('has no accessibility violations', async () => {
    await drawGrids(twoDirections([BEACH_MASTER, { ...GERMAN, badges: STALE }]))
    expect(await axeViolations()).toEqual([])
  })
})
