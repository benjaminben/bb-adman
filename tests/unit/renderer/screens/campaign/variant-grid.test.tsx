// spec/screens-campaign.md, "The campaign grid and the variant tile" (S2-16): one list of
// tiles in campaign.get order, the chosen one pressed, and a sentence when there are none.
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { VariantGrid } from '@/renderer/screens/campaign/variant-grid'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../../render'
import { variant } from './campaign-fixture'

const VARIANTS = [
  variant('V1', { title: 'Master post', isMaster: true }),
  variant('V2', { title: 'German post', language: 'de' }),
  variant('V3', { title: 'Story', width: 1080, height: 1920, sizeLabel: '9:16' }),
]

const draw = (variants: VariantSummary[], chosenId: string | null = 'V2') =>
  render(
    <main>
      <VariantGrid variants={variants} chosenId={chosenId} onChoose={() => {}} />
    </main>,
  )

describe('VariantGrid [S2-16]', () => {
  it('lists one tile per variant in the order given, the chosen one pressed', () => {
    draw(VARIANTS)
    const list = screen.getByRole('list', { name: 'Variants' })
    const tiles = within(list).getAllByRole('button')
    const titles = VARIANTS.map((v) => v.title)
    expect(tiles.map((t) => titles.find((title) => within(t).queryByText(title)))).toEqual(titles)
    expect(tiles.map((t) => t.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false'])
    expect(within(list).getAllByRole('listitem')).toHaveLength(3)
  })

  it('says so when the campaign has no variants', () => {
    draw([], null)
    expect(screen.getByText('This campaign has no variants.')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Variants' })).toBeNull()
  })

  it('has no accessibility violations', async () => {
    draw(VARIANTS)
    expect(await axeViolations()).toEqual([])
  })

  it('draws tileFooter(variant) under each tile, outside its button [AP-12]', () => {
    render(
      <VariantGrid
        variants={VARIANTS}
        chosenId={null}
        onChoose={() => {}}
        tileFooter={(v) => <p>Footer for {v.title}</p>}
      />,
    )
    const items = within(screen.getByRole('list', { name: 'Variants' })).getAllByRole('listitem')
    items.forEach((item, i) => {
      const footer = within(item).getByText(`Footer for ${VARIANTS[i]!.title}`)
      expect(within(item).getByRole('button').contains(footer)).toBe(false)
    })
  })
})

// P5-15 (spec/screens-variants.md, "The tile's actions"): after the "+", "Quick look at
// {title}" on every tile and "Delete {title}" on every tile but the master's. After a delete,
// focus goes to the next tile's main button, else the previous one, else the heading.
describe('VariantGrid tile actions [P5-15]', () => {
  function actions(variants: VariantSummary[] = VARIANTS) {
    const onQuickLook = vi.fn()
    const onDelete = vi.fn()
    const grid = (list: VariantSummary[]) => (
      <section aria-labelledby="h">
        <h3 id="h">Beach day</h3>
        <VariantGrid
          variants={list}
          chosenId={null}
          onChoose={() => {}}
          onOpenBehind={() => {}}
          onQuickLook={onQuickLook}
          onDelete={onDelete}
        />
      </section>
    )
    const view = render(grid(variants))
    const redraw = (list: VariantSummary[]) => view.rerender(grid(list))
    return { ...view, onQuickLook, onDelete, redraw }
  }

  // The tile's own button is the first in its list item.
  const mainButton = (title: string) =>
    within(screen.getByText(title).closest('li')!).getAllByRole('button')[0]

  it('puts "Quick look" and, except on the master, "Delete" after the "+", with titles', async () => {
    const { onQuickLook, onDelete } = actions()
    const items = within(screen.getByRole('list', { name: 'Variants' })).getAllByRole('listitem')
    const names = items.map((item) =>
      within(item)
        .getAllByRole('button')
        .slice(1)
        .map((b) => b.getAttribute('aria-label')),
    )
    expect(names).toEqual([
      ['Open Master post in a tab', 'Quick look at Master post'],
      ['Open German post in a tab', 'Quick look at German post', 'Delete German post'],
      ['Open Story in a tab', 'Quick look at Story', 'Delete Story'],
    ])
    const look = screen.getByRole('button', { name: 'Quick look at Story' })
    expect(look).toHaveAttribute('title', 'Quick look at Story')
    expect(screen.getByRole('button', { name: 'Delete Story' })).toHaveAttribute(
      'title',
      'Delete Story',
    )
    await userEvent.click(look)
    await userEvent.click(screen.getByRole('button', { name: 'Delete German post' }))
    expect(onQuickLook.mock.calls).toEqual([['V3']])
    expect(onDelete.mock.calls).toEqual([['V2']])
  })

  it('shows neither button without the props', () => {
    draw(VARIANTS)
    expect(screen.queryByRole('button', { name: /^Quick look at/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /^Delete/ })).toBeNull()
  })

  it('after a delete, gives focus to the next tile, else the previous one', async () => {
    const { redraw } = actions()
    await userEvent.click(screen.getByRole('button', { name: 'Delete German post' }))
    redraw([VARIANTS[0]!, VARIANTS[2]!])
    expect(mainButton('Story')).toHaveFocus()
    await userEvent.click(screen.getByRole('button', { name: 'Delete Story' }))
    redraw([VARIANTS[0]!])
    expect(mainButton('Master post')).toHaveFocus()
  })

  it("after a delete with no tile left, gives focus to the direction's heading", async () => {
    const { redraw } = actions([variant('V5', { title: 'Lone post' })])
    await userEvent.click(screen.getByRole('button', { name: 'Delete Lone post' }))
    redraw([])
    expect(screen.getByRole('heading', { name: 'Beach day' })).toHaveFocus()
  })

  it('moves no focus while the deleted tile stays', async () => {
    const { redraw } = actions()
    await userEvent.click(screen.getByRole('button', { name: 'Delete German post' }))
    redraw([...VARIANTS])
    expect(screen.getByRole('button', { name: 'Delete German post' })).toHaveFocus()
  })
})
