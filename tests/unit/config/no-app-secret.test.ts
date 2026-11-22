import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

// spec/phases/phase-09.md "Rules for these slices": the Dropbox sign-in uses PKCE, so no app
// secret is read, stored, sent or shipped. One file is left out on purpose: Adobe Firefly's
// server-to-server sign-in (P4-6) sends the user's own Firefly client secret, which Adobe asks for.
const ROOT = join(__dirname, '..', '..', '..')
const LEFT_OUT = new Set(['src/main/providers/firefly/token.ts'])
const WORDS = /client_secret|app_secret/i

function filesUnder(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name)
    return entry.isDirectory() ? filesUnder(path) : [path]
  })
}

describe('no app secret [P9-2, D-090]', () => {
  it('no file under src/ holds client_secret or app_secret', () => {
    const files = filesUnder(join(ROOT, 'src')).map((file) => relative(ROOT, file))
    expect(files.length).toBeGreaterThan(100)
    const holding = files.filter(
      (file) => !LEFT_OUT.has(file) && WORDS.test(readFileSync(join(ROOT, file), 'utf8')),
    )
    expect(holding).toEqual([])
  })

  it('the one file left out is still the Firefly sign-in', () => {
    const [file] = [...LEFT_OUT]
    expect(readFileSync(join(ROOT, file ?? ''), 'utf8')).toContain('Firefly')
  })
})
