import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { pictureRef } from '@/shared/brief/picture-refs'

const ULID = '01JD3K7Q2M8V5X9T4R6Y1B0C2N'

// Round 2 plan D3 [A-343]: an asset ID, an absolute file or anything else.
describe('pictureRef [D3]', () => {
  it.each([
    ['an upper-case ULID', ULID, 'darwin', { kind: 'asset', assetId: ULID }],
    ['a lower-case ULID', ULID.toLowerCase(), 'win32', { kind: 'asset', assetId: ULID }],
    ['25 ULID characters', ULID.slice(1), 'darwin', { kind: 'relative', text: ULID.slice(1) }],
    [
      'a ULID with an I',
      `I${ULID.slice(1)}`,
      'darwin',
      { kind: 'relative', text: `I${ULID.slice(1)}` },
    ],
    [
      'a POSIX path on macOS',
      '/Users/sam/a.png',
      'darwin',
      { kind: 'file', path: '/Users/sam/a.png' },
    ],
    [
      'a POSIX path on Linux, normalized',
      '//x/./y/../a.png',
      'linux',
      { kind: 'file', path: '/x/a.png' },
    ],
    ['a POSIX path on Windows', '/x/a.png', 'win32', { kind: 'file', path: '\\x\\a.png' }],
    [
      'a drive path on Windows',
      'C:\\Pics\\a.png',
      'win32',
      { kind: 'file', path: 'C:\\Pics\\a.png' },
    ],
    [
      'a drive path with / on Windows',
      'c:/Pics/../a.png',
      'win32',
      { kind: 'file', path: 'c:\\a.png' },
    ],
    [
      'a UNC path on Windows',
      '\\\\host\\share\\a.png',
      'win32',
      { kind: 'file', path: '\\\\host\\share\\a.png' },
    ],
    [
      'a drive path on macOS',
      'C:\\Pics\\a.png',
      'darwin',
      { kind: 'relative', text: 'C:\\Pics\\a.png' },
    ],
    ['a drive-relative path on Windows', 'C:x.png', 'win32', { kind: 'relative', text: 'C:x.png' }],
    ['a home path, not expanded', '~/x', 'darwin', { kind: 'relative', text: '~/x' }],
    ['a home path on Windows', '~\\x', 'win32', { kind: 'relative', text: '~\\x' }],
    ['a parent folder', '..', 'darwin', { kind: 'relative', text: '..' }],
    ['a parent path', '../a.png', 'win32', { kind: 'relative', text: '../a.png' }],
    ['a plain name', 'a.png', 'darwin', { kind: 'relative', text: 'a.png' }],
    ['an empty text', '', 'darwin', { kind: 'relative', text: '' }],
    ['an empty text on Windows', '', 'win32', { kind: 'relative', text: '' }],
  ] as const)('%s', (_name, text, platform, expected) => {
    expect(pictureRef(text, platform)).toEqual(expected)
  })
})

// src/shared may not import node:path (lint), so the reader keeps its own copy of the two
// rules. These cases hold it to what node:path gives.
const POSIX = ['/', '//', '/a/b/', '/a//b', '/./a', '/../a', '/a/../../b', '/a/.../b', '/a/b/..']
const WIN32 = [
  '\\',
  '/',
  'C:\\',
  'C:/',
  'C:\\a\\..\\..\\b',
  'C:\\a\\.\\b\\',
  'C:/a//b',
  '\\\\host\\share',
  '\\\\host\\share\\',
  '\\\\host\\share\\a\\..\\..\\b',
  '//host/share/a',
  '\\\\host',
  '\\\\\\x',
  '\\\\?\\C:\\a\\b',
  '\\a\\..\\b',
  '/a/./b/',
]

describe('pictureRef matches node:path [D3]', () => {
  it.each(POSIX)('POSIX %s', (text) => {
    expect(path.posix.isAbsolute(text)).toBe(true)
    expect(pictureRef(text, 'linux')).toEqual({ kind: 'file', path: path.posix.normalize(text) })
  })

  it.each(WIN32)('Windows %s', (text) => {
    expect(path.win32.isAbsolute(text)).toBe(true)
    expect(pictureRef(text, 'win32')).toEqual({ kind: 'file', path: path.win32.normalize(text) })
  })

  it.each(['C:', 'C:a', 'a\\b', '1:\\a', 'CC:\\a'])('Windows relative %s', (text) => {
    expect(path.win32.isAbsolute(text)).toBe(false)
    expect(pictureRef(text, 'win32')).toEqual({ kind: 'relative', text })
  })
})
