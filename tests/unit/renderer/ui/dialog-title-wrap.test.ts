// CW-4 review: a dialog title with a long name and no spaces ("Remove {name}?") breaks inside
// the word rather than running past the dialog's edge.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve('src/renderer/ui/dialog-frame/dialog-frame.module.css'), 'utf8')

describe('dialog frame title [CW-4]', () => {
  it('wraps anywhere, so a long name stays inside the dialog', () => {
    const rule = /\n\.title \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(rule).toMatch(/overflow-wrap: anywhere;/)
  })
})
