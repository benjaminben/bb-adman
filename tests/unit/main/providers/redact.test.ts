import { describe, it, expect } from 'vitest'
import { redactSecret } from '@/main/providers/redact'

// Made up; it does not look like a real key. It holds characters that URL encoding changes.
const SECRET = 'made-up/secret+value=1'

describe('redactSecret [SPEC 6 1.12, G4]', () => {
  it('replaces the secret as given', () => {
    expect(redactSecret(`bad key ${SECRET} sent`, SECRET)).toBe('bad key [key removed] sent')
  })

  it('replaces every copy of the secret', () => {
    expect(redactSecret(`${SECRET} and ${SECRET}`, SECRET)).toBe('[key removed] and [key removed]')
  })

  it('replaces the URL-encoded form', () => {
    const encoded = encodeURIComponent(SECRET)
    expect(encoded).not.toBe(SECRET)
    expect(redactSecret(`?key=${encoded}`, SECRET)).toBe('?key=[key removed]')
  })

  it('replaces the base64 form', () => {
    const base64 = Buffer.from(SECRET).toString('base64')
    expect(redactSecret(`Basic ${base64}`, SECRET)).toBe('Basic [key removed]')
  })

  it('returns the text unchanged for an empty secret', () => {
    expect(redactSecret('nothing to remove', '')).toBe('nothing to remove')
  })

  it('leaves text without the secret unchanged', () => {
    expect(redactSecret('HTTP 500: Internal', SECRET)).toBe('HTTP 500: Internal')
  })
})
