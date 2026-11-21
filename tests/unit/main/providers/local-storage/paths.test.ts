import { describe, it, expect } from 'vitest'
import {
  storageFilePath,
  storageListPrefix,
} from '../../../../../src/main/providers/local-storage/paths'

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
