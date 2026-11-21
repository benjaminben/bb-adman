// spec/subject-photos.md, "Subject photos as reference pictures" (SP-7): the one owner of
// which rows are reference pictures and which subject photos are pre-chosen.
import { describe, expect, it } from 'vitest'
import {
  isReferenceRow,
  photoOfLine,
  subjectPhotoIds,
} from '@/renderer/ui/reference-picker/reference-rows'
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import { ref } from '../screens/campaign/reference-fixture'

describe('isReferenceRow [SP-7]', () => {
  it.each([
    ['a reference-library image with no subject', ref('R1'), true],
    ['a reference-library image with a subject', ref('R2', { subjectId: 'citrus-can' }), true],
    [
      'an asset-library image with a subject',
      ref('A1', { library: 'asset', subjectId: 'citrus-can' }),
      true,
    ],
    ['an asset-library image with no subject', ref('A2', { library: 'asset' }), false],
    [
      'a generated asset-library image with no subject (only in "Made in this project")',
      ref('G1', { library: 'asset', origin: 'generated' }),
      false,
    ],
    ['a reference-library video', ref('V1', { kind: 'video' }), false],
    [
      'an asset-library video with a subject',
      ref('V2', { kind: 'video', library: 'asset', subjectId: 'citrus-can' }),
      false,
    ],
  ])('%s: %s', (_name, row, expected) => {
    expect(isReferenceRow(row)).toBe(expected)
  })
})

describe('subjectPhotoIds [SP-7]', () => {
  const can = (id: string, over: Parameters<typeof ref>[1] = {}) =>
    ref(id, { subjectId: 'citrus-can', ...over })

  it.each([
    ['keeps only the given subjects', [can('01A'), ref('01B', { subjectId: 'berry' })], ['01A']],
    ['skips a row with no subject', [ref('01A'), can('01B')], ['01B']],
    ['skips a picture that cannot be sent', [can('01A', { missing: true }), can('01B')], ['01B']],
    ['skips a video', [can('01A', { kind: 'video' }), can('01B')], ['01B']],
    ['takes both libraries', [can('01A', { library: 'asset' }), can('01B')], ['01A', '01B']],
    ['puts the oldest first', [can('01C'), can('01A'), can('01B')], ['01A', '01B', '01C']],
    ['gives none for no subjects', [can('01A')], [], []],
  ])('%s', (_name, rows, expected, subjects = ['citrus-can']) => {
    expect(subjectPhotoIds(rows, subjects)).toEqual(expected)
  })

  it(`takes at most ${MAX_REFERENCES_PER_RUN}`, () => {
    const rows = Array.from({ length: 10 }, (_, i) => can(`01R${i}`))
    expect(subjectPhotoIds(rows, ['citrus-can'])).toEqual(
      rows.slice(0, MAX_REFERENCES_PER_RUN).map((r) => r.id),
    )
  })
})

describe('photoOfLine [SP-7]', () => {
  it.each([
    [
      'an asset-library subject photo',
      ref('A1', { library: 'asset', subjectId: 'can' }),
      'Photo of can',
    ],
    ['a reference-library subject photo', ref('R1', { subjectId: 'can' }), null],
    ['a reference picture with no subject', ref('R2'), null],
  ])('%s: %s', (_name, row, expected) => {
    expect(photoOfLine(row)).toBe(expected)
  })
})
