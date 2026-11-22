// R2C-3 (spec/phases/round-2-campaign.md, design addition 3): the arrow, Home and End moves
// over a direction's grid. Left and Right walk the row's tiles (an image then a video in a
// two-tile cell), skipping empty cells; Up and Down go to the row above or below, the same
// column if it has a tile, else the nearest column (the left one on a tie, decided here), and
// the first tile of a two-tile cell; Home and End the row's first and last tile. Edges: null.
import { describe, expect, it } from 'vitest'
import { gridAxes } from '@/renderer/screens/campaign/variant-grid/grid-axes'
import { nextTile } from '@/renderer/screens/campaign/variant-grid/grid-moves'
import { variant } from './campaign-fixture'

const SQUARE = { sizeLabel: 'Square', width: 1080, height: 1080 }
const STORY = { sizeLabel: 'Story', width: 1080, height: 1920 }
const WIDE = { sizeLabel: 'Wide', width: 1920, height: 1080 }

//          en      de                 fr
// Square   M       SQ-de              SQ-fr
// Story    ST-en   ST-de-i, ST-de-v   (empty)
// Wide     WI-en   (empty)            WI-fr
const AXES = gridAxes([
  variant('M', { ...SQUARE, language: 'en', isMaster: true }),
  variant('SQ-de', { ...SQUARE, language: 'de' }),
  variant('SQ-fr', { ...SQUARE, language: 'fr' }),
  variant('ST-en', { ...STORY, language: 'en' }),
  variant('ST-de-i', { ...STORY, language: 'de' }),
  variant('ST-de-v', { ...STORY, language: 'de', format: 'video' }),
  variant('WI-en', { ...WIDE, language: 'en' }),
  variant('WI-fr', { ...WIDE, language: 'fr' }),
])

type Row = [from: string, key: string, to: string | null]

const TABLE: Row[] = [
  ['M', 'ArrowLeft', null],
  ['M', 'ArrowRight', 'SQ-de'],
  ['M', 'ArrowUp', null],
  ['M', 'ArrowDown', 'ST-en'],
  ['M', 'Home', 'M'],
  ['M', 'End', 'SQ-fr'],
  ['SQ-de', 'ArrowLeft', 'M'],
  ['SQ-de', 'ArrowRight', 'SQ-fr'],
  ['SQ-de', 'ArrowDown', 'ST-de-i'],
  ['SQ-fr', 'ArrowRight', null],
  ['SQ-fr', 'ArrowDown', 'ST-de-i'],
  ['SQ-fr', 'ArrowUp', null],
  ['ST-en', 'ArrowRight', 'ST-de-i'],
  ['ST-en', 'ArrowUp', 'M'],
  ['ST-en', 'ArrowDown', 'WI-en'],
  ['ST-en', 'End', 'ST-de-v'],
  ['ST-de-i', 'ArrowRight', 'ST-de-v'],
  ['ST-de-i', 'ArrowLeft', 'ST-en'],
  ['ST-de-v', 'ArrowLeft', 'ST-de-i'],
  ['ST-de-v', 'ArrowRight', null],
  ['ST-de-v', 'ArrowUp', 'SQ-de'],
  ['ST-de-v', 'ArrowDown', 'WI-en'],
  ['ST-de-v', 'Home', 'ST-en'],
  ['WI-en', 'ArrowRight', 'WI-fr'],
  ['WI-en', 'ArrowDown', null],
  ['WI-en', 'ArrowUp', 'ST-en'],
  ['WI-fr', 'ArrowLeft', 'WI-en'],
  ['WI-fr', 'ArrowUp', 'ST-de-i'],
  ['WI-fr', 'Home', 'WI-en'],
  ['WI-fr', 'End', 'WI-fr'],
  ['WI-fr', 'Enter', null],
  ['nowhere', 'ArrowRight', null],
]

describe('nextTile [R2C-3, A-312]', () => {
  it.each(TABLE)('from %s, %s goes to %s', (from, key, to) => {
    expect(nextTile(AXES, from, key)).toBe(to)
  })
})
