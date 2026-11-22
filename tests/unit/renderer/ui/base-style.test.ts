// ST-2 (spec/app-style.md "Shared pieces"): base.css draws the window ground, headings and
// base controls; layout.module.css holds the shared pieces. Both, and the icon module, carry
// the app-style mark so styling-rules.test.ts holds them to the stricter rules.
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

describe('the base and shared layout take the look [ST-2]', () => {
  it.each([['base.css'], ['layout.module.css'], ['icon/icon.module.css']])(
    '%s carries the app-style mark',
    (file) => {
      expect(read(file).startsWith('/* app-style */')).toBe(true)
    },
  )

  it('draws the body on the page ground with the body leading', () => {
    const body = rule(read('base.css'), 'body')
    expect(body).toMatch(/background:\s*var\(--color-page\)/)
    expect(body).toMatch(/line-height:\s*var\(--leading-body\)/)
  })

  it('sets headings in the title face and sizes', () => {
    const css = read('base.css')
    expect(rule(css, 'h1, h2, h3')).toMatch(/font-family:\s*var\(--font-title\)/)
    expect(rule(css, 'h1')).toMatch(/font-size:\s*var\(--type-page-size\)/)
    expect(rule(css, 'h2')).toMatch(/font-size:\s*var\(--type-title-size\)/)
    expect(rule(css, 'h3')).toMatch(/font-size:\s*var\(--type-title-size\)/)
  })

  it('gives buttons and fields the control edge and height', () => {
    const css = read('base.css')
    const button = rule(css, 'button')
    expect(button).toMatch(/border:[^;]*var\(--color-control-border\)/)
    expect(button).toMatch(/min-height:\s*var\(--control-height\)/)
    const field = rule(css, 'input, select, textarea')
    expect(field).toMatch(/border:[^;]*var\(--color-control-border\)/)
    expect(bare(css)).not.toMatch(/var\(--color-border\)/)
  })

  it('sets b and strong at the bold weight', () => {
    expect(rule(read('base.css'), 'b, strong')).toMatch(/font-weight:\s*var\(--weight-bold\)/)
  })

  it('holds every shared piece, and the label uses the medium weight', () => {
    const css = read('layout.module.css')
    const names = [
      'card',
      'field',
      'label',
      'row',
      'muted',
      'primary',
      'quiet',
      'danger',
      'small',
      'large',
      'iconOnly',
      'link',
      'seg',
      'switch',
      'badge',
      'warn',
      'info',
      'ok',
      'neutral',
      'accent',
      'chip',
      'notice',
      'menu',
      'menuItem',
      'menuLabel',
      'table',
      'progress',
      'empty',
      'reading',
      'formGrid',
    ]
    const missing = names.filter((n) => !new RegExp(`\\.${n}(?![\\w-])`).test(bare(css)))
    expect(missing).toEqual([])
    expect(rule(css, '.field > label, .label')).toMatch(/font-weight:\s*var\(--weight-medium\)/)
  })
})
