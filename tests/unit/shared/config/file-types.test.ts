import { describe, it, expect } from 'vitest'
import { FILE_TYPES, fileTypeFor, pickerExtensions } from '@/shared/config/file-types'

describe('accepted file types [SPEC 8.3, FR-051]', () => {
  it('lists the five kinds of Section 8.3 and nothing else', () => {
    const byKind = (kind: string) =>
      FILE_TYPES.filter((t) => t.kind === kind).flatMap((t) => t.extensions)
    expect(byKind('image')).toEqual(['png', 'jpg', 'jpeg', 'webp'])
    expect(byKind('video')).toEqual(['mp4', 'mov', 'webm'])
    expect(byKind('font')).toEqual(['ttf', 'otf', 'woff2'])
    expect(byKind('text')).toEqual(['txt', 'md', 'json', 'yaml', 'yml'])
    expect(byKind('audio')).toEqual(['mp3', 'wav', 'm4a', 'aac'])
    expect(new Set(FILE_TYPES.map((t) => t.kind))).toEqual(
      new Set(['image', 'video', 'font', 'text', 'audio']),
    )
  })

  it('finds a type by extension in any letter case', () => {
    expect(fileTypeFor('PHOTO.JPG')).toMatchObject({ kind: 'image', mime: 'image/jpeg' })
    expect(fileTypeFor('clip.mov')).toMatchObject({ kind: 'video', mime: 'video/quicktime' })
    expect(fileTypeFor('a.b.woff2')).toMatchObject({ kind: 'font', mime: 'font/woff2' })
  })

  it('finds nothing for an extension not in the list, or no extension', () => {
    expect(fileTypeFor('x.gif')).toBeUndefined()
    expect(fileTypeFor('README')).toBeUndefined()
    expect(fileTypeFor('.png')).toBeUndefined()
  })
})

describe('the types a picker offers [SPEC 4.3 dialog.pickFiles]', () => {
  it('offers every accepted type for import', () => {
    expect(pickerExtensions('import')).toEqual(FILE_TYPES.flatMap((t) => t.extensions))
  })

  it('offers only the asset kind for relink', () => {
    expect(pickerExtensions('relink', 'font')).toEqual(['ttf', 'otf', 'woff2'])
  })

  it('offers the text types for a brief', () => {
    expect(pickerExtensions('brief')).toEqual(['txt', 'md', 'json', 'yaml', 'yml'])
  })
})
