// T1 (spec/app-style.md "Tokens the design wave adds and changes (T1)"): the design wave's role
// tokens, the smaller heights, the type aliases and the compact density block.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve('src/renderer/ui/tokens.css'), 'utf8')
const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
const rootBlock = text.slice(0, text.indexOf('@media'))

function value(name: string): string | undefined {
  const match = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`))
  return match?.[1]?.trim()
}

const ADDED: [string, string][] = [
  ['--gap-tight', 'var(--space-1)'],
  ['--gap-inline', 'var(--space-2)'],
  ['--gap-field', 'var(--space-3)'],
  ['--gap-section', 'var(--space-6)'],
  ['--pad-panel', 'var(--space-3)'],
  ['--pad-dialog', 'var(--space-6)'],
  ['--pad-page', 'var(--space-8)'],
  ['--type-page-size', '24px'],
  ['--type-page-weight', 'var(--weight-title)'],
  ['--type-title-size', '17px'],
  ['--type-title-weight', 'var(--weight-title)'],
  ['--type-section-size', '12px'],
  ['--type-section-weight', 'var(--weight-bold)'],
  ['--type-body-size', '13px'],
  ['--type-body-weight', 'var(--weight-regular)'],
  ['--type-reading-size', '15px'],
  ['--type-reading-weight', 'var(--weight-regular)'],
  ['--type-meta-size', '12px'],
  ['--type-meta-weight', 'var(--weight-regular)'],
  ['--color-ok', '#1f8a4c'],
  ['--color-warn', '#b86e00'],
  ['--color-danger', '#c2281f'],
  ['--color-info', '#2a6bd1'],
  ['--color-selected-bg', 'var(--color-accent-soft)'],
  ['--color-row-hover', 'var(--color-surface)'],
  ['--section-header-height', '32px'],
  ['--infotip-width', '280px'],
  ['--field-label-width', '72px'],
  ['--mark-icon', '14px'],
]

const HEIGHTS: [string, string][] = [
  ['--control-height', '32px'],
  ['--control-height-small', '24px'],
  ['--control-height-large', '40px'],
  ['--row-height', '36px'],
]

const ALIASES: [string, string][] = [
  ['--font-size-small', 'var(--type-meta-size)'],
  ['--font-size-control', 'var(--type-body-size)'],
  ['--font-size-reading', 'var(--type-reading-size)'],
  ['--font-size-heading', 'var(--type-title-size)'],
  ['--font-size-page', 'var(--type-page-size)'],
  ['--font-size-body', '14px'],
  ['--font-size-title', '21px'],
  ['--font-size-wordmark', '24px'],
]

const REMOVED = ['--width-start-art', '--drawing-height', '--drawing-stroke', '--motion-calm']

describe('the design wave tokens [T1]', () => {
  it.each(ADDED)('adds %s as %s', (name, expected) => {
    expect(value(name)).toBe(expected)
  })

  it('places the added tokens under the "Design wave: roles." comment', () => {
    const start = css.indexOf('/* Design wave: roles. */')
    expect(start).toBeGreaterThan(-1)
    expect(css.indexOf('--gap-tight:')).toBeGreaterThan(start)
  })

  it.each(HEIGHTS)('sets %s to %s', (name, expected) => {
    expect(value(name)).toBe(expected)
  })

  it.each(ALIASES)('sets %s to %s', (name, expected) => {
    expect(value(name)).toBe(expected)
  })

  it.each(REMOVED)('no longer defines %s anywhere in the file', (name) => {
    expect(css).not.toContain(name)
  })

  it('drops the "Start page drawings" comment', () => {
    expect(css).not.toContain('Start page drawings')
  })

  it('ends with the compact density block, after the reduced-motion block', () => {
    const media = text.indexOf('@media')
    const compact = text.indexOf("[data-density='compact']")
    expect(media).toBeGreaterThan(-1)
    expect(compact).toBeGreaterThan(media)
    const block = text.slice(compact).match(/^\[data-density='compact'\]\s*\{([^}]*)\}\s*$/)
    expect(block).not.toBeNull()
    const decls = (block?.[1] ?? '')
      .split(';')
      .map((d) => d.trim().replace(/\s*:\s*/, ': '))
      .filter(Boolean)
    expect(decls).toEqual([
      '--control-height: 28px',
      '--row-height: 32px',
      '--gap-field: var(--space-2)',
      '--gap-section: var(--space-4)',
      '--icon-size: 14px',
    ])
  })
})
