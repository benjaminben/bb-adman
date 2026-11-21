// SPEC 8.2 built-page check. Runs after `npm run build`, by `npm run test:build`.
import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { CONTENT_SECURITY_POLICY } from '@/main/windows/csp'

const PAGE = 'out/renderer/index.html'

describe('the built page [SPEC 8.2]', () => {
  const html = fs.readFileSync(PAGE, 'utf8')

  it('has exactly one policy tag, and its content equals CONTENT_SECURITY_POLICY exactly', () => {
    const tags = [...html.matchAll(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi)]
    expect(tags).toHaveLength(1)
    const content = /\bcontent="([^"]*)"/.exec(tags[0]?.[0] ?? '')?.[1]
    expect(content).toBe(CONTENT_SECURITY_POLICY)
  })

  it('does not contain the word localhost', () => {
    expect(html).not.toMatch(/localhost/i)
  })
})

// spec/scene.md "The render window", P3-6: the second page and the second preload.
describe('the built render page [P3-6]', () => {
  const html = fs.readFileSync('out/renderer/render.html', 'utf8')

  it('has exactly one policy tag, and its content equals CONTENT_SECURITY_POLICY exactly', () => {
    const tags = [...html.matchAll(/<meta\b[^>]*http-equiv="Content-Security-Policy"[^>]*>/gi)]
    expect(tags).toHaveLength(1)
    const content = /\bcontent="([^"]*)"/.exec(tags[0]?.[0] ?? '')?.[1]
    expect(content).toBe(CONTENT_SECURITY_POLICY)
    expect(html).not.toMatch(/localhost/i)
  })

  it('ships the bundled Inter font as its own file, not inlined', () => {
    const assets = fs.readdirSync('out/renderer/assets')
    expect(assets.some((name) => /^InterVariable-[\w-]+\.woff2$/.test(name))).toBe(true)
  })

  it.each(['index.cjs', 'render.cjs'])('builds the sandboxed preload %s as one file', (name) => {
    const code = fs.readFileSync(`out/preload/${name}`, 'utf8')
    expect(code).not.toMatch(/require\(["']\.\.?\//)
  })
})
