// ST-1 (spec/app-style.md "Contrast"): text keeps 4.5:1 on its ground (SPEC 11); a control's
// edge, the focus outline and the spot colour keep 3:1 (WCAG 2.1, 1.4.11). Worked out from the
// values in tokens.css, so a changed token that breaks a pair fails here.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve('src/renderer/ui/tokens.css'), 'utf8')
const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
const rootBlock = text.slice(0, text.indexOf('@media'))

function raw(name: string): string {
  const match = rootBlock.match(new RegExp(`${name}:\\s*([^;]+);`))
  if (!match?.[1]) throw new Error(`${name} is not defined`)
  return match[1].trim()
}

// Follows var() until it reaches a hex colour.
function colour(name: string): string {
  const v = raw(name)
  const ref = v.match(/^var\((--[\w-]+)\)$/)
  if (ref?.[1]) return colour(ref[1])
  if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${name} is not a six-digit hex: ${v}`)
  return v
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0)
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

const TEXT_PAIRS: [string, string][] = [
  ...['--color-bg', '--color-page', '--color-surface'].map((g): [string, string] => [
    '--color-text',
    g,
  ]),
  ...['--color-bg', '--color-page', '--color-surface'].map((g): [string, string] => [
    '--color-text-secondary',
    g,
  ]),
  ...[
    '--color-bg',
    '--color-surface-soft',
    '--color-page',
    '--color-surface',
    '--color-accent-soft',
    '--canvas-backdrop',
  ].map((g): [string, string] => ['--color-text-muted', g]),
  ...['--color-accent', '--color-accent-hover', '--color-text'].map((g): [string, string] => [
    '--color-accent-text',
    g,
  ]),
  ...['--color-accent-soft', '--color-bg', '--color-page'].map((g): [string, string] => [
    '--color-accent-ink',
    g,
  ]),
  ['--color-danger-text', '--color-danger-bg'],
  ['--color-warn-text', '--color-warn-bg'],
  ['--color-info-text', '--color-info-bg'],
  ['--color-ok-text', '--color-ok-bg'],
  ['--selection-light', '--selection-dark'],
]

const GROUNDS = ['--color-bg', '--color-page', '--color-surface', '--color-surface-soft']

const EDGE_PAIRS: [string, string][] = [
  ...GROUNDS.map((g): [string, string] => ['--color-control-border', g]),
  ...[...GROUNDS, '--canvas-backdrop'].map((g): [string, string] => ['--color-focus', g]),
  ['--color-accent', '--color-bg'],
]

// T1: the status marks (dots and icons) keep 3:1 on every ground they sit on.
const MARK_PAIRS: [string, string][] = [
  '--color-ok',
  '--color-warn',
  '--color-danger',
  '--color-info',
].flatMap((mark) =>
  [
    '--color-bg',
    '--color-page',
    '--color-surface',
    '--color-surface-soft',
    '--color-accent-soft',
  ].map((g): [string, string] => [mark, g]),
)

describe('token contrast [ST-1, SPEC 11]', () => {
  it('works out the WCAG ratio', () => {
    expect(ratio('#767676', '#ffffff').toFixed(1)).toBe('4.5')
    expect(ratio('#ffffff', '#ffffff')).toBe(1)
  })

  it.each(TEXT_PAIRS)('%s on %s is 4.5:1 or more', (fg, bg) => {
    expect(ratio(colour(fg), colour(bg))).toBeGreaterThanOrEqual(4.5)
  })

  it.each(EDGE_PAIRS)('%s on %s is 3:1 or more', (fg, bg) => {
    expect(ratio(colour(fg), colour(bg))).toBeGreaterThanOrEqual(3)
  })

  it.each(MARK_PAIRS)('mark %s on %s is 3:1 or more', (fg, bg) => {
    expect(ratio(colour(fg), colour(bg))).toBeGreaterThanOrEqual(3)
  })
})
