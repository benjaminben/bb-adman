// spec/screens-variants.md, "The overview" (A-144): the grid order inside a direction. The
// master first, then the campaign's sizes order, then its languages order, then image before
// video, then createdAt.
import { describe, expect, it } from 'vitest'
import { directionOrder } from '@/renderer/screens/campaign/direction-grids/direction-order'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { variant } from './campaign-fixture'

const SIZES: CampaignSize[] = [
  { label: '9x16', width: 1080, height: 1920 },
  { label: '1x1', width: 1080, height: 1080 },
]
const CAMPAIGN = { sizes: SIZES, languages: ['en', 'de'] }
const at = (n: number) => `2026-11-21T00:00:0${n}.000Z`

describe('directionOrder [A-144]', () => {
  it.each([
    {
      rule: 'master first',
      variants: [variant('A', { sizeLabel: '9x16' }), variant('M', { sizeLabel: '1x1' })],
      want: ['M', 'A'],
    },
    {
      rule: "the campaign's size order",
      variants: [variant('A', { sizeLabel: '1x1' }), variant('B', { sizeLabel: '9x16' })],
      want: ['B', 'A'],
    },
    {
      rule: 'a size the campaign does not list goes after the listed ones',
      variants: [variant('A', { sizeLabel: '4x5' }), variant('B', { sizeLabel: '1x1' })],
      want: ['B', 'A'],
    },
    {
      rule: "the campaign's language order",
      variants: [variant('A', { language: 'de' }), variant('B', { language: 'en' })],
      want: ['B', 'A'],
    },
    {
      rule: 'image before video',
      variants: [variant('A', { format: 'video' }), variant('B', { format: 'image' })],
      want: ['B', 'A'],
    },
    {
      rule: 'then createdAt',
      variants: [variant('A', { createdAt: at(2) }), variant('B', { createdAt: at(1) })],
      want: ['B', 'A'],
    },
    {
      rule: 'size before language before format',
      variants: [
        variant('A', { sizeLabel: '1x1', language: 'en', format: 'image' }),
        variant('B', { sizeLabel: '9x16', language: 'de', format: 'video' }),
        variant('C', { sizeLabel: '9x16', language: 'de', format: 'image' }),
        variant('D', { sizeLabel: '9x16', language: 'en', format: 'video' }),
      ],
      want: ['D', 'C', 'B', 'A'],
    },
  ])('$rule', ({ variants, want }) => {
    expect(directionOrder(variants, CAMPAIGN, 'M').map((v) => v.id)).toEqual(want)
  })

  it('does not change the list it is given', () => {
    const variants = [variant('A', { sizeLabel: '1x1' }), variant('B', { sizeLabel: '9x16' })]
    directionOrder(variants, CAMPAIGN, 'M')
    expect(variants.map((v) => v.id)).toEqual(['A', 'B'])
  })
})
