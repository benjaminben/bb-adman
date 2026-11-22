// P7-10: the one table of allowed format changes (spec/data-rules.md, "Changing a variant's
// format"), and the grid test's reason for each direction.
import { describe, it, expect } from 'vitest'
import { FORMAT_CHANGES, formatChange } from '@/shared/config/format-changes'

describe('the format change table [D-012, D-020]', () => {
  it('allows image to video and video to image, and nothing else', () => {
    expect(FORMAT_CHANGES.map((c) => [c.from, c.to])).toEqual([
      ['image', 'video'],
      ['video', 'image'],
    ])
  })

  it.each([
    ['image', 'video', 'video_post_exists'],
    ['video', 'image', 'image_post_exists'],
  ] as const)('%s to %s is refused with %s when the cell is taken', (from, to, reason) => {
    expect(formatChange(from, to)?.takenReason).toBe(reason)
  })

  it.each(['image', 'video'] as const)('has no row from %s to itself', (format) => {
    expect(formatChange(format, format)).toBeNull()
  })
})
