// ST-1 and ST-14 (spec/phases/app-style.md "The stricter rules"): every renderer CSS file but
// tokens.css takes its type, shadows and times from tokens.css, with no mark needed.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const RENDERER = path.resolve('src/renderer')
const TOKENS = path.join(RENDERER, 'ui', 'tokens.css')

function cssFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return cssFiles(full)
    return e.name.endsWith('.css') ? [full] : []
  })
}

function declarations(css: string): [string, string][] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const bodies = [...text.matchAll(/\{([^{}]*)\}/g)].map((m) => m[1] ?? '')
  return bodies.flatMap((body) =>
    body
      .split(';')
      .map((d) => d.match(/^\s*([\w-]+)\s*:\s*([\s\S]+?)\s*$/))
      .flatMap((m): [string, string][] => (m?.[1] && m[2] ? [[m[1], m[2]]] : [])),
  )
}

const TYPE = new Set(['font-family', 'font-size', 'font-weight', 'line-height'])
const TIMED = new Set([
  'transition',
  'transition-duration',
  'transition-delay',
  'animation',
  'animation-duration',
  'animation-delay',
])
const TOKEN = /var\(--[\w-]+\)/g
const TIME = /(?<![\w.-])\d*\.?\d+m?s\b/

function typeOk(value: string): boolean {
  if (value === 'inherit' || value === 'normal') return true
  return value.replace(TOKEN, '').replace(/[\s,]/g, '') === '' && value.includes('var(')
}

function shadowOk(value: string): boolean {
  if (value === 'none') return true
  const rest = value
    .replace(TOKEN, 'T')
    .replace(/calc\(([^()]*)\)/g, (whole, inner: string) =>
      /^[T\s+\-*/\d.]*$/.test(inner) ? 'T' : whole,
    )
  return rest.split(/[\s,]+/).every((part) => ['', 'T', '0', 'inset'].includes(part))
}

function problems(css: string): string[] {
  const found: string[] = []
  const decls = declarations(css)
  for (const [prop, value] of decls) {
    if (TYPE.has(prop) && !typeOk(value)) found.push(`${prop}: ${value}`)
    if (prop === 'box-shadow' && !shadowOk(value)) found.push(`${prop}: ${value}`)
    if (TIMED.has(prop) && TIME.test(value)) found.push(`${prop}: ${value}`)
  }
  const animated = decls.some(([prop]) => prop.startsWith('animation'))
  if (animated && !/@media\s*\(prefers-reduced-motion:\s*reduce\)/.test(css)) {
    found.push('animation without a prefers-reduced-motion: reduce rule')
  }
  return found
}

const ruled = cssFiles(RENDERER).filter((f) => f !== TOKENS)

describe('the stricter styling rules [ST-1, ST-14]', () => {
  it('every renderer CSS file but tokens.css keeps them', () => {
    const bad = ruled.flatMap((f) =>
      problems(fs.readFileSync(f, 'utf8')).map((p) => `${path.relative(RENDERER, f)}: ${p}`),
    )
    expect(bad).toEqual([])
  })

  it.each([
    ['a { font-size: 13px; }'],
    ['a { font-weight: 600; }'],
    ['a { font-family: Georgia, serif; }'],
    ['a { line-height: 1.45; }'],
    ['a { box-shadow: 0 1px 2px var(--x); }'],
    ['a { transition: left 0.15s; }'],
    ['a { transition-duration: .2s; }'],
    ['a { animation: spin 1s linear infinite; }'],
    ['a { animation: spin var(--motion-spin) linear infinite; }'],
  ])('flags %s', (css) => {
    expect(problems(css)).not.toEqual([])
  })

  it.each([
    ['a { font-size: var(--font-size-control); }'],
    ['a { font-weight: var(--weight-bold); }'],
    ['a { font-family: var(--font-body); line-height: normal; }'],
    ['a { font-size: inherit; }'],
    ['a { box-shadow: var(--shadow-1); }'],
    ['a { box-shadow: none; }'],
    ['a { box-shadow: inset 0 0 0 var(--border-width) var(--color-line); }'],
    ['a { box-shadow: 0 calc(var(--space-1) * -1) 0 var(--color-line); }'],
    ['a { transition: left var(--motion-fast) var(--ease-calm); }'],
    [
      'a { animation: spin var(--motion-spin) linear infinite; }' +
        ' @media (prefers-reduced-motion: reduce) { a { animation: none; } }',
    ],
  ])('lets %s pass', (css) => {
    expect(problems(css)).toEqual([])
  })
})
