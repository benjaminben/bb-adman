import { describe, expect, it } from 'vitest'
import { answerFailure, thrownFailure } from '@/main/providers/dropbox/failure'
import { DropboxNetworkError } from '@/main/providers/dropbox/pinned-fetch'
import { ProviderFailure } from '@/main/providers/types'

const REFRESH = 'refreshtokenfortests'
const ACCESS = 'sl.accesstokenfortests'
const SECRETS = [REFRESH, ACCESS]

const bytes = (body: unknown) =>
  new TextEncoder().encode(typeof body === 'string' ? body : JSON.stringify(body))
const tagged = (...tags: string[]): unknown => {
  const root: Record<string, unknown> = {}
  let at = root
  for (const tag of tags) {
    const next: Record<string, unknown> = {}
    at['.tag'] = tag
    at[tag] = next
    at = next
  }
  return { error_summary: `${tags.join('/')}/..`, error: root }
}

describe('Dropbox error kinds [P9-2, phase-09 "Dropbox hosts and calls"]', () => {
  it.each([
    ['401', 401, '', 'api', 'bad_key', '401'],
    [
      'invalid_access_token',
      401,
      tagged('invalid_access_token'),
      'api',
      'bad_key',
      '401 invalid_access_token',
    ],
    [
      'invalid_access_token, any status',
      400,
      tagged('invalid_access_token'),
      'api',
      'bad_key',
      '400 invalid_access_token',
    ],
    ['403', 403, '', 'api', 'bad_key', '403'],
    ['missing_scope', 400, tagged('missing_scope'), 'api', 'bad_key', '400 missing_scope'],
    ['429', 429, '', 'api', 'quota', '429'],
    [
      'too_many_requests',
      409,
      { error: { reason: { '.tag': 'too_many_requests' } } },
      'api',
      'quota',
      '409 too_many_requests',
    ],
    [
      'too_many_write_operations',
      409,
      tagged('path', 'too_many_write_operations'),
      'api',
      'quota',
      '409 path/too_many_write_operations',
    ],
    ['503', 503, 'Service Unavailable', 'api', 'quota', '503'],
    ['500', 500, '<html>oops</html>', 'api', 'other', '500'],
    [
      'a path error',
      409,
      tagged('path', 'insufficient_space'),
      'api',
      'other',
      '409 path/insufficient_space',
    ],
    [
      'invalid_grant outside a token call',
      400,
      { error: 'invalid_grant' },
      'api',
      'other',
      '400 invalid_grant',
    ],
  ] as const)('%s is %s', (_name, status, body, call, kind, detail) => {
    const failure = answerFailure(status, bytes(body), SECRETS, call)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect(failure.error).toEqual({ kind, detail })
  })

  it('a token grant answering invalid_grant is bad_key with the signed-out reason', () => {
    const body = {
      error: 'invalid_grant',
      error_description: 'refresh token is invalid or revoked',
    }
    expect(answerFailure(400, bytes(body), SECRETS, 'token').error).toEqual({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: '400 invalid_grant',
    })
  })

  it('a marked time-out is timeout and another marked network error is offline', () => {
    const timedOut = new DropboxNetworkError(new DOMException('late', 'TimeoutError'))
    const broken = new DropboxNetworkError(new TypeError('fetch failed'))
    expect(thrownFailure(timedOut, SECRETS).error.kind).toBe('timeout')
    expect(thrownFailure(broken, SECRETS).error.kind).toBe('offline')
  })

  it('an unmarked error is other and keeps none of its words', () => {
    const failure = thrownFailure(new TypeError(`bad ${ACCESS} at /Users/someone`), SECRETS)
    expect(failure.error).toEqual({ kind: 'other', detail: 'The Dropbox call failed' })
  })

  it('a passed-on ProviderFailure keeps its kind and reason and loses both tokens', () => {
    const inner = new ProviderFailure({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: `x ${REFRESH} y ${ACCESS}`,
    })
    const failure = thrownFailure(inner, SECRETS)
    expect(failure.error).toEqual({
      kind: 'bad_key',
      reason: 'dropbox_signed_out',
      detail: 'x [key removed] y [key removed]',
    })
  })
})

describe('the detail [P9-2]', () => {
  it('holds the status and the tag chain only, never error_summary or user_message', () => {
    const body = {
      error_summary: 'path/not_found/Secret Client Folder/brief.pdf',
      user_message: { text: 'Secret Client Folder', locale: 'en' },
      error: { '.tag': 'path', path: { '.tag': 'not_found' } },
    }
    const { detail } = answerFailure(409, bytes(body), SECRETS).error
    expect(detail).toBe('409 path/not_found')
  })

  it('keeps no tag that is not a plain lower-case word', () => {
    const body = { error: { '.tag': 'path', path: { '.tag': '/Users/Someone/file' } } }
    expect(answerFailure(409, bytes(body), SECRETS).error.detail).toBe('409 path')
  })

  it('removes either token even when it is shaped like a tag', () => {
    const { detail } = answerFailure(409, bytes(tagged('path', REFRESH)), SECRETS).error
    expect(detail).toBe('409 path/[key removed]')
  })

  it('is at most 200 characters', () => {
    const long = Array.from({ length: 8 }, (_, i) => `${'a'.repeat(60)}${i}`)
    const { detail } = answerFailure(409, bytes(tagged(...long)), SECRETS).error
    expect(detail.length).toBeLessThanOrEqual(200)
    expect(detail.startsWith('409 aaaa')).toBe(true)
  })

  it('is the status alone for a body that is not JSON', () => {
    expect(answerFailure(400, bytes(`not json ${ACCESS}`), SECRETS).error.detail).toBe('400')
  })
})
