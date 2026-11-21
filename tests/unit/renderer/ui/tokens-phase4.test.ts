// P4-1 (spec/screens-ai.md "Where the code lives"): the Phase 4 tokens, added to the one
// styling source.
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const css = fs.readFileSync(path.resolve('src/renderer/ui/tokens.css'), 'utf8')

describe('Phase 4 tokens [P4-1]', () => {
  it.each([
    ['--activity-width', '360px'],
    ['--option-thumb', '72px'],
    ['--mark-dot', '8px'],
    ['--run-dialog-width', '480px'],
  ])('%s is %s', (name, value) => {
    expect(css).toMatch(new RegExp(`${name}:\\s*${value};`))
  })
})
