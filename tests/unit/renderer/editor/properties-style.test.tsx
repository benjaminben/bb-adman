// ST-8 (spec/app-style.md "Component by component", "Editor", properties panel): the panel body
// and its field modules carry the app-style mark, so styling-rules.test.ts holds them to the
// stricter rules; geometry is a four-column grid and swatches have control edges. The text
// layer's cases moved to properties-style-text.test.tsx (ED-1b), which ED-2 owns.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const EDITOR = path.resolve('src/renderer/editor')
const read = (file: string) => fs.readFileSync(path.join(EDITOR, file), 'utf8')
const bare = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// The declarations of the first rule whose selector list is exactly `selector`.
function rule(css: string, selector: string): string {
  for (const m of bare(css).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = (m[1] ?? '').replace(/\s+/g, ' ').trim()
    if (sel === selector) return m[2] ?? ''
  }
  return ''
}

const MODULES = [
  'properties-panel/properties-panel.module.css',
  'geometry-fields/geometry-fields.module.css',
  'number-field/number-field.module.css',
  'font-field/font-field.module.css',
  'text-fields/text-fields.module.css',
  'text-box-fields/text-box-fields.module.css',
  'picture-fields/picture-fields.module.css',
  'shade-fields/shade-fields.module.css',
  'colour-choice/colour-choice.module.css',
]

describe('the properties panel takes the look [ST-8]', () => {
  it.each(MODULES.map((m) => [m]))('%s carries the app-style mark', (file) => {
    expect(read(file).startsWith('/* app-style */')).toBe(true)
  })

  it('pads the panel body and separates its groups with a line', () => {
    const css = read('properties-panel/properties-panel.module.css')
    expect(rule(css, '.body')).toMatch(/padding:\s*var\(--space-3\) var\(--pad-panel\)/)
    expect(rule(css, '.body > fieldset:not(:first-child), .body > fieldset + section')).toMatch(
      /border-top:\s*var\(--border-width\) solid var\(--color-line\)/,
    )
  })

  it('lays the geometry fields in a four-column grid', () => {
    const css = read('geometry-fields/geometry-fields.module.css')
    expect(rule(css, '.grid')).toMatch(/grid-template-columns:\s*repeat\(4,/)
  })

  it.each([['colour-choice/colour-choice.module.css']])(
    '%s gives swatches control edges',
    (file) => {
      expect(rule(read(file), '.swatch')).toMatch(
        /border:\s*var\(--border-width\) solid var\(--color-control-border\)/,
      )
    },
  )
})
