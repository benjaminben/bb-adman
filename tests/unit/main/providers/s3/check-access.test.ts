// checkS3Access (spec/storage-and-publish.md "Test connection (S3)"): four calls inside the
// configured folder, through the real client and host pin, answered by a stand-in handler.
import { describe, it, expect } from 'vitest'
import { buildS3Client } from '@/main/providers/s3/client'
import { checkS3Access, runS3Check } from '@/main/providers/s3/check-access'
import type { S3CheckStep } from '@/shared/schemas/commands/storage-check'
import { TEST_KEY_ID, TEST_SECRET, testContext, type Answer } from './recorded'
import {
  CHECK_TEXT,
  REPLIES,
  checkStandIn,
  deletedKeys,
  errorXml,
  keyOf,
  stepOf,
  type Overrides,
} from './check-stand-in'

const HOST = 'made-up-bucket.s3.eu-west-1.amazonaws.com'
const ULID_TXT = /^[0-9A-HJKMNP-TV-Z]{26}\.txt$/

async function run(overrides: Overrides = {}, prefix = 'made-up-prefix') {
  const { seen, requestHandler } = checkStandIn(overrides)
  const outcome = await checkS3Access(testContext(prefix), { requestHandler })
  return { seen, outcome, steps: seen.map(stepOf) }
}

describe('checkS3Access: the four calls [spec "Test connection (S3)"]', () => {
  it.each([
    ['a folder', 'made-up-prefix', 'made-up-prefix/adman-connection-check/'],
    ['a folder saved with slashes', '/made-up-prefix/', 'made-up-prefix/adman-connection-check/'],
    ['the whole bucket', '', 'adman-connection-check/'],
  ])(
    'with %s: list, write, read, delete, every key under its check folder',
    async (_n, prefix, folder) => {
      const { seen, outcome, steps } = await run({}, prefix)
      expect(outcome).toEqual({ ok: true })
      expect(steps).toEqual(['list', 'write', 'read', 'delete'])
      const [list, put, get, del] = seen
      if (!list || !put || !get || !del) throw new Error('expected four calls')
      expect(seen.every((r) => r.hostname === HOST)).toBe(true)
      expect([list.query.prefix, list.query['max-keys']]).toEqual([folder, '1'])
      const written = keyOf(put)
      expect(written.startsWith(folder)).toBe(true)
      expect(written.slice(folder.length)).toMatch(ULID_TXT)
      expect(new TextDecoder().decode(put.body)).toBe(CHECK_TEXT)
      expect(put.headers['content-type']).toBe('text/plain')
      expect(keyOf(get)).toBe(written)
      expect(deletedKeys(del)).toEqual([written])
    },
  )

  it('writes a new name each time', async () => {
    const first = keyOf((await run()).seen[1] as never)
    const second = keyOf((await run()).seen[1] as never)
    expect(first).not.toBe(second)
  })
})

const network = (code: string) => Object.assign(new Error(`connect ${code}`), { code })
const region = '<Endpoint>made-up-bucket.s3.us-east-2.amazonaws.com</Endpoint>'

describe('checkS3Access: failure kinds from recorded replies at the list step', () => {
  it.each<[string, Answer | Error, string]>([
    ['InvalidAccessKeyId', REPLIES.invalidKeyId(), 's3_wrong_keys'],
    ['SignatureDoesNotMatch', REPLIES.badSignature(), 's3_wrong_keys'],
    ['ExpiredToken', errorXml('ExpiredToken', 400), 's3_wrong_keys'],
    ['InvalidToken', errorXml('InvalidToken', 400), 's3_wrong_keys'],
    ['NoSuchBucket', REPLIES.noSuchBucket(), 's3_bucket_not_found'],
    ['PermanentRedirect', errorXml('PermanentRedirect', 301, region), 's3_wrong_region'],
    ['a 301 with no body', { status: 301, headers: {} }, 's3_wrong_region'],
    [
      'AuthorizationHeaderMalformed',
      errorXml('AuthorizationHeaderMalformed', 400),
      's3_wrong_region',
    ],
    [
      'IllegalLocationConstraintException',
      errorXml('IllegalLocationConstraintException', 400),
      's3_wrong_region',
    ],
    ['TemporaryRedirect', errorXml('TemporaryRedirect', 307, region), 's3_wrong_region'],
    ['a 403 with no body', { status: 403, headers: {} }, 's3_permission_missing'],
    ['a refused connection', network('ECONNREFUSED'), 's3_cannot_reach'],
    ['an unknown host', network('ENOTFOUND'), 's3_cannot_reach'],
    [
      'a timed-out request',
      Object.assign(new Error('late'), { name: 'TimeoutError' }),
      's3_cannot_reach',
    ],
    ['RequestTimeout', REPLIES.requestTimeout(), 's3_cannot_reach'],
    ['SlowDown', REPLIES.slowDown(), 's3_check_failed'],
    ['InternalError', REPLIES.internal(), 's3_check_failed'],
  ])('%s is %s, and nothing more is sent', async (_name, answer, reason) => {
    const { outcome, steps } = await run({ list: answer })
    expect(outcome).toMatchObject({ ok: false, reason, leftFile: false })
    expect(steps).toEqual(['list'])
  })

  it('follows no redirect: a 307 to another host is one call and a refusal', async () => {
    const moved: Answer = {
      ...errorXml('TemporaryRedirect', 307, region),
      headers: { 'content-type': 'application/xml', location: 'https://elsewhere.example/' },
    }
    const { outcome, seen } = await run({ list: moved })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_wrong_region' })
    expect(seen.map((r) => r.hostname)).toEqual([HOST])
  })
})

describe('checkS3Access: a missing permission is named by its step', () => {
  it.each<[S3CheckStep, S3CheckStep[], boolean]>([
    ['list', ['list'], false],
    ['write', ['list', 'write', 'delete'], false],
    ['read', ['list', 'write', 'read', 'delete'], false],
    ['delete', ['list', 'write', 'read', 'delete'], true],
  ])('AccessDenied at %s', async (step, sent, leftFile) => {
    const { outcome, steps } = await run({ [step]: REPLIES.accessDenied() })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_permission_missing', permission: step })
    expect(outcome).toMatchObject({ leftFile })
    expect(steps).toEqual(sent)
  })
})

describe('checkS3Access: the delete', () => {
  it('is still sent after a failed read, naming the written key', async () => {
    const { outcome, seen, steps } = await run({ read: REPLIES.internal() })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_check_failed', leftFile: false })
    expect(steps).toEqual(['list', 'write', 'read', 'delete'])
    expect(deletedKeys(seen[3] as never)).toEqual([keyOf(seen[1] as never)])
  })

  it('a read that gives other bytes fails, and the delete is still sent', async () => {
    const other: Answer = { status: 200, headers: { 'content-type': 'text/plain' }, body: 'x' }
    const { outcome, steps } = await run({ read: other })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_check_failed', leftFile: false })
    expect(steps).toEqual(['list', 'write', 'read', 'delete'])
  })

  it('a failed read then a failed delete: the read decides, and the file is left', async () => {
    const { outcome } = await run({ read: REPLIES.accessDenied(), delete: network('ECONNRESET') })
    expect(outcome).toMatchObject({ reason: 's3_permission_missing', permission: 'read' })
    expect(outcome).toMatchObject({ leftFile: true })
  })

  it.each<[string, Answer | Error, string]>([
    ['a key in the reply Errors', REPLIES.deleteErrors(), 's3_permission_missing'],
    ['a thrown error', REPLIES.internal(), 's3_check_failed'],
    ['a network error', network('ECONNRESET'), 's3_cannot_reach'],
  ])('%s fails the check and the file is left', async (_n, answer, reason) => {
    const { outcome } = await run({ delete: answer })
    expect(outcome).toMatchObject({ ok: false, reason, leftFile: true })
  })

  it('is still sent after a failed write, naming the key the write tried [review N-2]', async () => {
    const { outcome, seen, steps } = await run({ write: REPLIES.internal() })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_check_failed', leftFile: false })
    expect(steps).toEqual(['list', 'write', 'delete'])
    expect(deletedKeys(seen[2] as never)).toEqual([keyOf(seen[1] as never)])
  })

  it('a failed delete after a failed write keeps the write reason and sets no left file', async () => {
    const write = network('ETIMEDOUT')
    const { outcome } = await run({ write, delete: REPLIES.accessDenied() })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_cannot_reach', leftFile: false })
    expect(outcome).not.toHaveProperty('permission')
  })
})

describe('checkS3Access: the host pin and the keys', () => {
  it('refuses a host off the pin before anything is sent', async () => {
    const { seen, requestHandler } = checkStandIn()
    const setup = buildS3Client(testContext(), requestHandler)
    setup.client.middlewareStack.add(
      (next) => async (args) => {
        const request = args.request as { hostname: string }
        request.hostname = 'elsewhere.example'
        return next(args)
      },
      { step: 'finalizeRequest', name: 'moveHost' },
    )
    const outcome = await runS3Check(setup)
    expect(outcome).toMatchObject({ ok: false, reason: 's3_check_failed', leftFile: false })
    expect(outcome).toMatchObject({ detail: expect.stringContaining('is not the S3 host') })
    expect(seen).toEqual([])
  })

  it('a client that cannot be built is a failed check, and nothing is sent', async () => {
    const { seen, requestHandler } = checkStandIn()
    const ctx = testContext()
    const s3 = ctx.settings().storage.s3
    if (s3) Object.assign(s3, { region: 'not a region' })
    const outcome = await checkS3Access(ctx, { requestHandler })
    expect(outcome).toMatchObject({ ok: false, reason: 's3_check_failed', leftFile: false })
    expect(seen).toEqual([])
  })

  it('names the step in the log detail and holds neither key anywhere', async () => {
    const echo = errorXml('AccessDenied', 403, `<Note>${TEST_KEY_ID} ${TEST_SECRET}</Note>`)
    echo.body = String(echo.body).replace('Made-up message for AccessDenied', TEST_SECRET)
    for (const overrides of [{ list: REPLIES.invalidKeyId() }, { delete: echo }, { read: echo }]) {
      const { outcome } = await run(overrides)
      const text = JSON.stringify(outcome)
      expect(text).not.toContain(TEST_KEY_ID)
      expect(text).not.toContain(TEST_SECRET)
      expect(outcome).toMatchObject({ detail: expect.stringMatching(/^(list|read|delete): /) })
    }
  })
})
