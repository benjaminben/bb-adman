import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import path from 'node:path'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeDevFixture, sourceFile, type DevFixture } from './dev-fixture'
import { devStorage } from '@/main/commands/dev/storage'
import { HAND_TEST_MAX_UPLOAD_BYTES } from '@/shared/config/dev-tools'
import type { AppError } from '@/shared/schemas/result'

let f: DevFixture
afterEach(() => f.cleanup())

const write = (filePath: string) =>
  f.user('dev.storage', { storage: 'local', action: 'write', filePath })
const list = () => f.user('dev.storage', { storage: 'local', action: 'list' })
const remove = () => f.user('dev.storage', { storage: 'local', action: 'remove' })

describe('dev.storage with local storage [SPEC 4.2 dev.storage, 6.5 [1.13]]', () => {
  it('uploads the picked file into hand-test-local/adman-hand-test/ under the app data folder', async () => {
    f = makeDevFixture()
    const result = await write(sourceFile(f.outside, 'note.txt', 'hand test'))
    expect(result).toEqual({ ok: true, data: { name: 'note.txt', size: 9 } })
    expect(fs.readFileSync(path.join(f.handTestDir, 'note.txt'), 'utf8')).toBe('hand test')
  })

  it('lists the names in that folder', async () => {
    f = makeDevFixture()
    await write(sourceFile(f.outside, 'b.txt'))
    await write(sourceFile(f.outside, 'a.txt'))
    expect(await list()).toEqual({ ok: true, data: { names: ['a.txt', 'b.txt'] } })
  })

  it('lists nothing before anything was uploaded', async () => {
    f = makeDevFixture()
    expect(await list()).toEqual({ ok: true, data: { names: [] } })
  })

  it('removes everything in that folder and nothing else in the app data folder', async () => {
    f = makeDevFixture()
    await write(sourceFile(f.outside, 'a.txt'))
    await write(sourceFile(f.outside, 'b.txt'))
    const before = fs.readdirSync(f.userData)
    expect(await remove()).toEqual({ ok: true, data: { removed: 2 } })
    expect(fs.readdirSync(f.handTestDir)).toEqual([])
    expect(fs.readdirSync(f.userData)).toEqual(before)
    expect(fs.readdirSync(f.localRoot)).toEqual(['adman-hand-test'])
    expect(fs.readdirSync(f.outside).sort()).toEqual(['a.txt', 'b.txt'])
    expect(await list()).toEqual({ ok: true, data: { names: [] } })
  })

  it('leaves the picked file where it was', async () => {
    f = makeDevFixture()
    const file = sourceFile(f.outside)
    await write(file)
    await remove()
    expect(fs.readFileSync(file, 'utf8')).toBe('hand test')
  })
})

describe('dev.storage write refusals [SPEC 4.1 choosing a code, 10.1 refusal tests]', () => {
  it('refuses a file path that is not absolute with INVALID_INPUT', async () => {
    f = makeDevFixture()
    const result = await write('note.txt')
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })

  it('refuses a path that names nothing with NOT_FOUND, holding no path', async () => {
    f = makeDevFixture()
    const result = await write(path.join(f.outside, 'missing.txt'))
    expect(result).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That file was not found.' },
    })
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })

  it('refuses a folder with INVALID_INPUT', async () => {
    f = makeDevFixture()
    const result = await write(f.outside)
    expect(result).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'Choose a file, not a folder.' },
    })
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })

  it('refuses write with no file path, through the schema', async () => {
    f = makeDevFixture()
    const result = await f.user('dev.storage', { storage: 'local', action: 'write' })
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
  })

  it('refuses an action it does not know', async () => {
    f = makeDevFixture()
    const result = await f.user('dev.storage', { storage: 'local', action: 'read' })
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
  })
})

// Whether a file can be made unreadable here (not on Windows, not as root).
const canTakeAwayRead = process.platform !== 'win32' && process.getuid?.() !== 0

describe('dev.storage write: file errors and size [SPEC 4.1 1.21, 4.2 F-03 F-04, 14 M4]', () => {
  it.skipIf(!canTakeAwayRead)(
    'gives RULE_VIOLATION file_not_readable for a file with no read permission, code in a warn log line',
    async () => {
      f = makeDevFixture()
      const file = sourceFile(f.outside, 'locked.txt')
      fs.chmodSync(file, 0o000)
      const result = await write(file)
      fs.chmodSync(file, 0o600)
      expect(result).toEqual({
        ok: false,
        error: {
          code: 'RULE_VIOLATION',
          message: 'That file could not be read.',
          details: { reason: 'file_not_readable' },
        },
      })
      const warn = f
        .readLogs()
        .split('\n')
        .filter((line) => line.includes('"level":"warn"') && line.includes('EACCES'))
      expect(warn).toHaveLength(1)
      expect(warn[0]).not.toContain(f.root)
      expect(fs.existsSync(f.handTestDir)).toBe(false)
    },
  )

  it('refuses a file one byte over the limit with INVALID_INPUT, before it is read', async () => {
    f = makeDevFixture()
    const command = devStorage(f.core.deps, undefined, 8)
    const file = sourceFile(f.outside, 'big.txt', '123456789')
    const reads = vi.spyOn(fsPromises, 'readFile')
    const parsed = command.parse({ storage: 'local', action: 'write', filePath: file })
    if (!parsed.ok) throw new Error('input refused')
    const ctx = { actor: 'user' as const, commandId: 'c1' }
    const reply = await Promise.resolve()
      .then(() => command.run(ctx, parsed.input))
      .then(
        () => null,
        (error: AppError) => error.toBody(),
      )
    expect(reply).toEqual({ code: 'INVALID_INPUT', message: 'Choose a file smaller than 100 MB.' })
    expect(reads).not.toHaveBeenCalled()
    reads.mockRestore()
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })

  it('takes a file at the limit', async () => {
    f = makeDevFixture()
    const command = devStorage(f.core.deps, undefined, 9)
    const parsed = command.parse({
      storage: 'local',
      action: 'write',
      filePath: sourceFile(f.outside, 'fits.txt', '123456789'),
    })
    if (!parsed.ok) throw new Error('input refused')
    const result = await command.run({ actor: 'user', commandId: 'c1' }, parsed.input)
    expect(result).toEqual({ data: { name: 'fits.txt', size: 9 } })
  })

  it('has a limit of 100 MiB', () => {
    expect(HAND_TEST_MAX_UPLOAD_BYTES).toBe(100 * 1024 * 1024)
  })
})
