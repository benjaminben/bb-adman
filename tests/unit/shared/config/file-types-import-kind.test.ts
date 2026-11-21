// spec/api-queries-events.md, dialog.pickFiles (P3-13): an import picker with a kind offers only
// that kind's extensions, as the font upload needs; with no kind it offers every extension.
import { describe, expect, it } from 'vitest'
import { FILE_TYPES, pickerExtensions } from '@/shared/config/file-types'

describe('pickerExtensions for import with a kind [P3-13]', () => {
  it.each([
    ['font', ['ttf', 'otf', 'woff2']],
    ['image', ['png', 'jpg', 'jpeg', 'webp']],
  ] as const)('import with %s offers only that kind', (kind, extensions) => {
    expect(pickerExtensions('import', kind)).toEqual(extensions)
  })

  it('import with no kind offers every extension, as before', () => {
    expect(pickerExtensions('import')).toEqual(FILE_TYPES.flatMap((t) => t.extensions))
  })
})
