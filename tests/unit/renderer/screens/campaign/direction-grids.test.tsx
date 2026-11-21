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
