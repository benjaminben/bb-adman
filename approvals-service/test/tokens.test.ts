import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// spec/phases/round-2-approvals.md "Where the look comes from (item 18)" and S-11: the pages
// draw from the app's copied tokens, a few gallery tokens and one small base sheet. No sheet
// fetches anything, and every component sheet names only those tokens.

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8')

const GLOBAL_SHEETS = ['src/ui/app-tokens.css', 'src/ui/gallery-tokens.css', 'src/ui/base.css']
const MODULES = readdirSync(join(ROOT, 'src/ui'), { recursive: true, encoding: 'utf8' })
  .filter((name) => name.endsWith('.module.css'))
  .map((name) => join('src/ui', name))

// Every custom property a sheet defines (`--name:`) or reads (`var(--name`).
const defined = (css: string) => [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])
const used = (css: string) => [...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1])
const withoutComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('the stylesheets fetch nothing [S-11]', () => {
  it.each([...GLOBAL_SHEETS, ...MODULES])(
    '%s holds no url(, @import, @font-face or http',
    (path) => {
      const css = read(path).toLowerCase()
      for (const banned of ['url(', '@import', '@font-face', 'http']) {
        expect(css).not.toContain(banned)
      }
    },
  )
})

describe('the global stylesheets', () => {
  it('imports the app tokens, the gallery tokens and base.css, in that order, and nothing else', () => {
    const imports = [...read('app/layout.tsx').matchAll(/^import\s+'([^']+\.css)'/gm)].map(
      (m) => m[1],
    )
    expect(imports).toEqual([
      '../src/ui/app-tokens.css',
      '../src/ui/gallery-tokens.css',
      '../src/ui/base.css',
    ])
  })

  it('has no old tokens.css left', () => {
    expect(existsSync(join(ROOT, 'src/ui/tokens.css'))).toBe(false)
  })

  it('builds every gallery token on app tokens or a fixed size', () => {
    const app = new Set(defined(read('src/ui/app-tokens.css')))
    const gallery = read('src/ui/gallery-tokens.css')
    expect(defined(gallery).sort()).toEqual([
      '--gallery-card-min',
      '--gallery-field-text',
      '--gallery-masonry-row',
      '--gallery-placeholder',
      '--gallery-sidebar',
      '--gallery-tap',
      '--gallery-tick',
    ])
    for (const name of used(gallery)) expect(app.has(name), name).toBe(true)
  })
})

describe('the component sheets', () => {
  const known = new Set(GLOBAL_SHEETS.flatMap((path) => defined(read(path))))

  it.each([...MODULES, 'src/ui/base.css'])('%s reads only app or gallery tokens', (path) => {
    for (const name of used(read(path))) expect(known.has(name), name).toBe(true)
  })

  it.each([...MODULES, 'src/ui/base.css'])('%s writes no raw colour, size or font', (path) => {
    // The one raw value allowed is the 48rem width in a media query.
    const css = withoutComments(read(path)).replace(/@media \(min-width: 48rem\)/g, '')
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)
    expect(css).not.toMatch(/\d(px|rem|em|pt|vw)\b/)
    expect(css).not.toMatch(/font-family:(?!\s*var\()/)
  })
})
