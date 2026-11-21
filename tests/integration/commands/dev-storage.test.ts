import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeDevFixture, sourceFile, type DevFixture } from './dev-fixture'

let f: DevFixture
afterEach(() => f.cleanup())

const write = (filePath: string) =>
  f.user('dev.storage', { storage: 'local', action: 'write', filePath })
const list = () => f.user('dev.storage', { storage: 'local', action: 'list' })
const remove = () => f.user('dev.storage', { storage: 'local', action: 'remove' })

describe('dev.storage with local storage [SPEC 4.2 dev.storage, 6.5 [1.13]]', () => {
  it('uploads the picked file into adman-hand-test/ under the app data folder', async () => {
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
    const before = fs.readdirSync(f.userData).filter((n) => n !== 'adman-hand-test')
    expect(await remove()).toEqual({ ok: true, data: { removed: 2 } })
    expect(fs.readdirSync(f.handTestDir)).toEqual([])
    expect(fs.readdirSync(f.userData).filter((n) => n !== 'adman-hand-test')).toEqual(before)
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
