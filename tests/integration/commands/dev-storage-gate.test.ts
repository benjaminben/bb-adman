import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeDevFixture, sourceFile, type DevFixture } from './dev-fixture'
import { devCommands } from '../../../src/main/commands/dev'
import { devStorage } from '../../../src/main/commands/dev/storage'
import type { StorageProvider } from '../../../src/main/providers/types'

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

  it('with the S3 keys saved and no S3 settings, gives PROVIDER_ERROR and no key', async () => {
    f = makeDevFixture(true)
    await f.user('secret.set', { name: 's3.accessKeyId', value: ACCESS_ID })
    await f.user('secret.set', { name: 's3.secretAccessKey', value: SECRET })
    const result = await f.user('dev.storage', { storage: 's3', action: 'list' })
    expect(result).toEqual({
      ok: false,
      error: {
        code: 'PROVIDER_ERROR',
        message: 'Amazon S3 could not finish this request. Try again.',
        details: { provider: 's3', kind: 'other' },
      },
    })
    const logs = f.readLogs()
    expect(logs).toContain('S3 storage is not set up')
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
  })
})
