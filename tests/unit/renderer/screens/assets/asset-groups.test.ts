// R2C-5 (spec/phases/round-2-campaign.md, design addition 5): the panel's groups by kind,
// ordered by display name then ID; "Other files" only when it holds something.
import { describe, expect, it } from 'vitest'
import { assetGroups } from '@/renderer/screens/assets/assets-panel/asset-groups'
import { assetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { asset } from './assets-fixture'

const view = (id: string, over: Parameters<typeof asset>[1] = {}) => assetView(asset(id, over))

describe('assetGroups [R2C-5]', () => {
  it('puts each kind in its group', () => {
    const groups = assetGroups([
      view('p', { kind: 'image' }),
      view('c', { kind: 'video' }),
      view('f', { kind: 'font' }),
      view('a', { kind: 'audio' }),
      view('t', { kind: 'text' }),
    ])
    expect(groups.map((g) => [g.title, g.items.map((i) => i.id)])).toEqual([
      ['Pictures', ['p']],
      ['Clips', ['c']],
      ['Fonts', ['f']],
      ['Other files', ['a', 't']],
    ])
  })

  it('orders by display name, ignoring case and accents, then by ID', () => {
    const groups = assetGroups([
      view('z2', { displayName: 'beach.png' }),
      view('z1', { displayName: 'Beach.png' }),
      view('y', { displayName: 'Ácai.png' }),
      view('x', { displayName: 'cup.png' }),
    ])
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['y', 'z1', 'z2', 'x'])
  })

  it('gives the empty lines and leaves out an empty "Other files"', () => {
    const groups = assetGroups([])
    expect(groups.map((g) => [g.title, g.empty])).toEqual([
      ['Pictures', 'No pictures yet.'],
      ['Clips', 'No clips yet.'],
      ['Fonts', 'No fonts yet.'],
    ])
  })
})
