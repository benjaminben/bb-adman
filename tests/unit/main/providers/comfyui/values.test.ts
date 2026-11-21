import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import {
  isFileName,
  isPromptId,
  isSubfolder,
  isViewType,
  uploadName,
} from '@/main/providers/comfyui/values'

describe('the values checked before they go into a path or body [SPEC 6.10.2, 14 CU-2]', () => {
  it('accepts a prompt ID made by crypto.randomUUID', () => {
    expect(isPromptId(crypto.randomUUID())).toBe(true)
  })

  it.each(['', 'abc', '../queue', '1234567-89ab-cdef-0123-456789abcdef0', 'x'.repeat(36)])(
    'refuses %j as a prompt ID',
    (id) => {
      expect(isPromptId(id)).toBe(false)
    },
  )

  it.each(['a.png', 'ComfyUI_00001_.png', 'my file (2).webp', 'A-b_c.9', 'x'.repeat(128)])(
    'accepts the file name %j',
    (name) => {
      expect(isFileName(name)).toBe(true)
    },
  )

  it.each(['', 'x'.repeat(129), 'a/b.png', 'a\\b.png', '..', 'a..png', 'a%2e.png', 'a\n.png'])(
    'refuses the file name %j',
    (name) => {
      expect(isFileName(name)).toBe(false)
    },
  )

  it.each(['', 'adman', 'adman/run 1', 'a/b/c', 'x'.repeat(128)])(
    'accepts the subfolder %j',
    (s) => {
      expect(isSubfolder(s)).toBe(true)
    },
  )

  it.each(['/adman', 'a/../b', '..', 'x'.repeat(129), 'a\\b', 'a?b'])(
    'refuses the subfolder %j',
    (s) => {
      expect(isSubfolder(s)).toBe(false)
    },
  )

  it('accepts only temp and output as a file type', () => {
    expect(isViewType('temp')).toBe(true)
    expect(isViewType('output')).toBe(true)
    expect(isViewType('input')).toBe(false)
    expect(isViewType('Temp')).toBe(false)
  })

  it('names an upload adman-{first 16 hex of the SHA-256 of the bytes}.png', () => {
    const bytes = new Uint8Array([1, 2, 3])
    const hex = createHash('sha256').update(bytes).digest('hex').slice(0, 16)
    expect(uploadName(bytes)).toBe(`adman-${hex}.png`)
  })
})
