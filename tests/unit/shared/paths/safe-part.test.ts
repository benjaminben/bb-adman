// P9-7 (spec/phases/phase-09.md Q-P9-3, "Project-file values that reach a path"): one rule makes
// a typed name safe as one storage path part. Each character outside A-Z a-z 0-9 + - _ space
// becomes '-', spaces are trimmed, the name is cut to 80, empty gives the fallback, a reserved
// device name gets '{fallback}-' in front. isSafePart answers the storage path rules for one part.
import { describe, it, expect } from 'vitest'
import { isSafePart, safePathPart } from '@/shared/paths/safe-part'
import { postTitle } from '@/shared/export/safe-title'
import { storageFilePath } from '@/main/providers/storage-paths'

const ROWS: Array<[string, string]> = [
  ['Summer sale!', 'Summer sale-'],
  ['  a  ', 'a'],
  ['Été', '-t-'],
  ['a'.repeat(200), 'a'.repeat(80)],
  [`${'b'.repeat(79)}  c`, 'b'.repeat(79)],
  ['', 'asset'],
  ['   ', 'asset'],
  ['.', '-'],
  ['..', '--'],
  ['name.', 'name-'],
  ['name ', 'name'],
  ['../../etc', '------etc'],
  ['/abs/path', '-abs-path'],
  ['a/b\\c', 'a-b-c'],
  ['C:\\x', 'C--x'],
  ['<>:"|?*', '-------'],
  ['tab\there', 'tab-here'],
  ['nul\u0000byte', 'nul-byte'],
  ['bell\u0007', 'bell-'],
  ['line\nbreak', 'line-break'],
  ['del\u007f', 'del-'],
  ['zero\u200bwidth', 'zero-width'],
  ['rtl\u202eexe', 'rtl-exe'],
  ['+_- ok', '+_- ok'],
  ['😀', '-'],
  ['Logo', 'Logo'],
  ['logo', 'logo'],
  ['Caf\u00e9', 'Caf-'],
  ['Cafe\u0301', 'Cafe-'],
  ['ｆｕｌｌ', '----'],
  ['CON', 'asset-CON'],
  ['con', 'asset-con'],
  ['LPT1', 'asset-LPT1'],
  [' nul ', 'asset-nul'],
  ['COM10', 'COM10'],
]

describe('safePathPart [P9-7, Q-P9-3]', () => {
  it.each(ROWS)('turns %j into %j', (text, safe) => {
    expect(safePathPart(text, 'asset')).toBe(safe)
  })

  it.each(ROWS)('gives a part from %j that passes the storage path rules', (text) => {
    const part = safePathPart(text, 'asset')
    expect(storageFilePath(part)).toBe(part)
    expect(isSafePart(part)).toBe(true)
    expect(part.length).toBeGreaterThan(0)
    expect(part.length).toBeLessThanOrEqual(86)
  })

  it.each(ROWS)('agrees with Phase 8 postTitle for %j when the fallback is post', (text) => {
    expect(safePathPart(text, 'post')).toBe(postTitle(text))
  })

  it.each(['', 'a/b', '..', 'CON', 'x'.repeat(21), 'a.b'])(
    'refuses the fallback %j',
    (fallback) => {
      expect(() => safePathPart('', fallback)).toThrow()
    },
  )
})

// One part as storage-paths.ts judges it (src/shared may not import src/main).
const HOSTILE_PARTS = [
  '',
  '.',
  '..',
  'a/b',
  'a\\b',
  'a\u0000b',
  'a\u0001b',
  'a\u001fb',
  'a\tb',
  'name.',
  'name ',
  'a:b',
  'a<b',
  'a>b',
  'a"b',
  'a|b',
  'a?b',
  'a*b',
  'CON',
  'con.txt',
  'nul ',
  'COM1',
  'COM¹',
  'LPT9.png',
  'CONIN$',
  'conout$',
]
const GOOD_PARTS = [
  'a',
  'COM10',
  'CONIN',
  'CON$',
  'report.html',
  'Été',
  '😀',
  '-',
  ' a',
  'a'.repeat(300),
]

const storageAccepts = (part: string) => {
  try {
    storageFilePath(part)
    return true
  } catch {
    return false
  }
}

describe('isSafePart [P9-7, spec/storage-and-publish.md "Path rules"]', () => {
  it.each(HOSTILE_PARTS)('refuses %j', (part) => {
    expect(isSafePart(part)).toBe(false)
  })

  it.each(GOOD_PARTS)('accepts %j', (part) => {
    expect(isSafePart(part)).toBe(true)
  })

  // A '/' makes two parts for storageFilePath, so those rows are left out here.
  const ONE_PART = [...HOSTILE_PARTS, ...GOOD_PARTS].filter((p) => !p.includes('/'))
  it.each(ONE_PART)('gives the answer storageFilePath gives for %j', (p) => {
    expect(isSafePart(p)).toBe(storageAccepts(p))
  })
})
