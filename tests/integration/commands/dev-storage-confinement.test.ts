import fs from 'node:fs'
import os from 'node:os'
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
    expect(result.ok ? null : result.error.code).toBe('RULE_VIOLATION')
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
      expect(result.ok ? null : result.error.code).toBe('RULE_VIOLATION')
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

const UNSAFE = {
  ok: false,
  error: {
    code: 'RULE_VIOLATION',
    message: 'The hand-test folder holds a link and cannot be used. Remove the link and try again.',
    details: { reason: 'storage_folder_unsafe' },
  },
}

// Whether this platform lets a test make a link; the link cases skip where it cannot.
const canLink = (() => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-link-'))
  try {
    fs.symlinkSync(dir, path.join(dir, 'link'))
    return true
  } catch {
    return false
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})()

// Every entry under `dir`, links not followed, with the contents of each file. The activity
// log the app writes for each command (logs/activity-*.jsonl) is left out.
function snapshot(dir: string, at = ''): string[] {
  const out: string[] = []
  for (const name of fs.readdirSync(path.join(dir, at)).sort()) {
    const rel = at === '' ? name : `${at}/${name}`
    if (/^logs\/activity-.*\.jsonl$/.test(rel)) continue
    const stats = fs.lstatSync(path.join(dir, rel))
    if (stats.isFile()) out.push(`${rel}: ${fs.readFileSync(path.join(dir, rel), 'utf8')}`)
    else out.push(stats.isSymbolicLink() ? `${rel} -> link` : rel)
    if (stats.isDirectory()) out.push(...snapshot(dir, rel))
  }
  return out
}

// Made-up app data files that no hand-test action may change.
function seedAppData() {
  fs.writeFileSync(path.join(f.userData, 'secrets.bin'), 'made-up secrets')
  fs.writeFileSync(path.join(f.userData, 'settings.json'), '{}')
  fs.mkdirSync(path.join(f.userData, 'logs'), { recursive: true })
  fs.writeFileSync(path.join(f.userData, 'logs', 'app.log'), 'made-up log line\n')
}

describe('dev.storage refuses a local root or folder that is a link [SPEC 4.2 1.21, 14 M1]', () => {
  const elsewhere = () => path.join(f.root, 'elsewhere')
  const cases: Array<[string, () => void]> = [
    [
      'the hand-test folder is a link to the app data folder',
      () => {
        fs.symlinkSync(f.userData, f.handTestDir)
      },
    ],
    [
      'the hand-test folder is a link to the logs folder',
      () => {
        fs.symlinkSync(path.join(f.userData, 'logs'), f.handTestDir)
      },
    ],
    [
      'the root is a link to the app data folder',
      () => {
        fs.rmSync(f.localRoot, { recursive: true })
        fs.symlinkSync(f.userData, f.localRoot)
      },
    ],
    [
      'the root is a link to a folder outside',
      () => {
        fs.rmSync(f.localRoot, { recursive: true })
        fs.mkdirSync(path.join(elsewhere(), 'adman-hand-test'), { recursive: true })
        fs.writeFileSync(path.join(elsewhere(), 'adman-hand-test', 'kept.txt'), 'kept')
        fs.symlinkSync(elsewhere(), f.localRoot)
      },
    ],
  ]
  for (const [what, setUp] of cases) {
    it.skipIf(!canLink)(`refuses write, list and remove when ${what}`, async () => {
      f = makeDevFixture()
      seedAppData()
      setUp()
      const before = snapshot(f.userData)
      const away = fs.existsSync(elsewhere()) ? snapshot(elsewhere()) : []
      const pick = sourceFile(f.root, 'new.txt')
      for (const reply of [await write(pick), await list(), await remove()]) {
        expect(reply).toEqual(UNSAFE)
      }
      expect(snapshot(f.userData)).toEqual(before)
      expect(fs.existsSync(elsewhere()) ? snapshot(elsewhere()) : []).toEqual(away)
    })
  }

  it('refuses write, list and remove when the root is a file, not a folder', async () => {
    f = makeDevFixture()
    seedAppData()
    fs.rmSync(f.localRoot, { recursive: true })
    fs.writeFileSync(f.localRoot, 'not a folder')
    const before = snapshot(f.userData)
    const pick = sourceFile(f.root, 'new.txt')
    for (const reply of [await write(pick), await list(), await remove()]) {
      expect(reply).toEqual(UNSAFE)
    }
    expect(snapshot(f.userData)).toEqual(before)
  })

  it('with no link, writes to hand-test-local/adman-hand-test/ and adds nothing else', async () => {
    f = makeDevFixture()
    seedAppData()
    fs.rmSync(f.localRoot, { recursive: true })
    const before = snapshot(f.userData)
    expect(await write(sourceFile(f.root, 'new.txt'))).toEqual({
      ok: true,
      data: { name: 'new.txt', size: 9 },
    })
    const landed = path.join(f.userData, 'hand-test-local', 'adman-hand-test', 'new.txt')
    expect(fs.readFileSync(landed, 'utf8')).toBe('hand test')
    const added = [
      'hand-test-local',
      'hand-test-local/adman-hand-test',
      'hand-test-local/adman-hand-test/new.txt: hand test',
    ]
    expect(snapshot(f.userData).sort()).toEqual([...before, ...added].sort())
    expect(await list()).toEqual({ ok: true, data: { names: ['new.txt'] } })
    expect(await remove()).toEqual({ ok: true, data: { removed: 1 } })
    expect(snapshot(f.userData).sort()).toEqual([...before, ...added.slice(0, 2)].sort())
  })
})
