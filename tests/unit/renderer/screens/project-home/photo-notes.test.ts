import { describe, it, expect } from 'vitest'
import { noteLine } from '@/renderer/screens/project-home/brief-load/photo-notes'
import type { PictureNoteReason } from '@/shared/schemas/commands/brief'

describe('noteLine: the line a brief photo note shows [spec/subject-photos.md, "Notes from the brief"]', () => {
  it.each<[PictureNoteReason, string]>([
    [
      'outside_folder',
      'The photo "a.png" was not used: a brief may only name photos in its own folder or below it.',
    ],
    ['not_found', 'The photo "a.png" was not found.'],
    ['not_a_picture', 'The file "a.png" is not a picture Adman can use.'],
    ['not_readable', 'The photo "a.png" could not be read.'],
    ['no_folder', 'The photo "a.png" was not used: a typed brief has no folder to find it in.'],
    [
      'wide_folder',
      'The photo "a.png" was not used: put the brief and its photos in a folder of their own.',
    ],
  ])('%s', (reason, line) => {
    expect(noteLine({ name: 'a.png', reason })).toBe(line)
  })

  it('never shows a folder, even when the name holds one', () => {
    expect(noteLine({ name: '/Users/me/private/a.png', reason: 'not_found' })).toBe(
      'The photo "a.png" was not found.',
    )
    expect(noteLine({ name: 'C:\\x\\b.jpg', reason: 'not_found' })).toBe(
      'The photo "b.jpg" was not found.',
    )
  })
})
