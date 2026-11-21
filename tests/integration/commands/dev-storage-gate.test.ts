import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeDevFixture, sourceFile, type DevFixture } from './dev-fixture'
import { devCommands } from '../../../src/main/commands/dev'
import { devStorage } from '../../../src/main/commands/dev/storage'
import { openHandTestStorage } from '../../../src/main/commands/dev/storage'
import { ProviderFailure, type StorageProvider } from '../../../src/main/providers/types'
import type { AppError } from '../../../src/shared/schemas/result'

let f: DevFixture
afterEach(() => f.cleanup())

// Made-up values that do not look like real AWS keys.
const ACCESS_ID = 'made-up-access-id-0000'
const SECRET = 'made-up-secret-value-0000'

describe('dev.storage exists only with the hand-test tools on [SPEC 4.2, 13 ADMAN_DEV_TOOLS]', () => {
  it('is registered when createCore gets devTools: true', () => {
    f = makeDevFixture(true)
    expect(f.core.commandNames).toContain('dev.storage')
    expect(devCommands(f.core.deps).map((h) => h.name)).toEqual(['dev.storage'])
  })

  it('is an unknown command when devTools is false, and touches nothing', async () => {
    f = makeDevFixture(false)
    expect(f.core.commandNames).not.toContain('dev.storage')
    const result = await f.user('dev.storage', { storage: 'local', action: 'list' })
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })
})

describe('dev.storage is denied to agents [SPEC 4.2, 5.2]', () => {
  it('answers AGENT_DENIED to an agent and writes nothing', async () => {
    f = makeDevFixture(true)
    const filePath = sourceFile(f.outside)
    const result = await f.agent('dev.storage', { storage: 'local', action: 'write', filePath })
    expect(result.ok ? null : result.error.code).toBe('AGENT_DENIED')
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })
})

describe('dev.storage calls the key guard first [SPEC 4.1, 4.2 dev.storage]', () => {
  it.each([
    ['s3', 'Amazon S3'],
    ['dropbox', 'Dropbox'],
  ])('answers NEEDS_KEY for %s with no key saved', async (storage) => {
    f = makeDevFixture(true)
    const result = await f.user('dev.storage', { storage, action: 'list' })
    expect(result.ok ? null : result.error).toMatchObject({
      code: 'NEEDS_KEY',
      details: { provider: storage },
    })
  })

  it('with the S3 keys saved and no S3 settings, gives RULE_VIOLATION and no key', async () => {
    f = makeDevFixture(true)
    await f.user('secret.set', { name: 's3.accessKeyId', value: ACCESS_ID })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: SECRET })
    const result = await f.user('dev.storage', { storage: 's3', action: 'list' })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'Amazon S3 is not set up yet. Enter a bucket and a region, then try again.',
        details: { reason: 'storage_not_set_up', provider: 's3' },
      },
    })
    const logs = f.readLogs()
    for (const text of [JSON.stringify(result), logs]) {
      expect(text).not.toContain(ACCESS_ID)
      expect(text).not.toContain(SECRET)
    }
  })
})
// A cloud stand-in that records the paths it is sent and answers list with rogue paths too.
function cloudStandIn() {
  const sent: string[] = []
  const storage: StorageProvider = {
    exists: async () => false,
    read: async () => new Uint8Array(),
    write: async (p) => void sent.push(`write ${p}`),
    list: async (p) => (sent.push(`list ${p}`), ['adman-hand-test/a.txt', 'campaign/x.png']),
    remove: async (paths) => void sent.push(`remove ${paths.join(',')}`),
  }
  return { storage, sent }
}

describe('dev.storage with a cloud storage stays in adman-hand-test/ [SPEC 4.2 dev.storage]', () => {
  it('sends only hand-test paths for write, list and remove', async () => {
    f = makeDevFixture(true)
    await f.user('secret.set', { name: 's3.accessKeyId', value: ACCESS_ID })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: SECRET })
    const { storage, sent } = cloudStandIn()
    const opened: string[] = []
    const command = devStorage(f.core.deps, (target) => (opened.push(target), storage))
    const ctx = { actor: 'user' as const, commandId: 'c1' }
    const filePath = sourceFile(f.outside, 'pic.png')
    for (const input of [
      { storage: 's3', action: 'write', filePath },
      { storage: 's3', action: 'list' },
      { storage: 's3', action: 'remove' },
    ]) {
      const parsed = command.parse(input)
      if (!parsed.ok) throw new Error('input refused')
      await command.run(ctx, parsed.input)
    }
    expect(opened).toEqual(['s3', 's3', 's3'])
    expect(sent).toEqual([
      'write adman-hand-test/pic.png',
      'list adman-hand-test',
      'list adman-hand-test',
      'remove adman-hand-test/a.txt',
    ])
    expect(fs.existsSync(path.join(f.userData, 'adman-hand-test'))).toBe(false)
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })
})

describe('dev.storage S3 settings and failures [SPEC 4.1 1.21, 4.2 notes F-02, 14 M3]', () => {
  const saveKeys = async () => {
    await f.user('secret.set', { name: 's3.accessKeyId', value: ACCESS_ID })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: SECRET })
  }

  it('gives RULE_VIOLATION storage_not_set_up for an empty bucket, after the key guard', async () => {
    f = makeDevFixture(true)
    const s3 = { bucket: '', region: 'eu-west-1', prefix: '' }
    await f.user('settings.update', { storage: { s3 } })
    const noKey = await f.user('dev.storage', { storage: 's3', action: 'list' })
    expect(noKey.ok ? null : noKey.error.code).toBe('NEEDS_KEY')
    await saveKeys()
    const result = await f.user('dev.storage', { storage: 's3', action: 'list' })
    expect(result.ok ? null : result.error.details).toEqual({
      reason: 'storage_not_set_up',
      provider: 's3',
    })
  })

  it('with keys and settings saved, a storage failure gives PROVIDER_ERROR; the detail is in the log only, no key', async () => {
    f = makeDevFixture(true)
    await saveKeys()
    const s3 = { bucket: 'made-up-bucket', region: 'eu-west-1', prefix: '' }
    await f.user('settings.update', { storage: { s3 } })
    const failing: StorageProvider = {
      ...cloudStandIn().storage,
      list: async () => {
        throw new ProviderFailure({ kind: 'other', detail: 'made-up raw detail' })
      },
    }
    const command = devStorage(f.core.deps, () => failing)
    const parsed = command.parse({ storage: 's3', action: 'list' })
    if (!parsed.ok) throw new Error('input refused')
    const ctx = { actor: 'user' as const, commandId: 'c1' }
    const reply = await Promise.resolve()
      .then(() => command.run(ctx, parsed.input))
      .then(
        () => null,
        (error: AppError) => error.toBody(),
      )
    expect(reply).toEqual({
      code: 'PROVIDER_ERROR',
      message: 'Amazon S3 could not finish this request. Try again.',
      details: { provider: 's3', kind: 'other' },
    })
    const logs = f.readLogs()
    expect(logs).toContain('made-up raw detail')
    expect(JSON.stringify(reply)).not.toContain('made-up raw detail')
    for (const text of [JSON.stringify(reply), logs]) {
      expect(text).not.toContain(ACCESS_ID)
      expect(text).not.toContain(SECRET)
    }
  })
})

describe('dev.storage with an empty S3 region [SPEC 14 1.40 AA6]', () => {
  it('gives RULE_VIOLATION storage_not_set_up and never reaches the storage', async () => {
    f = makeDevFixture(true)
    await f.user('secret.set', { name: 's3.accessKeyId', value: ACCESS_ID })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: SECRET })
    const s3 = { bucket: 'made-up-bucket', region: '', prefix: '' }
    expect((await f.user('settings.update', { storage: { s3 } })).ok).toBe(true)
    const { storage, sent } = cloudStandIn()
    const realOpen = openHandTestStorage(f.core.deps)
    const command = devStorage(f.core.deps, (target) => (realOpen(target), storage))
    const parsed = command.parse({ storage: 's3', action: 'list' })
    if (!parsed.ok) throw new Error('input refused')
    const ctx = { actor: 'user' as const, commandId: 'c1' }
    const reply = await Promise.resolve()
      .then(() => command.run(ctx, parsed.input))
      .then(
        () => null,
        (error: AppError) => error.toBody(),
      )
    expect(reply).toEqual({
      code: 'RULE_VIOLATION',
      message: 'Amazon S3 is not set up yet. Enter a bucket and a region, then try again.',
      details: { reason: 'storage_not_set_up', provider: 's3' },
    })
    expect(sent).toEqual([])
  })
})
