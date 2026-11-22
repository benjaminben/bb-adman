// P9-12 review: names and paths from a project file, cleaned for display, so a name cannot
// reorder the line, hide characters, break the line or push the rest out of view.
import { describe, it, expect } from 'vitest'
import { displayName, displayPath, NAME_DISPLAY_MAX } from '@/shared/publish/display-text'

describe('displayName [P9-12]', () => {
  it('strips a right-to-left override and keeps a fake tail as plain text on one line', () => {
    const name = 'Inter‮​\nwill not be uploaded x'
    expect(displayName(name)).toBe('Interwill not be uploadedx')
  })

  it('strips control and format characters and line and paragraph separators', () => {
    expect(displayName('a\u0000b\u0007c‍d﻿e⁦f g­h')).toBe('abcdefgh')
  })

  it('collapses runs of white space and trims', () => {
    expect(displayName('  Harbor \t   Sans  ')).toBe('Harbor Sans')
  })

  it('cuts a 5,000-character name at 200 code points with "…"', () => {
    const shown = displayName('A'.repeat(5000))
    expect(NAME_DISPLAY_MAX).toBe(200)
    expect([...shown]).toHaveLength(201)
    expect(shown.endsWith('…')).toBe(true)
  })

  it('counts code points, not UTF-16 units, so a cut never splits a character', () => {
    const shown = displayName('😀'.repeat(300))
    expect([...shown]).toHaveLength(201)
    expect(shown).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/)
  })

  it('leaves a short ordinary name as it is', () => {
    expect(displayName('Beach at dawn')).toBe('Beach at dawn')
  })
})

describe('displayPath [P9-12]', () => {
  it('strips the same characters and never cuts', () => {
    const long = `/Users/ann/${'deep/'.repeat(1000)}font.ttf`
    expect(displayPath(long)).toBe(long)
    expect(displayPath('/Users/ann/‮ftt.evil​/a.ttf')).toBe('/Users/ann/ftt.evil/a.ttf')
  })
})
