// P8-2 (spec/phases/phase-08.md "Output layout additions", A-192): the post title folder name
// is made safe before it reaches storage. Each character outside A-Z a-z 0-9 + - _ space
// becomes '-', spaces are trimmed, the name is cut to 80, empty gives 'post', a reserved
// device name gives 'post-{name}'.
import { describe, it, expect } from 'vitest'
import { postTitle } from '@/shared/export/safe-title'
import { storageFilePath } from '@/main/providers/storage-paths'

const ROWS: Array<[string, string]> = [
  ['Summer sale!', 'Summer sale-'],
  ['  a  ', 'a'],
  ['Été', '-t-'],
  ['a'.repeat(120), 'a'.repeat(80)],
  [`${'b'.repeat(79)}  c`, 'b'.repeat(79)],
  ['', 'post'],
  ['   ', 'post'],
  ['...', '---'],
  ['../../etc', '------etc'],
  ['a/b\\c', 'a-b-c'],
  ['tab\there', 'tab-here'],
  ['+_- ok', '+_- ok'],
  ['😀', '-'],
  ['CON', 'post-CON'],
  ['con', 'post-con'],
  ['LPT1', 'post-LPT1'],
  [' nul ', 'post-nul'],
  ['COM10', 'COM10'],
]

describe('postTitle [P8-2, A-192]', () => {
  it.each(ROWS)('turns %j into %j', (title, safe) => {
    expect(postTitle(title)).toBe(safe)
  })

  it.each(ROWS)('gives a name from %j that passes the storage path rules', (title) => {
    const name = postTitle(title)
    expect(storageFilePath(name)).toBe(name)
    expect(name.length).toBeLessThanOrEqual(80)
  })
})
