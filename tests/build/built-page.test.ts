// SPEC 8.2 built-page check. Runs after `npm run build`, by `npm run test:build`.
import fs from 'node:fs'
import { describe, it, expect } from 'vitest'
import { CONTENT_SECURITY_POLICY } from '../../src/main/windows/csp'

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
