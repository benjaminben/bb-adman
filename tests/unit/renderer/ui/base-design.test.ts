// T2 (spec/phases/design-wave.md, "T2 — Base controls"; spec/app-style-parts.md "Button" and
// "Field"): headings take the type roles, cards lose their shadow, menus sit at elevation 2,
// and the new button and field classes exist for Wave 2 to use.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const UI = path.resolve('src/renderer/ui')
const read = (file: string) => fs.readFileSync(path.join(UI, file), 'utf8')
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// The declarations of the first rule whose selector list is exactly `selector`.
function rule(css: string, selector: string): string {
  for (const m of bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (sel === selector) return m[2] ?? ''
  }
  return ''
}

const base = read('base.css')
const layout = read('layout.module.css')

describe('headings take the type roles [T2]', () => {
  it('sets h1 at the page size and weight', () => {
    const h1 = rule(base, 'h1')
    expect(h1).toMatch(/font-size:\s*var\(--type-page-size\)/)
    expect(h1).toMatch(/font-weight:\s*var\(--type-page-weight\)/)
  })

  it.each([['h2'], ['h3']])('sets %s at the title size and weight', (h) => {
    const css = rule(base, h)
    expect(css).toMatch(/font-size:\s*var\(--type-title-size\)/)
    expect(css).toMatch(/font-weight:\s*var\(--type-title-weight\)/)
  })

  it('keeps the title face on every heading', () => {
    expect(rule(base, 'h1, h2, h3')).toMatch(/font-family:\s*var\(--font-title\)/)
  })
})

describe('cards and menus take the elevation levels [T2]', () => {
  it('draws a card with no shadow', () => {
    const card = rule(layout, '.card')
    expect(card).not.toBe('')
    expect(card).not.toMatch(/box-shadow/)
  })

  it('draws a menu at elevation 2', () => {
    expect(rule(layout, '.menu')).toMatch(/box-shadow:\s*var\(--shadow-2\)/)
  })
})

describe('the new button classes [T2]', () => {
  it('names the secondary look with the default button rules', () => {
    const css = rule(layout, '.secondary')
    expect(css).toMatch(/background:\s*var\(--color-bg\)/)
    expect(css).toMatch(/border-color:\s*var\(--color-control-border\)/)
    expect(rule(layout, '.secondary:hover:not(:disabled)')).toMatch(
      /background:\s*var\(--color-surface-soft\)/,
    )
  })

  it('draws an icon button square at the small height, with no edge', () => {
    const css = rule(layout, '.iconButton')
    for (const prop of ['width', 'height', 'min-height']) {
      expect(css).toMatch(new RegExp(`(^|[;\\s])${prop}:\\s*var\\(--control-height-small\\)`))
    }
    expect(css).toMatch(/border-color:\s*transparent/)
    expect(css).toMatch(/background:\s*transparent/)
    expect(rule(layout, '.iconButton:hover:not(:disabled)')).toMatch(
      /background:\s*var\(--color-row-hover\)/,
    )
    expect(rule(layout, ".iconButton[aria-pressed='true']")).toMatch(
      /color:\s*var\(--color-accent-ink\)/,
    )
  })

  it('draws the danger action on the danger text colour as its ground', () => {
    const css = rule(layout, '.primary.danger')
    expect(css).toMatch(/background:\s*var\(--color-danger-text\)/)
    expect(css).toMatch(/border-color:\s*var\(--color-danger-text\)/)
    expect(css).toMatch(/color:\s*var\(--color-accent-text\)/)
    expect(rule(layout, '.primary.danger:hover:not(:disabled)')).toMatch(
      /background:\s*var\(--color-danger-text\)/,
    )
  })
})

describe('the new field classes [T2]', () => {
  it('lays an inline field out as a grid with the label column first', () => {
    const css = rule(layout, '.field.inline')
    expect(css).toMatch(/display:\s*grid/)
    expect(css).toMatch(/grid-template-columns:\s*var\(--field-label-width\) 1fr/)
    expect(css).toMatch(/gap:\s*var\(--gap-inline\)/)
    expect(css).toMatch(/align-items:\s*center/)
  })

  it('draws the unit box as one field with the control edge', () => {
    const css = rule(layout, '.unitBox')
    expect(css).toMatch(/border:\s*var\(--border-width\) solid var\(--color-control-border\)/)
    expect(css).toMatch(/border-radius:\s*var\(--radius\)/)
    expect(css).toMatch(/height:\s*var\(--control-height\)/)
    expect(css).toMatch(/background:\s*var\(--color-bg\)/)
    expect(rule(layout, '.unitBox > input')).toMatch(/border:\s*0/)
  })

  it('draws the focus outline on the unit box when its input has focus', () => {
    const css = rule(layout, '.unitBox:focus-within')
    expect(css).toMatch(/outline:\s*var\(--focus-ring-width\) solid var\(--color-focus\)/)
    expect(css).toMatch(/outline-offset:\s*var\(--focus-ring-offset\)/)
  })

  it('sets the unit in the meta size and muted colour', () => {
    const css = rule(layout, '.unit')
    expect(css).toMatch(/font-size:\s*var\(--type-meta-size\)/)
    expect(css).toMatch(/color:\s*var\(--color-text-muted\)/)
  })
})
