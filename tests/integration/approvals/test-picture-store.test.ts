// AP-7 (spec/approvals.md "Pictures", A-97): the test picture store is chosen only with dev
// tools on and ADMAN_APPROVALS_TEST_PICTURES set to exactly http://127.0.0.1:{port}. It writes
// only inside {userData}/approvals-test-pictures/, refuses a link or a file in place of that
// folder, and touches nothing outside the campaign folder it is given.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { choosePictureStore } from '@/main/approvals/picture-store'
import { REFUSED_PATH } from '@/main/providers/storage-paths'

const VAR = 'ADMAN_APPROVALS_TEST_PICTURES'
const ORIGIN = 'http://127.0.0.1:8787'
const P = '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE'
const FOLDER = `adman-approvals/${P}/spring-sale-abc234/`
const OTHER = `adman-approvals/${P}/autumn-sale-abc234/`
const FILE = `${FOLDER}k3f9q2-3.png`
const PNG = new Uint8Array([137, 80, 78, 71])

let f: Fixture | undefined
let outside: string | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
  if (outside) fs.rmSync(outside, { recursive: true, force: true })
  outside = undefined
})

function fixture(): Fixture {
  f = makeFixture()
  return f
}

const folderOf = (fx: Fixture) => path.join(fx.userData, 'approvals-test-pictures')

function store(fx: Fixture, devTools: boolean, value: string | undefined) {
  return choosePictureStore({ deps: { ...fx.core.deps, devTools }, env: { [VAR]: value } })
}

function filesUnder(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort()
}

describe('which picture store [spec/approvals.md "Pictures", A-97]', () => {
  it('chooses the test store with dev tools on and the exact 127.0.0.1 origin', async () => {
    const fx = fixture()
    await store(fx, true, ORIGIN).put(FILE, PNG)
    expect(filesUnder(folderOf(fx))).toEqual([FILE])
  })

  it.each([
    [true, undefined],
    [true, ''],
    [true, `${ORIGIN}/`],
    [true, ` ${ORIGIN}`],
    [true, 'http://localhost:8787'],
    [true, 'https://127.0.0.1:8787'],
    [true, 'http://127.0.0.2:8787'],
    [true, 'http://user@127.0.0.1:8787'],
    [true, 'http://127.0.0.1'],
    [true, 'http://127.0.0.1:0'],
    [true, 'http://127.0.0.1:08787'],
    [true, 'http://127.0.0.1:65536'],
    [true, 'http://[::1]:8787'],
    [false, ORIGIN],
  ])(
    'with dev tools %s and %j it is the S3 store (NEEDS_KEY, nothing written)',
    async (on, value) => {
      const fx = fixture()
      await expect(store(fx, on, value).put(FILE, PNG)).rejects.toMatchObject({
        code: 'NEEDS_KEY',
      })
      expect(fs.existsSync(folderOf(fx))).toBe(false)
    },
  )

  it('deps.approvals.pictures() of a core without dev tools ignores the variable', async () => {
    f = makeFixture({ env: { [VAR]: ORIGIN } })
    await expect(f.core.deps.approvals.pictures().put(FILE, PNG)).rejects.toMatchObject({
      code: 'NEEDS_KEY',
    })
    expect(fs.existsSync(folderOf(f))).toBe(false)
  })
})

describe('the test store [spec/approvals.md "Pictures"]', () => {
  it('gives {origin}/{path} with an expiry the lifetime on', async () => {
    const fx = fixture()
    const signed = await store(fx, true, ORIGIN).signedUrl(FILE, 604_800)
    const now = fx.core.deps.now().getTime()
    expect(signed.url).toBe(`${ORIGIN}/${FILE}`)
    const expires = Date.parse(signed.expiresAt)
    expect(expires - now).toBeGreaterThan(604_800_000 - 60_000)
    expect(expires - now).toBeLessThanOrEqual(604_800_000)
  })

  it('lists and removes inside the campaign folder only', async () => {
    const fx = fixture()
    const pictures = store(fx, true, ORIGIN)
    const own = [FILE, `${FOLDER}aaaaaa-1.png`]
    for (const file of [...own, `${OTHER}k3f9q2-1.png`]) await pictures.put(file, PNG)
    fs.writeFileSync(path.join(folderOf(fx), FOLDER, 'notes.txt'), 'planted')
    fs.writeFileSync(path.join(fx.userData, 'beside.txt'), 'planted')
    expect((await pictures.list(FOLDER)).sort()).toEqual([...own].sort())
    await pictures.remove(own)
    expect(filesUnder(folderOf(fx))).toEqual([`${OTHER}k3f9q2-1.png`, `${FOLDER}notes.txt`])
    expect(fs.existsSync(path.join(fx.userData, 'beside.txt'))).toBe(true)
  })

  it.each([
    `${FOLDER}../../../../beside.png`,
    `${FOLDER}sub/k3f9q2-1.png`,
    `adman-approvals/${P}/k3f9q2-1.png`,
    'k3f9q2-1.png',
    `/${FILE}`,
  ])('refuses %j and writes nothing anywhere', async (bad) => {
    const fx = fixture()
    const pictures = store(fx, true, ORIGIN)
    const refused = new Error(REFUSED_PATH)
    await expect(pictures.put(bad, PNG)).rejects.toThrow(refused)
    await expect(pictures.signedUrl(bad, 60)).rejects.toThrow(refused)
    await expect(pictures.remove([bad])).rejects.toThrow(refused)
    await expect(pictures.list(bad)).rejects.toThrow(refused)
    expect(filesUnder(fx.root).filter((p) => !p.startsWith('userData/logs/'))).toEqual([])
  })

  it.each([
    ['a link to a folder', (target: string, at: string) => fs.symlinkSync(target, at, 'dir')],
    ['a link to nowhere', (target: string, at: string) => fs.symlinkSync(`${target}-x`, at)],
    ['a file', (_target: string, at: string) => fs.writeFileSync(at, 'not a folder')],
  ])('refuses %s in place of the folder, and writes nothing there', async (_case, plant) => {
    const fx = fixture()
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-outside-'))
    fs.mkdirSync(fx.userData, { recursive: true })
    plant(outside, folderOf(fx))
    const pictures = store(fx, true, ORIGIN)
    const refused = new Error(REFUSED_PATH)
    await expect(pictures.put(FILE, PNG)).rejects.toThrow(refused)
    await expect(pictures.list(FOLDER)).rejects.toThrow(refused)
    await expect(pictures.remove([FILE])).rejects.toThrow(refused)
    expect(filesUnder(outside)).toEqual([])
    expect(fs.existsSync(`${outside}-x`)).toBe(false)
  })
})

const CLIP = `${FOLDER}k3f9q2-3.mp4`
const clipOf = (...parts: number[][]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) controller.enqueue(new Uint8Array(part))
      controller.close()
    },
  })

describe('the test store: clips [spec/phases/round-2-approvals-video.md "R2V-3"]', () => {
  it('writes the bytes of a clip under its folder, lists it and removes it', async () => {
    const fx = fixture()
    const pictures = store(fx, true, ORIGIN)
    await pictures.putClip(CLIP, clipOf([0, 0, 0, 24], [102, 116, 121, 112]))
    expect(filesUnder(folderOf(fx))).toEqual([CLIP])
    const written = fs.readFileSync(path.join(folderOf(fx), CLIP))
    expect([...written]).toEqual([0, 0, 0, 24, 102, 116, 121, 112])
    expect(await pictures.list(FOLDER)).toEqual([CLIP])
    expect((await pictures.signedUrl(CLIP, 60)).url).toBe(`${ORIGIN}/${CLIP}`)
    await pictures.remove([CLIP])
    expect(filesUnder(folderOf(fx))).toEqual([])
  })

  it.each([
    ['a .png name', FILE],
    ['a path outside the folder', `${FOLDER}../../../../beside.mp4`],
    ['a path below the folder', `${FOLDER}sub/k3f9q2-1.mp4`],
    ['a path with no campaign', `adman-approvals/${P}/k3f9q2-1.mp4`],
    ['a bare name', 'k3f9q2-1.mp4'],
    ['an absolute path', `/${CLIP}`],
  ])('putClip refuses %s and writes nothing anywhere', async (_case, bad) => {
    const fx = fixture()
    await expect(store(fx, true, ORIGIN).putClip(bad, clipOf([1]))).rejects.toThrow(
      new Error(REFUSED_PATH),
    )
    expect(filesUnder(fx.root).filter((p) => !p.startsWith('userData/logs/'))).toEqual([])
  })

  it('put refuses a clip name, so a still is never written as .mp4', async () => {
    const fx = fixture()
    await expect(store(fx, true, ORIGIN).put(CLIP, PNG)).rejects.toThrow(new Error(REFUSED_PATH))
    expect(filesUnder(fx.root).filter((p) => !p.startsWith('userData/logs/'))).toEqual([])
  })

  it('refuses a link in place of the folder for a clip too', async () => {
    const fx = fixture()
    outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-outside-'))
    fs.mkdirSync(fx.userData, { recursive: true })
    fs.symlinkSync(outside, folderOf(fx), 'dir')
    await expect(store(fx, true, ORIGIN).putClip(CLIP, clipOf([1]))).rejects.toThrow(
      new Error(REFUSED_PATH),
    )
    expect(filesUnder(outside)).toEqual([])
  })
})
