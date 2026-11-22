// @vitest-environment node
// R2-Q fault B: the spinner shown while a run goes (the "Running" badge on a variant tile, the
// tab mark, a busy line) turns. The turn belongs to the spinner icon itself, so every place
// that draws the icon turns it, and no wrapper turns it a second time. Each check reads the
// CSS as the build makes it (CSS modules rename class and keyframes names), so an animation
// that points at keyframes that do not exist fails here.
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { preprocessCSS, resolveConfig, type ResolvedConfig } from 'vite'
import { beforeAll, describe, expect, it } from 'vitest'
import { Icon } from '@/renderer/ui/icon'
import iconStyles from '@/renderer/ui/icon/icon.module.css'

const RENDERER = path.resolve('src/renderer')
const ICON_CSS = path.join(RENDERER, 'ui', 'icon', 'icon.module.css')

function moduleFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) return moduleFiles(full)
    return e.name.endsWith('.module.css') ? [full] : []
  })
}

type Built = { code: string; classes: Record<string, string> }

let config: ResolvedConfig
async function build(file: string): Promise<Built> {
  const out = await preprocessCSS(fs.readFileSync(file, 'utf8'), file, config)
  return { code: out.code, classes: out.modules ?? {} }
}

const KEYWORDS = /^(none|infinite|linear|ease(-in|-out|-in-out)?|alternate|both|forwards)$/
// The keyframes names an `animation` or `animation-name` value points at.
function animationNames(code: string): string[] {
  const values = [...code.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)].map((m) => m[1] ?? '')
  return values.flatMap((value) =>
    value
      .replace(/var\([^)]*\)|cubic-bezier\([^)]*\)|steps\([^)]*\)/g, ' ')
      .split(',')
      .flatMap((part) => part.trim().split(/\s+/))
      .filter((word) => /^[A-Za-z_-][\w-]*$/.test(word) && !KEYWORDS.test(word)),
  )
}

const keyframes = (code: string) => [...code.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])

// The declarations of a built class's rules, optionally only inside the reduce-motion block.
function ruleOf(code: string, className: string, reduced: boolean): string {
  const reduceAt = code.indexOf('prefers-reduced-motion')
  const part = reduced ? code.slice(reduceAt) : reduceAt < 0 ? code : code.slice(0, reduceAt)
  const match = part.match(new RegExp(`\\.${className}\\s*\\{([^}]*)\\}`))
  return match?.[1] ?? ''
}

beforeAll(async () => {
  config = await resolveConfig({ configFile: false }, 'build')
})

describe('every CSS module animation names keyframes that exist once built', () => {
  const files = moduleFiles(RENDERER).filter((f) => /animation/.test(fs.readFileSync(f, 'utf8')))
  it.each(files.map((f) => [path.relative(RENDERER, f), f]))('%s', async (_, file) => {
    const built = await build(file)
    const defined = keyframes(built.code)
    for (const name of animationNames(built.code)) expect(defined).toContain(name)
  })
})

describe('the spinner icon turns [R2-Q B]', () => {
  it('draws the spinner icon with the turning class, and no other icon with it', async () => {
    expect((await build(ICON_CSS)).classes.spin).toBeDefined()
    const spin = iconStyles.spin as string
    expect(spin).toBeTruthy()
    const spinner = renderToStaticMarkup(createElement(Icon, { name: 'spinner' }))
    const small = renderToStaticMarkup(createElement(Icon, { name: 'spinner', size: 'small' }))
    const other = renderToStaticMarkup(createElement(Icon, { name: 'file' }))
    expect(spinner).toContain(spin)
    expect(small).toContain(spin)
    expect(other).not.toContain(spin)
  })

  it('turns with a rotation in the spin time', async () => {
    const built = await build(ICON_CSS)
    const rule = ruleOf(built.code, built.classes.spin ?? '?', false)
    expect(rule).toMatch(/animation:.*var\(--motion-spin\).*infinite/)
    const [name] = animationNames(rule)
    expect(keyframes(built.code)).toContain(name)
    expect(built.code).toMatch(new RegExp(`@keyframes ${name}\\s*\\{[^@]*rotate\\(360deg\\)`))
  })

  it('pulses gently instead of turning with reduce motion, so it never looks frozen', async () => {
    const built = await build(ICON_CSS)
    const rule = ruleOf(built.code, built.classes.spin ?? '?', true)
    expect(rule).toMatch(/animation:.*infinite/)
    const [name] = animationNames(rule)
    expect(keyframes(built.code)).toContain(name)
    expect(built.code).toMatch(new RegExp(`@keyframes ${name}\\s*\\{[^@]*opacity`))
    expect(built.code).not.toMatch(new RegExp(`@keyframes ${name}\\s*\\{[^@]*transform`))
  })

  it.each([
    ['the busy line', 'ui/dialog-frame/dialog-frame.module.css'],
    ['the tab mark', 'ui/tab-marks/tab-marks.module.css'],
  ])('%s does not turn the icon a second time', async (_, file) => {
    const built = await build(path.join(RENDERER, file))
    const rule = ruleOf(built.code, built.classes.spin ?? '?', false)
    expect(rule).not.toMatch(/animation/)
  })
})
