import { describe, it, expect } from 'vitest'
import { cleanServerText } from '@/main/providers/comfyui/server-text'
import { MAX_SERVER_TEXT_CHARS } from '@/main/providers/comfyui/limits'

describe('cleanServerText [SPEC 6.10.9; FR-267, FR-277]', () => {
  it('keeps plain text and line breaks as they are', () => {
    expect(cleanServerText('Value not in list\nckpt_name')).toBe('Value not in list\nckpt_name')
  })

  it('turns control characters other than a line break into spaces', () => {
    expect(cleanServerText('a\tb\rc\u0000d\u007fe\u0085f')).toBe('a b c d e f')
  })

  it('removes terminal escape sequences', () => {
    expect(cleanServerText('\u001b[31mred\u001b[0m and \u001b]0;title\u0007done')).toBe(
      'red and done',
    )
  })

  it('removes a lone escape character', () => {
    expect(cleanServerText('a\u001bb')).toBe('ab')
  })

  it('cuts the whole to MAX_SERVER_TEXT_CHARS with an ellipsis', () => {
    const cut = cleanServerText('x'.repeat(MAX_SERVER_TEXT_CHARS + 50))
    expect(cut).toHaveLength(MAX_SERVER_TEXT_CHARS)
    expect(cut.endsWith('…')).toBe(true)
  })

  it('leaves text at exactly the limit uncut', () => {
    const text = 'y'.repeat(MAX_SERVER_TEXT_CHARS)
    expect(cleanServerText(text)).toBe(text)
  })
})
