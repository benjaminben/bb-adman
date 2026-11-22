import { describe, it, expect } from 'vitest'
import { noteLine } from '@/renderer/screens/project-home/brief-load/photo-notes'
import type { PictureNoteReason } from '@/shared/schemas/commands/brief'

describe('noteLine: the line a brief photo note shows [spec/subject-photos.md, "Notes from the brief"]', () => {
  it.each<[PictureNoteReason, string]>([
    ['not_found', 'The photo "a.png" was not found.'],
    ['not_a_picture', 'The file "a.png" is not a picture Adman can use.'],
    ['not_readable', 'The photo "a.png" could not be read.'],
    [
      'not_full_path',
      'The photo "a.png" was not used: a pasted brief has no folder, so give the photo\'s full path or its asset ID.',
    ],
    ['unknown_asset', 'No picture with the asset ID "a.png" is in this project.'],
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
