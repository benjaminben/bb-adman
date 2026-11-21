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

// Every file under `dir`, as relative paths, links not followed.
function tree(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .map((d) => path.relative(dir, path.join(d.parentPath, d.name)))
    .sort()
}

describe('dev.storage stays inside adman-hand-test/ [SPEC 4.2 dev.storage, 6.5 [1.13]]', () => {
  it.each([
    ['a name with a backslash', 'a\\..\\b.txt'],
    ['a name ending in a dot', 'trailing.'],
    ['a reserved name', 'CON.txt'],
  ])('refuses %s with INVALID_INPUT and writes nothing', async (_what, name) => {
    f = makeDevFixture()
    const result = await write(sourceFile(f.outside, name))
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
    expect(fs.existsSync(f.handTestDir) ? tree(f.handTestDir) : []).toEqual([])
  })

  it('uses only the last part of a path with .. in it as the name', async () => {
    f = makeDevFixture()
    fs.mkdirSync(path.join(f.outside, 'sub'))
    sourceFile(f.outside, 'note.txt')
    expect(await write(`${f.outside}/sub/../note.txt`)).toEqual({
      ok: true,
      data: { name: 'note.txt', size: 9 },
    })
    expect(tree(f.handTestDir)).toEqual(['note.txt'])
    expect(tree(f.userData).filter((p) => p.startsWith('note'))).toEqual([])
  })

  it('refuses a path ending in .. (a folder) and writes nothing', async () => {
    f = makeDevFixture()
    fs.mkdirSync(path.join(f.outside, 'sub'))
    const result = await write(`${f.outside}/sub/..`)
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
    expect(fs.existsSync(f.handTestDir)).toBe(false)
  })

  it('neither lists nor removes a file reached through a link in the folder', async () => {
    f = makeDevFixture()
    const target = sourceFile(f.outside, 'target.txt')
    fs.mkdirSync(f.handTestDir, { recursive: true })
    fs.symlinkSync(target, path.join(f.handTestDir, 'link.txt'))
    fs.symlinkSync(f.outside, path.join(f.handTestDir, 'linked-folder'))
    expect(await list()).toEqual({ ok: true, data: { names: [] } })
    expect(await remove()).toEqual({ ok: true, data: { removed: 0 } })
    expect(fs.readFileSync(target, 'utf8')).toBe('hand test')
  })

  it('refuses to write over a link in the folder, and the link target is unchanged', async () => {
    f = makeDevFixture()
    const target = sourceFile(f.outside, 'target.txt', 'keep me')
    fs.mkdirSync(f.handTestDir, { recursive: true })
    fs.symlinkSync(target, path.join(f.handTestDir, 'note.txt'))
    const result = await write(sourceFile(f.root, 'note.txt', 'overwrite'))
    expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
    expect(fs.readFileSync(target, 'utf8')).toBe('keep me')
  })

  it('refuses every action when the folder itself is a link out of the app data folder', async () => {
    f = makeDevFixture()
    sourceFile(f.outside, 'kept.txt')
    fs.mkdirSync(f.userData, { recursive: true })
    fs.symlinkSync(f.outside, f.handTestDir)
    for (const result of [
      await write(sourceFile(f.root, 'new.txt')),
      await list(),
      await remove(),
    ]) {
      expect(result.ok ? null : result.error.code).toBe('INVALID_INPUT')
    }
    expect(tree(f.outside)).toEqual(['kept.txt'])
  })

  it('holds no path in any refusal', async () => {
    f = makeDevFixture()
    fs.mkdirSync(f.userData, { recursive: true })
    fs.symlinkSync(f.outside, f.handTestDir)
    const replies = [
      await write(sourceFile(f.root, 'new.txt')),
      await list(),
      await write(path.join(f.root, 'missing.txt')),
      await write(f.outside),
    ]
    for (const reply of replies) expect(JSON.stringify(reply)).not.toContain(f.root)
  })
})
