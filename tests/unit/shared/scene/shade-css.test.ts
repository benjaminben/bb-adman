// LK-3 (security class): shadeCss turns a picture layer's shade into the CSS of the element
// drawn over its picture, as spec/scene.md "Background colour and shade" says. An outside agent
// can send a shade, so the colour goes only through rgbCss, the numbers are clamped to
// LOOK_LIMITS and the side goes through a fixed table.
import { describe, expect, it } from 'vitest'
import type { Shade } from '@/shared/schemas/layer'
import { SHADE_STOPS, shadeCss } from '@/shared/scene/shade-css'

const shade = (over: Record<string, unknown> = {}) =>
  ({ color: '#000000', from: 'bottom', strength: 0.8, reach: 0.6, ...over }) as Shade

const gradient = (to: string, a: number, b: number, mid: string, end: string) =>
  `linear-gradient(to ${to}, rgb(0 0 0 / ${a}) 0%, rgb(0 0 0 / ${b}) ${mid}, rgb(0 0 0 / 0) ${end})`

describe('shadeCss [LK-3]', () => {
  it('gives nothing for no shade', () => {
    expect(shadeCss(null)).toBeNull()
    expect(shadeCss(undefined)).toBeNull()
  })

  it('has three stops: full strength at 0, 0.45 at half the reach, 0 at the reach', () => {
    expect(SHADE_STOPS).toEqual([
      { at: 0, alpha: 1 },
      { at: 0.5, alpha: 0.45 },
      { at: 1, alpha: 0 },
    ])
  })

  it.each([
    { from: 'bottom', to: 'top' },
    { from: 'top', to: 'bottom' },
    { from: 'left', to: 'right' },
    { from: 'right', to: 'left' },
  ])('a shade from the $from fades to the $to', ({ from, to }) => {
    expect(shadeCss(shade({ from }))).toEqual({
      backgroundImage: gradient(to, 0.8, 0.36, '30%', '60%'),
    })
  })

  it('all gives a plain colour at the strength', () => {
    expect(shadeCss(shade({ from: 'all', color: '#1A2B3C', strength: 0.5 }))).toEqual({
      backgroundColor: 'rgb(26 43 60 / 0.5)',
    })
  })

  it.each([
    { over: { strength: 3 }, want: gradient('top', 1, 0.45, '30%', '60%') },
    { over: { strength: -1 }, want: gradient('top', 0, 0, '30%', '60%') },
    { over: { reach: 9 }, want: gradient('top', 0.8, 0.36, '50%', '100%') },
    { over: { reach: 0 }, want: gradient('top', 0.8, 0.36, '2.5%', '5%') },
    { over: { reach: 0.3 }, want: gradient('top', 0.8, 0.36, '15%', '30%') },
  ])('clamps $over', ({ over, want }) => {
    expect(shadeCss(shade(over))).toEqual({ backgroundImage: want })
  })

  it.each(['red', '#FFF', '#12345G', null])('a bad colour %s gives nothing', (color) => {
    expect(shadeCss(shade({ color }))).toBeNull()
    expect(shadeCss(shade({ color, from: 'all' }))).toBeNull()
  })

  it.each(['color', 'from', 'strength', 'reach'])(
    'a hostile string in %s gives the same CSS as no shade',
    (field) => {
      const hostile = 'url(https://x.test/a.png); position: fixed'
      expect(shadeCss(shade({ [field]: hostile }))).toBe(shadeCss(null))
      expect(shadeCss(shade({ from: 'all', [field]: hostile }))).toBe(shadeCss(null))
    },
  )

  it('an inherited name as the side gives nothing', () => {
    expect(shadeCss(shade({ from: 'constructor' }))).toBeNull()
    expect(shadeCss(shade({ from: '__proto__' }))).toBeNull()
  })
})
