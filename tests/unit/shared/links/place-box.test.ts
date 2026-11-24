import { describe, it, expect } from 'vitest'
import { anchoredBox } from '@/shared/links/place-box'
import type { Geometry } from '@/shared/schemas/layer'

const box = (x: number, y: number, width: number, height: number): Geometry => ({
  x,
  y,
  width,
  height,
  rotation: 0,
  crop: null,
})
const xywh = (g: Geometry) => [g.x, g.y, g.width, g.height]

const SQUARE = { width: 1080, height: 1080 }
const WIDE = { width: 1920, height: 1080 }
const TALL = { width: 1080, height: 1920 }
const SMALL = { width: 300, height: 250 }

const LOGO = box(80, 80, 151, 151)
const HEADLINE = box(80, 640, 920, 260)
const BUTTON = box(80, 900, 454, 97)

describe('anchoredBox: the worked values [spec/make-variants.md "Anchoring"]', () => {
  it.each([
    ['1920 × 1080', WIDE, [80, 80, 151, 151], [80, 640, 1760, 260], [80, 900, 454, 97]],
    ['1080 × 1920', TALL, [80, 80, 151, 151], [80, 1480, 920, 260], [80, 1740, 454, 97]],
    ['300 × 250', SMALL, [19, 19, 35, 35], [19, 148, 262, 60], [19, 209, 105, 22]],
  ])('at %s', (_, to, logo, headline, button) => {
    expect(xywh(anchoredBox(LOGO, SQUARE, to, false))).toEqual(logo)
    expect(xywh(anchoredBox(HEADLINE, SQUARE, to, true))).toEqual(headline)
    expect(xywh(anchoredBox(BUTTON, SQUARE, to, true))).toEqual(button)
  })
})

describe('anchoredBox: the rules [spec/make-variants.md "Anchoring"]', () => {
  it('keeps a centred picture centred', () => {
    const g = anchoredBox(box(290, 290, 500, 500), SQUARE, WIDE, false)
    expect(xywh(g)).toEqual([710, 290, 500, 500])
  })

  it('centres when the two gaps differ by 1 pixel', () => {
    const g = anchoredBox(box(290, 290, 499, 500), SQUARE, TALL, false)
    expect(xywh(g)).toEqual([291, 710, 499, 500])
  })

  it('never stretches a picture, even with both gaps smaller than its length', () => {
    const g = anchoredBox(box(80, 300, 920, 200), SQUARE, WIDE, false)
    expect(xywh(g)).toEqual([500, 300, 920, 200])
  })

  it('does not stretch a text box with one gap larger than its length', () => {
    const g = anchoredBox(box(80, 300, 400, 100), SQUARE, WIDE, true)
    expect(xywh(g)).toEqual([80, 300, 400, 100])
  })

  it('cuts a 1500-wide picture to 1080 and moves it inside at 1080 × 1920', () => {
    const g = anchoredBox(box(210, 0, 1500, 1080), WIDE, TALL, false)
    expect(g.width).toBe(1080)
    expect(g.x).toBe(0)
  })

  it('moves a box in that pokes out at the far edge', () => {
    const g = anchoredBox(box(100, 0, 1500, 1080), WIDE, TALL, false)
    expect([g.x, g.width]).toEqual([0, 1080])
  })

  it('keeps a box that ran past the bottom running past it', () => {
    const subject = box(162, 518, 756, 756)
    const g = anchoredBox(subject, SQUARE, TALL, false)
    expect(g.height).toBe(756)
    expect(g.y + g.height).toBeGreaterThan(1920)
    expect(g.y).toBe(1920 + 194 - 756)
  })

  it('keeps rotation and crop', () => {
    const crop = { x: 10, y: 20, width: 300, height: 400 }
    const g = anchoredBox({ ...LOGO, rotation: 15, crop }, SQUARE, SMALL, false)
    expect(g.rotation).toBe(15)
    expect(g.crop).toEqual(crop)
  })

  it('gives no length below 1', () => {
    const g = anchoredBox(box(10, 10, 1, 1), SQUARE, SMALL, false)
    expect([g.width, g.height]).toEqual([1, 1])
  })

  it('stretches a text box that fills the canvas to the new canvas', () => {
    const g = anchoredBox(box(0, 0, 1080, 1080), SQUARE, SMALL, true)
    expect(xywh(g)).toEqual([0, 0, 300, 250])
  })

  it('gives no stretched length below 1', () => {
    const g = anchoredBox(box(600, 0, 720, 100), WIDE, SQUARE, true)
    expect([g.x, g.width]).toEqual([600, 1])
  })

  it('keeps the same pixels when k is 1 and the size is the same', () => {
    expect(anchoredBox(BUTTON, SQUARE, SQUARE, true)).toEqual(BUTTON)
  })
})
