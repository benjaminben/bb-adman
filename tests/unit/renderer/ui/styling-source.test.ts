// LO-1c [D-084]: tokens.css is the one styling source. Every other renderer CSS file takes
// colours and pixel lengths from its custom properties, so one edit restyles the whole app.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER = path.resolve('src/renderer')
const TOKENS = path.join(RENDERER, 'ui', 'tokens.css')

// A literal a rule truly needs, with the reason. Keyed by file (relative to src/renderer).
const ALLOWED: { file: string; literal: string; reason: string }[] = [
  {
    file: 'screens/settings/key-row/key-row.module.css',
    literal: '1px',
    reason: 'the visually-hidden label is a 1px box by definition; not a design value',
  },
]

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return cssFiles(full)
    return e.name.endsWith('.css') ? [full] : []
  })
}

function withoutComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

// Colour literals (hex, rgb, hsl) and px lengths other than 0.
function literals(css: string): string[] {
  const text = withoutComments(css)
  const colours = text.match(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?)\(/g) ?? []
  const lengths = (text.match(/(?<![\w.-])\d*\.?\d+px\b/g) ?? []).filter((v) => parseFloat(v) !== 0)
  return [...colours, ...lengths]
}

function tokenNames(css: string): Set<string> {
  return new Set([...withoutComments(css).matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1] ?? ''))
}

const files = cssFiles(RENDERER).filter((f) => f !== TOKENS)

describe('one styling source [LO-1c, D-084]', () => {
  it('finds the renderer CSS files', () => {
    expect(files.length).toBeGreaterThan(5)
  })

  it.each(files.map((f) => [path.relative(RENDERER, f)]))(
    '%s has no raw colour or px length outside the allow-list',
    (rel) => {
      const allowed = ALLOWED.filter((a) => a.file === rel).map((a) => a.literal)
      const found = literals(fs.readFileSync(path.join(RENDERER, rel), 'utf8'))
      expect(found.filter((v) => !allowed.includes(v))).toEqual([])
    },
  )

  it('flags a hex, rgb, hsl or px literal, and lets 0px and token use pass', () => {
    expect(literals('a { color: #fff; background: rgb(0 0 0 / 40%); }')).toEqual(['#fff', 'rgb('])
    expect(literals('a { color: hsl(0 0% 0%); width: 12px; margin: 0px; }')).toEqual([
      'hsl(',
      '12px',
    ])
    expect(literals('a { padding: var(--space-2); /* 8px */ }')).toEqual([])
  })

  it('every custom property used in renderer CSS is defined in tokens.css', () => {
    const defined = tokenNames(fs.readFileSync(TOKENS, 'utf8'))
    const used = files.flatMap((f) =>
      [...fs.readFileSync(f, 'utf8').matchAll(/var\((--[\w-]+)/g)].map((m) => m[1] ?? ''),
    )
    expect(used.filter((name) => !defined.has(name))).toEqual([])
  })

  it('tokens.css holds the type scale, mono font, overlay colour, line widths and layout widths', () => {
    const defined = tokenNames(fs.readFileSync(TOKENS, 'utf8'))
    const required = [
      '--font-size-body',
      '--font-size-heading',
      '--font-mono',
      '--color-overlay',
      '--border-width',
      '--focus-ring-width',
      '--focus-ring-offset',
      '--width-page',
      '--width-column-min',
      '--width-dialog',
    ]
    expect(required.filter((name) => !defined.has(name))).toEqual([])
  })

  it('the Connect line font comes from --font-mono', () => {
    const base = withoutComments(fs.readFileSync(path.join(RENDERER, 'ui', 'base.css'), 'utf8'))
    expect(base).toMatch(/\bcode\b[^{]*\{[^}]*font-family:\s*var\(--font-mono\)/)
  })
})
