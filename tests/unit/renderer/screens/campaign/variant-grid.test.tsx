// spec/screens-campaign.md, "The campaign grid and the variant tile" (S2-16): one list of
// tiles in campaign.get order, the chosen one pressed, and a sentence when there are none.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
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
})
