import { describe, it, expect } from 'vitest'
import { withBrandColours } from '@/shared/templates/brand-colours'
import { buildMasterLayers } from '@/shared/templates/master-layers'
import { starterTemplate } from '@/shared/templates/starter'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { NewLayer } from '@/shared/templates/types'
import type { TextStyle } from '@/shared/schemas/layer'

const SQUARE = { label: '1x1', width: 1080, height: 1080 }
const BRAND = ['#0B3D2E', '#FFF6E5']
const FILLS = {
  background: { assetId: 'bg' },
  'subject-image': { assetId: 'subject' },
  logo: { assetId: 'logo' },
  headline: { text: 'Fresh for summer' },
  'call-to-action': { text: 'Shop now' },
}

// The master of one starter layout: photo-bottom-left has white text, photo-label-box a
// #111111 headline on a white label and white text on a #111111 button.
function master(id = 'photo-bottom-left'): NewLayer[] {
  const layout = STARTER_LAYOUTS.find((l) => l.id === id)
  return buildMasterLayers(starterTemplate, SQUARE, FILLS, layout)
}

const textStyle = (layers: NewLayer[], key: string) =>
  layers.find((l) => l.key === key)?.style as TextStyle

describe('withBrandColours [spec/brief-brand.md "The rules", A-406]', () => {
  it('turns white text into #FFF6E5', () => {
    const got = withBrandColours(master(), BRAND)
    expect(textStyle(got, 'headline').color).toBe('#FFF6E5')
    expect(textStyle(got, 'call-to-action').color).toBe('#FFF6E5')
  })

  it('turns near-black text into #0B3D2E', () => {
    const got = withBrandColours(master('photo-label-box'), BRAND)
    expect(textStyle(got, 'headline').color).toBe('#0B3D2E')
  })

  it('leaves a label box colour as the layout has it', () => {
    const before = master('photo-label-box')
    const got = withBrandColours(before, BRAND)
    expect(textStyle(got, 'headline').boxColor).toBe('#FFFFFF')
    expect(textStyle(got, 'call-to-action').boxColor).toBe('#111111')
  })

  it('changes nothing else of a text layer', () => {
    const before = master('photo-label-box')
    const got = withBrandColours(before, BRAND)
    const strip = (layers: NewLayer[]) =>
      layers.map((l) => ({ ...l, style: { ...l.style, color: '' } }))
    expect(strip(got)).toEqual(strip(before))
  })

  it('leaves picture and background layers as they were', () => {
    const before = master('flat-bottom-left')
    const got = withBrandColours(before, BRAND)
    for (const key of ['background', 'subject-image', 'logo']) {
      expect(got.find((l) => l.key === key)).toEqual(before.find((l) => l.key === key))
    }
  })

  it('changes nothing with an empty colour list', () => {
    const before = master('flat-bottom-left')
    expect(withBrandColours(before, [])).toEqual(before)
  })

  it('gives fresh copies and leaves the input unchanged', () => {
    const before = master()
    const snapshot = structuredClone(before)
    const got = withBrandColours(before, BRAND)
    expect(before).toEqual(snapshot)
    got.forEach((layer, i) => {
      expect(layer).not.toBe(before[i])
      expect(layer.style).not.toBe(before[i]!.style)
      expect(layer.geometry).not.toBe(before[i]!.geometry)
    })
  })

  it('gives fresh copies with an empty colour list too', () => {
    const before = master()
    const got = withBrandColours(before, [])
    got.forEach((layer, i) => expect(layer.style).not.toBe(before[i]!.style))
  })
})
