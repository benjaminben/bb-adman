// spec/scene.md, "Thumbnails": thumbnail names come from project-file values and are checked
// before any file is touched (spec/security.md, thumbnail row).
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  PARTIAL_NAME,
  THUMBNAIL_NAME,
  thumbnailDir,
  thumbnailFile,
  thumbnailSize,
  thumbnailsRoot,
} from '@/main/thumbnails/paths'

const USER_DATA = path.join(path.sep, 'data', 'Adman')
const PROJECT = '01HZY3V7Q8R9S0T1V2W3X4Y5Z6'

describe('thumbnail paths [spec/scene.md, Thumbnails]', () => {
  it('puts a thumbnail directly in the project folder under thumbnails', () => {
    expect(thumbnailsRoot(USER_DATA)).toBe(path.join(USER_DATA, 'thumbnails'))
    expect(thumbnailDir(USER_DATA, PROJECT)).toBe(path.join(USER_DATA, 'thumbnails', PROJECT))
    expect(thumbnailFile(USER_DATA, PROJECT, 'v23456', 7)).toBe(
      path.join(USER_DATA, 'thumbnails', PROJECT, 'v23456-7.png'),
    )
  })

  it.each([
    ['a project ID that is not a ULID', '../x', 'v23456', 0],
    ['a lowercase project ID', PROJECT.toLowerCase(), 'v23456', 0],
    ['a project ID with a separator', `${PROJECT.slice(0, 25)}/`, 'v23456', 0],
    ['an empty project ID', '', 'v23456', 0],
    ['a variant ID with a separator', PROJECT, '../abc', 0],
    ['a variant ID with a letter outside the alphabet', PROJECT, 'v2345l', 0],
    ['a variant ID too long', PROJECT, 'v234567', 0],
    ['a variant ID in capitals', PROJECT, 'V23456', 0],
    ['a negative rev', PROJECT, 'v23456', -1],
    ['a rev that is not whole', PROJECT, 'v23456', 1.5],
    ['a rev past the safe range', PROJECT, 'v23456', Number.MAX_SAFE_INTEGER + 1],
    ['a rev that is not a number', PROJECT, 'v23456', Number.NaN],
  ])('throws for %s', (_case, projectId, variantId, rev) => {
    expect(() => thumbnailFile(USER_DATA, projectId, variantId, rev)).toThrow()
  })

  it('throws for a bad project ID in the folder name too', () => {
    expect(() => thumbnailDir(USER_DATA, '..')).toThrow()
  })

  it('accepts the largest safe rev', () => {
    const file = thumbnailFile(USER_DATA, PROJECT, 'v23456', Number.MAX_SAFE_INTEGER)
    expect(path.basename(file)).toBe(`v23456-${Number.MAX_SAFE_INTEGER}.png`)
  })

  it.each([
    ['v23456-0.png', true],
    ['v23456-12.png', true],
    ['v23456-1.png.partial', false],
    ['V23456-1.png', false],
    ['v23456-.png', false],
    ['notes.txt', false],
    ['v23456-1.png.bak', false],
  ])('the clean-up name pattern says %s is %s', (name, matches) => {
    expect(THUMBNAIL_NAME.test(name)).toBe(matches)
  })

  it.each([
    ['v23456-1.png.partial', true],
    ['x.partial', false],
    ['v23456-1.png', false],
  ])('the half-written name pattern says %s is %s', (name, matches) => {
    expect(PARTIAL_NAME.test(name)).toBe(matches)
  })
})

describe('thumbnail size [spec/scene.md, Thumbnails]', () => {
  it.each([
    [1080, 1080, 512, 512],
    [1080, 1350, 410, 512],
    [1920, 1080, 512, 288],
    [10000, 1, 512, 1],
    [100, 50, 512, 256],
  ])('a %i x %i variant gives %i x %i', (width, height, w, h) => {
    expect(thumbnailSize({ width, height })).toEqual({ width: w, height: h })
  })
})
