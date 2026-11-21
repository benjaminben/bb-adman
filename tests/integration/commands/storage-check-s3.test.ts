// storage.checkS3 (spec/storage-and-publish.md "Test connection (S3)"): the settings check,
// the NEEDS_KEY guard, then checkS3Access under the real host pin with a stand-in handler.
// Nothing is sent beyond this process.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { createCommandBus, type BusEvent } from '@/main/commands/bus'
import { storageCheckS3 } from '@/main/commands/storage/check-s3'
import { storageCommands } from '@/main/commands/storage'
import { denialMessage } from '@/main/commands/agent-policy'
import { checkS3Access } from '@/main/providers/s3/check-access'
import { S3_NOT_SET_UP_MESSAGE } from '@/shared/schemas/commands/storage-check'
import {
  checkStandIn,
  errorXml,
  REPLIES,
  type Overrides,
} from '../../unit/main/providers/s3/check-stand-in'
import type { Answer } from '../../unit/main/providers/s3/recorded'

const KEY_ID = 'made-up-key-id-for-check-0001'
const SECRET = 'made-up-secret-for-check-0001'
const S3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: 'made-up-prefix' }

let f: Fixture
afterEach(() => f.cleanup())

async function setUp(opts: { s3?: typeof S3 | null; keys?: boolean } = {}) {
  f = makeFixture()
  const s3 = opts.s3 === undefined ? S3 : opts.s3
  if (s3) await f.user('settings.update', { storage: { s3 } })
  if (opts.keys !== false) {
    await f.user('secret.set', { name: 's3.accessKeyId', value: KEY_ID })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: SECRET })
  }
}

// A bus holding only storage.checkS3, its check answered by the stand-in.
function checkBus(overrides: Overrides = {}) {
  const { seen, requestHandler } = checkStandIn(overrides)
  const events: BusEvent[] = []
  const deps = f.core.deps
  const bus = createCommandBus({
    handlers: [storageCheckS3(deps, (ctx) => checkS3Access(ctx, { requestHandler }))],
    projects: deps.projects,
    undo: deps.undo,
    log: deps.log,
    emit: (event) => events.push(event),
    askPermission: async () => false,
  })
  const run = (actor: 'user' | 'agent' = 'user') => bus.execute('storage.checkS3', {}, { actor })
  return { run, seen, events }
}

describe('storage.checkS3 registration and guards [spec "Test connection (S3)"]', () => {
  it('is the one storage command, registered in the core', async () => {
    await setUp()
    expect(storageCommands(f.core.deps).map((h) => h.name)).toEqual(['storage.checkS3'])
    expect(f.core.commandNames).toContain('storage.checkS3')
  })

  it.each([
    ['no S3 settings', null],
    ['an empty bucket', { ...S3, bucket: '' }],
    ['an empty region', { ...S3, region: '' }],
  ])('with %s is storage_not_set_up and sends nothing', async (_n, s3) => {
    await setUp({ s3 })
    const { run, seen } = checkBus()
    expect(await run()).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: S3_NOT_SET_UP_MESSAGE,
        details: { reason: 'storage_not_set_up', provider: 's3' },
      },
    })
    expect(seen).toEqual([])
  })

  it('with no keys is NEEDS_KEY and sends nothing', async () => {
    await setUp({ keys: false })
    const { run, seen } = checkBus()
    expect(await run()).toEqual({
      ok: false,
      error: {
        code: 'NEEDS_KEY',
        message: 'Add your Amazon S3 key to test the connection.',
        details: { provider: 's3' },
      },
    })
    expect(seen).toEqual([])
  })

  it('is AGENT_DENIED to an agent, through the core bus and before anything is sent', async () => {
    await setUp()
    const { run, seen } = checkBus()
    const denied = {
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage('storage.checkS3') },
    }
    expect(await f.agent('storage.checkS3', {})).toMatchObject(denied)
    expect(await run('agent')).toMatchObject(denied)
    expect(seen).toEqual([])
  })
})

const LEFT = ' A small test file was left in the folder adman-connection-check. You may delete it.'
const network = Object.assign(new Error('connect ENOTFOUND'), { code: 'ENOTFOUND' })

describe('storage.checkS3 replies', () => {
  it('answers { ok: true } after the four calls', async () => {
    await setUp()
    const { run, seen } = checkBus()
    expect(await run()).toEqual({ ok: true, data: { ok: true } })
    expect(seen).toHaveLength(4)
  })

  it.each<[string, Overrides, Record<string, string>, string]>([
    [
      'wrong keys',
      { list: REPLIES.invalidKeyId() },
      { reason: 's3_wrong_keys' },
      'Amazon S3 did not accept these keys. Check the access key ID and the secret access key.',
    ],
    [
      'no bucket',
      { list: REPLIES.noSuchBucket() },
      { reason: 's3_bucket_not_found' },
      'Amazon S3 has no bucket with that name. Check the bucket name.',
    ],
    [
      'wrong region',
      { list: errorXml('PermanentRedirect', 301) },
      { reason: 's3_wrong_region' },
      'That bucket is in a different region. Check the region.',
    ],
    [
      'no list',
      { list: REPLIES.accessDenied() },
      { reason: 's3_permission_missing', permission: 'list' },
      'These keys may not list files in the bucket. Give them the s3:ListBucket permission.',
    ],
    [
      'no write',
      { write: REPLIES.accessDenied() },
      { reason: 's3_permission_missing', permission: 'write' },
      'These keys may not write files to the bucket. Give them the s3:PutObject permission.',
    ],
    [
      'no read',
      { read: REPLIES.accessDenied() },
      { reason: 's3_permission_missing', permission: 'read' },
      'These keys may not read files from the bucket. Give them the s3:GetObject permission.',
    ],
    [
      'no delete',
      { delete: REPLIES.accessDenied() },
      { reason: 's3_permission_missing', permission: 'delete' },
      `These keys may not delete files from the bucket. Give them the s3:DeleteObject permission.${LEFT}`,
    ],
    [
      'no reach',
      { list: network },
      { reason: 's3_cannot_reach' },
      'Adman could not reach Amazon S3. Check the internet connection and the region, then try again.',
    ],
    [
      'other',
      { list: REPLIES.internal() },
      { reason: 's3_check_failed' },
      "Amazon S3 refused the test. Try again, or check the bucket's settings in Amazon Web Services.",
    ],
  ])('%s: PROVIDER_ERROR with its one sentence', async (_n, overrides, details, message) => {
    await setUp()
    const { run } = checkBus(overrides)
    expect(await run()).toEqual({ ok: false, error: { code: 'PROVIDER_ERROR', message, details } })
  })

  it('holds no key, address or provider message in the reply or an event; the log has the step and no key', async () => {
    await setUp()
    const echo: Answer = errorXml('AccessDenied', 403, `<Note>${KEY_ID}</Note>`)
    echo.body = String(echo.body).replace('Made-up message for AccessDenied', `Denied ${SECRET}`)
    for (const overrides of [{ list: REPLIES.invalidKeyId() }, { delete: echo }, { read: echo }]) {
      const { run, events } = checkBus(overrides)
      const shown = JSON.stringify([await run(), events])
      for (const banned of [
        KEY_ID,
        SECRET,
        'amazonaws.com',
        'made-up-prefix',
        'Made-up message',
        'Denied',
        'HTTP',
      ]) {
        expect(shown).not.toContain(banned)
      }
    }
    const logs = f.readLogs()
    expect(logs).not.toContain(KEY_ID)
    expect(logs).not.toContain(SECRET)
    expect(logs).toContain('"name":"storage.checkS3"')
    expect(logs).toMatch(/"message":"read: HTTP 403 AccessDenied/)
  })

  it('writes nothing to the settings', async () => {
    await setUp()
    const before = JSON.stringify(f.core.deps.settings.get())
    await checkBus({ delete: REPLIES.accessDenied() }).run()
    expect(JSON.stringify(f.core.deps.settings.get())).toBe(before)
  })
})
