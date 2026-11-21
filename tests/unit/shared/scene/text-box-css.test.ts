// LK-2 (security class): textBoxCss turns a text layer's look fields into the outer box's CSS,
// as spec/scene.md "Text boxes" says. An outside agent can send these values, so colours go
// only through rgbCss, numbers are clamped to LOOK_LIMITS and the alignment through a table.
import { describe, expect, it } from 'vitest'
import type { TextStyle } from '@/shared/schemas/layer'
import { textBoxCss } from '@/shared/scene/text-box-css'
import { textStyle } from './fixtures'

const css = (look: Record<string, unknown>) => textBoxCss({ ...textStyle, ...look } as TextStyle)

describe('textBoxCss [LK-2]', () => {
  it('gives no fill, no border, radius 0, padding 0 and flex-start for a style without look fields', () => {
    expect(textBoxCss(textStyle)).toEqual({
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box',
      overflow: 'visible',
      justifyContent: 'flex-start',
      padding: '0px',
      border: 'none',
      borderRadius: '0px',
    })
  })

  it.each([
    { look: { verticalAlign: 'top' }, key: 'justifyContent', want: 'flex-start' },
    { look: { verticalAlign: 'middle' }, key: 'justifyContent', want: 'center' },
    { look: { verticalAlign: 'bottom' }, key: 'justifyContent', want: 'flex-end' },
    { look: { verticalAlign: 'baseline' }, key: 'justifyContent', want: 'flex-start' },
    { look: { verticalAlign: 'constructor' }, key: 'justifyContent', want: 'flex-start' },
    { look: { boxPadding: 24 }, key: 'padding', want: '24px' },
    { look: { boxPadding: -5 }, key: 'padding', want: '0px' },
    { look: { boxPadding: 99999 }, key: 'padding', want: '2000px' },
    { look: { boxPadding: Number.NaN }, key: 'padding', want: '0px' },
    { look: { boxRadius: 12 }, key: 'borderRadius', want: '12px' },
    { look: { boxRadius: 5000 }, key: 'borderRadius', want: '2000px' },
    { look: { boxColor: '#1A2B3C' }, key: 'backgroundColor', want: 'rgb(26 43 60)' },
    { look: { boxColor: 'red' }, key: 'backgroundColor', want: undefined },
    { look: { boxColor: null }, key: 'backgroundColor', want: undefined },
    {
      look: { boxOutlineColor: '#FFFFFF', boxOutlineWidth: 3 },
      key: 'border',
      want: '3px solid rgb(255 255 255)',
    },
    {
      look: { boxOutlineColor: '#FFFFFF', boxOutlineWidth: 500 },
      key: 'border',
      want: '100px solid rgb(255 255 255)',
    },
    { look: { boxOutlineColor: '#FFFFFF', boxOutlineWidth: 0 }, key: 'border', want: 'none' },
    { look: { boxOutlineColor: '#FFFFFF' }, key: 'border', want: 'none' },
    { look: { boxOutlineColor: null, boxOutlineWidth: 4 }, key: 'border', want: 'none' },
    { look: { boxOutlineColor: '#FFF', boxOutlineWidth: 4 }, key: 'border', want: 'none' },
  ])('$look gives $key $want', ({ look, key, want }) => {
    expect(css(look)[key as keyof ReturnType<typeof css>]).toBe(want)
  })

  it('puts nothing of a field text in the CSS except through rgbCss', () => {
    const hostile = 'url(https://x.test/a.png); position: fixed'
    const drawn = css({
      verticalAlign: hostile,
      boxColor: hostile,
      boxOutlineColor: `#FFFFFF; ${hostile}`,
      boxOutlineWidth: hostile,
      boxRadius: hostile,
      boxPadding: hostile,
    })
    const text = JSON.stringify(drawn)
    for (const piece of ['url', 'fixed', 'position', ';', 'x.test'])
      expect(text).not.toContain(piece)
    expect(drawn).toEqual(textBoxCss(textStyle))
  })
})
