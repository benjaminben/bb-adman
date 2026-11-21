import { describe, it, expect } from 'vitest'
import { storageFilePath, storageListPrefix } from '@/main/providers/storage-paths'

describe('storageFilePath: the path rules every storage adapter shares [SPEC 6]', () => {
  it.each(['a.txt', 'a/b/c.png', 'campaign-1/exports/post/1x1/en-v1.png', 'name with space.txt'])(
    'accepts the relative path %s unchanged',
    (path) => {
      expect(storageFilePath(path)).toBe(path)
    },
  )

  it.each([
    ['empty', ''],
    ['starting with /', '/a.txt'],
    ['holding ..', 'a/../b.txt'],
    ['only ..', '..'],
    ['ending in ..', 'a/..'],
    ['holding .', 'a/./b.txt'],
    ['holding an empty part', 'a//b.txt'],
    ['ending with /', 'a/'],
    ['holding a backslash', 'a\\..\\b.txt'],
    ['holding a NUL', 'a\u0000.txt'],
    ['a drive letter', 'C:/a.txt'],
  ])('refuses a path %s', (_case, path) => {
    expect(() => storageFilePath(path)).toThrow(/Storage path refused/)
  })
})

describe('storageListPrefix: the folder a list call reads [SPEC 6]', () => {
  it('reads an empty prefix as the whole root', () => {
    expect(storageListPrefix('')).toBe('')
  })

  it.each([
    ['a', 'a/'],
    ['a/', 'a/'],
    ['a/b', 'a/b/'],
  ])('reads %s as the folder %s', (prefix, folder) => {
    expect(storageListPrefix(prefix)).toBe(folder)
  })

  it.each(['/', '/a', '..', 'a/..', 'a//b', 'a\\b'])('refuses the prefix %s', (prefix) => {
    expect(() => storageListPrefix(prefix)).toThrow(/Storage path refused/)
  })
})

// Calls `run` and gives back the message of the error it throws.
function messageOf(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('nothing was thrown')
}

describe('the refused-path error holds no path [SPEC 6.5 1.13 Errors, 1.14 H10]', () => {
  it.each([
    ['a file path', () => storageFilePath('private-folder/../x.txt')],
    ['a list prefix', () => storageListPrefix('/private-folder')],
  ])('gives exactly "Storage path refused" for %s', (_case, run) => {
    expect(messageOf(run)).toBe('Storage path refused')
  })
})

describe('Windows name forms are refused on every platform [SPEC 14 H14, 1.17]', () => {
  it.each(['a./b.txt', 'a/b.txt.'])('refuses a part that ends in a dot: %s', (path) => {
    expect(() => storageFilePath(path)).toThrow('Storage path refused')
  })

  it.each(['a /b.txt', 'a/b.txt '])('refuses a part that ends in a space: %s', (path) => {
    expect(() => storageFilePath(path)).toThrow('Storage path refused')
  })

  it.each(['a/b.txt:stream', 'a:b/c.txt'])('refuses a part that holds a colon: %s', (path) => {
    expect(() => storageFilePath(path)).toThrow('Storage path refused')
  })

  it('refuses a part that holds a backslash', () => {
    expect(() => storageFilePath('a/b\\c.txt')).toThrow('Storage path refused')
  })

  it.each(['CON', 'a/con.txt', 'Aux.2026.final/b.txt', 'a/NUL .x', 'lpt1/b.txt'])(
    'refuses a reserved device name: %s',
    (path) => {
      expect(() => storageFilePath(path)).toThrow('Storage path refused')
    },
  )

  it.each(['CONTACT/b.txt', 'a/Icon', 'My.CON/x.txt', 'COM10.txt'])(
    'accepts a name that is not reserved: %s',
    (path) => {
      expect(storageFilePath(path)).toBe(path)
    },
  )

  it('applies the same rules to a list prefix', () => {
    expect(() => storageListPrefix('con')).toThrow('Storage path refused')
    expect(() => storageListPrefix('a./')).toThrow('Storage path refused')
  })
})

describe('characters Windows cannot hold are refused on every platform [SPEC 6.5 1.20 B-01, 14 L3]', () => {
  it.each(['<', '>', '"', '|', '?', '*'])('refuses a part that holds %s', (character) => {
    expect(() => storageFilePath(`a/b${character}c.txt`)).toThrow('Storage path refused')
    expect(() => storageListPrefix(`a${character}b/c`)).toThrow('Storage path refused')
  })

  it('refuses a part that holds a tab', () => {
    expect(() => storageFilePath('a/b\tc.txt')).toThrow('Storage path refused')
  })

  it('refuses a part that holds the control character with code 31', () => {
    expect(() => storageFilePath('a/b\u001fc.txt')).toThrow('Storage path refused')
  })

  it('still accepts the character with code 32, a space, inside a part', () => {
    expect(storageFilePath('a/b c.txt')).toBe('a/b c.txt')
  })
})
