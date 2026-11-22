// spec/screens-variants.md, "The overview", direction-grids/: one section per direction in
// directions order, labelled by its level-3 heading, with "{n} variant(s)", the header row and
// a grid "Variants in {name}" in direction-order.ts order. A plain click chooses a tile; a
// Cmd-click (Ctrl-click on Windows) and the "+" open it behind, as built (P3-10).
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { platform } from '@/renderer/editor/use-editor-key'
import { DirectionGrids } from '@/renderer/screens/campaign/direction-grids'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { axeViolations } from '../../render'
import { P, campaignGet, renderWith, variant } from './campaign-fixture'

const direction = (id: string, name: string, masterVariantId: string, sort: number) =>
  ({ id, campaignId: 'C1', name, masterVariantId, sort }) satisfies DirectionRow

function data() {
  const base = campaignGet([
    variant('V2', { title: 'German post', language: 'de' }),
    variant('V1', { title: 'Master post', isMaster: true }),
    variant('V3', { title: 'Night master', directionId: 'D2', isMaster: true }),
  ])
  return {
    ...base,
    directions: [direction('D1', 'Beach day', 'V1', 0), direction('D2', 'City night', 'V3', 1)],
  }
}

async function draw() {
  const onChoose = vi.fn()
  const onOpenBehind = vi.fn()
  const view = await renderWith(
    <main>
      <DirectionGrids
        projectId={P}
        campaign={data()}
        chosenId="V1"
        onChoose={onChoose}
        onOpenBehind={onOpenBehind}
        tileFooter={(v) => <span>Footer of {v.title}</span>}
      />
    </main>,
  )
  return { ...view, onChoose, onOpenBehind }
}

const titles = (list: HTMLElement) =>
  within(list)
    .getAllByRole('listitem')
    .map((item) => within(item).getAllByRole('button')[0]?.textContent ?? '')

describe('DirectionGrids', () => {
  it('draws one labelled section per direction, in directions order, each with its grid', async () => {
    await draw()
    const sections = screen.getAllByRole('region')
    const beach = screen.getByRole('region', { name: 'Beach day' })
    const night = screen.getByRole('region', { name: 'City night' })
    expect(sections).toEqual([beach, night])
    expect(within(beach).getByRole('heading', { level: 3, name: 'Beach day' })).toBeInTheDocument()
    expect(within(beach).getByRole('list', { name: 'Variants in Beach day' })).toBeInTheDocument()
    expect(within(night).getByRole('list', { name: 'Variants in City night' })).toBeInTheDocument()
  })

  it('shows the count line for each direction', async () => {
    await draw()
    expect(
      within(screen.getByRole('region', { name: 'Beach day' })).getByText('2 variant(s)'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'City night' })).getByText('1 variant(s)'),
    ).toBeInTheDocument()
  })

  it("puts the direction's master first, and keeps the tile footer", async () => {
    await draw()
    const list = screen.getByRole('list', { name: 'Variants in Beach day' })
    const shown = titles(list)
    expect(shown[0]).toContain('Master post')
    expect(shown[1]).toContain('German post')
    expect(within(list).getByText('Footer of German post')).toBeInTheDocument()
  })

  it('a plain click reaches onChoose; a Cmd-click and the "+" open the tile behind', async () => {
    const { onChoose, onOpenBehind } = await draw()
    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^German post/ }))
    expect(onChoose).toHaveBeenCalledWith('V2')
    const mod = platform === 'mac' ? 'Meta' : 'Control'
    await user.keyboard(`{${mod}>}`)
    await user.click(screen.getByRole('button', { name: /^Night master/ }))
    await user.keyboard(`{/${mod}}`)
    await user.click(screen.getByRole('button', { name: 'Open Master post in a tab' }))
    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onOpenBehind.mock.calls).toEqual([['V3'], ['V1']])
  })

  it('has no accessibility violations', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
  })
})

// R2C-3 (spec/phases/round-2-campaign.md, design addition 3): a click selects, a double-click
// or Enter opens, Mod+Enter opens behind, the arrows move the selection, Delete asks to delete.
function twoRows() {
  const base = campaignGet([
    variant('V1', { title: 'Master post', isMaster: true }),
    variant('V2', { title: 'German post', language: 'de' }),
    variant('V4', { title: 'Story post', sizeLabel: '9:16', width: 1080, height: 1920 }),
  ])
  return { ...base, directions: [direction('D1', 'Beach day', 'V1', 0)] }
}

async function drawSelect() {
  const onChoose = vi.fn()
  const onOpen = vi.fn()
  const onOpenBehind = vi.fn()
  const view = await renderWith(
    <main>
      <DirectionGrids
        projectId={P}
        campaign={twoRows()}
        chosenId="V1"
        onChoose={onChoose}
        onOpen={onOpen}
        onOpenBehind={onOpenBehind}
      />
    </main>,
  )
  return { ...view, onChoose, onOpen, onOpenBehind, user: userEvent.setup() }
}

const tile = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const modKey = platform === 'mac' ? 'Meta' : 'Control'

describe('DirectionGrids select, then open [R2C-3]', () => {
  it('a click calls onChoose and not onOpen', async () => {
    const { onChoose, onOpen, user } = await drawSelect()
    await user.click(tile('German post'))
    expect(onChoose.mock.calls).toEqual([['V2']])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('a double-click calls onOpen', async () => {
    const { onOpen, user } = await drawSelect()
    await user.dblClick(tile('German post'))
    expect(onOpen.mock.calls).toEqual([['V2']])
  })

  it('Enter on a focused tile calls onOpen once and onChoose not at all', async () => {
    const { onChoose, onOpen, user } = await drawSelect()
    tile('German post').focus()
    await user.keyboard('{Enter}')
    expect(onOpen.mock.calls).toEqual([['V2']])
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('Mod+Enter calls onOpenBehind', async () => {
    const { onOpen, onOpenBehind, user } = await drawSelect()
    tile('German post').focus()
    await user.keyboard(`{${modKey}>}{Enter}{/${modKey}}`)
    expect(onOpenBehind.mock.calls).toEqual([['V2']])
    expect(onOpen).not.toHaveBeenCalled()
  })

  it('Right then Down move the focus and select each tile met', async () => {
    const { onChoose, user } = await drawSelect()
    tile('Master post').focus()
    await user.keyboard('{ArrowRight}')
    expect(tile('German post')).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(tile('Story post')).toHaveFocus()
    expect(onChoose.mock.calls).toEqual([['V2'], ['V4']])
  })

  it('an arrow after a Cmd-click only selects', async () => {
    const { onChoose, onOpenBehind, user } = await drawSelect()
    await user.keyboard(`{${modKey}>}`)
    await user.click(tile('German post'))
    await user.keyboard(`{/${modKey}}`)
    await user.keyboard('{ArrowDown}')
    expect(onOpenBehind.mock.calls).toEqual([['V2']])
    expect(onChoose.mock.calls).toEqual([['V4']])
  })

  it('Delete on a non-master opens the warning; on the master nothing happens', async () => {
    const { user } = await drawSelect()
    tile('Master post').focus()
    await user.keyboard('{Delete}')
    expect(screen.queryByRole('dialog')).toBeNull()
    tile('German post').focus()
    await user.keyboard('{Backspace}')
    expect(await screen.findByRole('dialog', { name: 'Delete German post?' })).toBeInTheDocument()
  })
})
