import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/main/export/report/escape'

describe('escapeHtml [FR-233, A-203]', () => {
  it.each([
    ['&', '&amp;'],
    ['<', '&lt;'],
    ['>', '&gt;'],
    ['"', '&quot;'],
    ["'", '&#39;'],
  ])('turns %s into %s', (raw, escaped) => {
    expect(escapeHtml(`a${raw}b`)).toBe(`a${escaped}b`)
  })

  it('escapes the ampersand first, so an entity in the text stays text', () => {
    expect(escapeHtml('&lt;b&gt;')).toBe('&amp;lt;b&amp;gt;')
  })

  it('escapes every occurrence and leaves other text as it is', () => {
    expect(escapeHtml(`<a href="x">'1' & '2'</a> é ‮`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;&#39;1&#39; &amp; &#39;2&#39;&lt;/a&gt; é ‮',
    )
  })
})
