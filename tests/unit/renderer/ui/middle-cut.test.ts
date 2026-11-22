// SET-3: a long path is cut in the middle to 48 characters, keeping both ends.
import { describe, it, expect } from 'vitest'
import { middleCut } from '@/renderer/ui/middle-cut'

describe('middleCut [SET-3]', () => {
  it.each(['', '/Users/me/Adman', 'x'.repeat(48)])('leaves a short text unchanged: %s', (text) => {
    expect(middleCut(text)).toBe(text)
  })

  it('cuts a 90-character path to 48, keeping the first 20 and the last 27', () => {
    const long = `/Users/rowan/${'a'.repeat(47)}/Projects/Spring launch/drafts`
    expect(long).toHaveLength(90)
    const cut = middleCut(long)
    expect(cut).toHaveLength(48)
    expect(cut).toBe(`${long.slice(0, 20)}…${long.slice(-27)}`)
  })

  it('cuts a 49-character text', () => {
    expect(middleCut('y'.repeat(49))).toHaveLength(48)
  })
})
