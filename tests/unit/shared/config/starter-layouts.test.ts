import { describe, it, expect } from 'vitest'
import { DEFAULT_STARTER_LAYOUT_ID, STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import { DEFAULT_STARTER_LAYOUT, SLOT_LAYOUTS } from '@/shared/config/default-layout'
import { HEX_COLOUR, Shade } from '@/shared/schemas/layer'
import { frameOf, geometryOf } from '@/shared/templates/layout-rules'

const SIZES = [
  [1080, 1080],
  [1080, 1920],
  [1920, 1080],
  [1080, 1350],
  [50, 8192],
  [8192, 50],
] as const

// The one box on purpose past an edge: layout 4's subject runs off the bottom.
const RUNS_OFF: Record<string, string[]> = { 'flat-centre-top': ['subject-image'] }

type Box = { x: number; y: number; width: number; height: number }
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('STARTER_LAYOUTS [spec/starter-layouts.md]', () => {
  it('holds five layouts with unique kebab-case IDs, the default first', () => {
    expect(STARTER_LAYOUTS).toHaveLength(5)
    const ids = STARTER_LAYOUTS.map((l) => l.id)
    expect(new Set(ids).size).toBe(5)
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/)
    expect(DEFAULT_STARTER_LAYOUT_ID).toBe('photo-bottom-left')
    expect(STARTER_LAYOUTS[0]).toBe(DEFAULT_STARTER_LAYOUT)
    expect(ids).toEqual([
      'photo-bottom-left',
      'photo-top-centre',
      'flat-bottom-left',
      'flat-centre-top',
      'photo-label-box',
    ])
  })

  it.each(STARTER_LAYOUTS.map((l) => [l.id, l] as const))(
    '%s names the four slots, a text rule for each copy slot, and only good colours',
    (_, layout) => {
      expect(layout.name.length).toBeGreaterThan(0)
      expect(layout.description.length).toBeGreaterThan(0)
      expect(Object.keys(layout.slots).sort()).toEqual(Object.keys(SLOT_LAYOUTS).sort())
      expect(layout.slots.headline?.text).toBeDefined()
      expect(layout.slots['call-to-action']?.text).toBeDefined()
      const colours = [layout.background.fillColor, layout.background.shade?.color]
      for (const slot of Object.values(layout.slots)) {
        colours.push(slot.text?.color, slot.textBox?.boxColor, slot.textBox?.boxOutlineColor)
        colours.push(slot.shade?.color)
        if (slot.shade) expect(Shade.safeParse(slot.shade).success).toBe(true)
      }
      if (layout.background.shade) {
        expect(Shade.safeParse(layout.background.shade).success).toBe(true)
      }
      for (const c of colours) if (c != null) expect(c).toMatch(HEX_COLOUR)
    },
  )

  const cases = STARTER_LAYOUTS.flatMap((l) => SIZES.map(([w, h]) => [l.id, w, h, l] as const))
  it.each(cases)('%s at %ix%i: boxes of at least 1, inside, not overlapping', (id, W, H, l) => {
    const f = frameOf({ width: W, height: H })
    const boxes = Object.entries(l.slots).map(([slot, s]) => [slot, geometryOf(s.box, f)] as const)
    for (const [slot, b] of boxes) {
      expect(b.width).toBeGreaterThanOrEqual(1)
      expect(b.height).toBeGreaterThanOrEqual(1)
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.width).toBeLessThanOrEqual(W)
      if (!RUNS_OFF[id]?.includes(slot)) expect(b.y + b.height).toBeLessThanOrEqual(H)
    }
    for (const [i, [a, boxA]] of boxes.entries()) {
      for (const [b, boxB] of boxes.slice(i + 1)) {
        expect(overlap(boxA, boxB), `${a} and ${b}`).toBe(false)
      }
    }
  })
})
