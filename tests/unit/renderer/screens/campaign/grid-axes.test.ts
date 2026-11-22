// R2C-2 (spec/phases/round-2-campaign.md, design addition 2): the grid's axes. Rows are size
// labels and columns language codes, each in the order first met in the list given (the
// direction-order.ts order); one cell per size and language, its variants in list order.
import { describe, expect, it } from 'vitest'
import { gridAxes } from '@/renderer/screens/campaign/variant-grid/grid-axes'
import { variant } from './campaign-fixture'

const SQUARE = { sizeLabel: 'Square', width: 1080, height: 1080 }
const STORY = { sizeLabel: 'Story', width: 1080, height: 1920 }
const WIDE = { sizeLabel: 'Wide', width: 1920, height: 1080 }

// In direction-order.ts order: master, then sizes, then languages, then image before video.
const LIST = [
  variant('M', { ...SQUARE, language: 'en', isMaster: true }),
  variant('SQ-de', { ...SQUARE, language: 'de' }),
  variant('SQ-fr', { ...SQUARE, language: 'fr' }),
  variant('ST-en', { ...STORY, language: 'en' }),
  variant('ST-de', { ...STORY, language: 'de' }),
  variant('WI-en', { ...WIDE, language: 'en' }),
  variant('WI-fr', { ...WIDE, language: 'fr' }),
]

const ids = (cells: ReturnType<typeof gridAxes>['cells']) =>
  cells.map((c) => [c.row, c.column, c.variants.map((v) => v.id)])

describe('gridAxes [R2C-2]', () => {
  it("puts the master's size and language first, then the list's order", () => {
    const axes = gridAxes(LIST)
    expect(axes.rows).toEqual([SQUARE, STORY, WIDE])
    expect(axes.columns).toEqual(['en', 'de', 'fr'])
  })

  it('places each variant in its cell, in reading order, and leaves empty cells out', () => {
    expect(ids(gridAxes(LIST).cells)).toEqual([
      [1, 1, ['M']],
      [1, 2, ['SQ-de']],
      [1, 3, ['SQ-fr']],
      [2, 1, ['ST-en']],
      [2, 2, ['ST-de']],
      [3, 1, ['WI-en']],
      [3, 3, ['WI-fr']],
    ])
  })

  it('puts an unlisted size and an unlisted language after the listed ones', () => {
    const axes = gridAxes([
      ...LIST,
      variant('SQ-ja', { ...SQUARE, language: 'ja' }),
      variant('BAN-en', { sizeLabel: 'Banner', width: 728, height: 90, language: 'en' }),
    ])
    expect(axes.rows.map((r) => r.sizeLabel)).toEqual(['Square', 'Story', 'Wide', 'Banner'])
    expect(axes.columns).toEqual(['en', 'de', 'fr', 'ja'])
    expect(ids(axes.cells)[3]).toEqual([1, 4, ['SQ-ja']])
    expect(ids(axes.cells).at(-1)).toEqual([4, 1, ['BAN-en']])
  })

  it('shares one cell between an image and a video of one size and language, image first', () => {
    const axes = gridAxes([
      variant('M', { ...SQUARE, isMaster: true }),
      variant('M-video', { ...SQUARE, format: 'video' }),
    ])
    expect(ids(axes.cells)).toEqual([[1, 1, ['M', 'M-video']]])
  })

  it('takes a row size from the first variant met in that row', () => {
    const axes = gridAxes([
      variant('A', { sizeLabel: 'Square', width: 1080, height: 1080 }),
      variant('B', { sizeLabel: 'Square', width: 1200, height: 1200, language: 'de' }),
    ])
    expect(axes.rows).toEqual([{ sizeLabel: 'Square', width: 1080, height: 1080 }])
  })

  it('gives no rows, columns or cells for no variants', () => {
    expect(gridAxes([])).toEqual({ rows: [], columns: [], cells: [] })
  })
})
