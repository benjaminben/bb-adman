// The named isolation test (spec/approvals.md "Named tests", spec/approvals-client.md
// "Pictures"): bad IDs are refused before any call, and a publish and an end touch nothing
// outside the campaign's folder. The test store writes under a temporary folder with files
// planted beside the campaign's folder; every path the store is given is recorded.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import type { PictureStore } from '@/main/approvals/types'
import { REFUSED_PATH } from '@/main/providers/storage-paths'
import {
  clipPath,
  pictureFolder,
  picturePath,
  picturesIn,
  removalFolder,
} from '@/shared/approvals/picture-paths'
import { data } from '../core-fixture'
import {
  addVariants,
  bumpRev,
  makeLinkFixture,
  pair,
  setUp,
  stubDraw,
  variantsOf,
  type LinkFixture,
} from './link-fixture'

let lf: LinkFixture
let touched: string[]

beforeEach(async () => {
  lf = await makeLinkFixture()
  await setUp(lf)
  for (const c of [lf.c1, lf.c2]) data(await lf.f.user('approvals.createLink', pair(lf, c)))
  touched = []
  const real = lf.f.core.deps.approvals.pictures()
  const store: PictureStore = {
    put: (p, png) => (touched.push(p), real.put(p, png)),
    putClip: (p, clip) => (touched.push(p), real.putClip(p, clip)),
    signedUrl: (p, s) => (touched.push(p), real.signedUrl(p, s)),
    list: (folder) => (touched.push(folder), real.list(folder)),
    remove: (paths) => (touched.push(...paths), real.remove(paths)),
  }
  vi.spyOn(lf.f.core.deps.approvals, 'pictures').mockReturnValue(store)
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const root = () => path.join(lf.f.userData, TEST_PICTURES_FOLDER)
const onDisk = (rel: string) => fs.existsSync(path.join(root(), rel))
const plant = (rel: string) => {
  fs.mkdirSync(path.dirname(path.join(root(), rel)), { recursive: true })
  fs.writeFileSync(path.join(root(), rel), new Uint8Array([137, 80, 78, 71]))
}

describe('picture paths over publish and end [spec/approvals.md "Named tests"]', () => {
  it.each([
    ['a variant ID from the project file that is not a variant key', 'variant'],
    ['a campaign ID that is not a campaign ID', 'campaign'],
  ])('refuses %s before any draw, store call or request', async (_n, what) => {
    const draw = stubDraw(lf)
    let campaignId = lf.c1
    if (what === 'variant') {
      addVariants(lf, lf.c1, 1)
      lf.db().prepare("UPDATE variant SET id = '../../x' WHERE id = 'zz2222'").run()
    } else {
      campaignId = '../../other-abc234'
    }
    const sent = lf.stand.seen.length
    const reply = await lf.f.user('approvals.publish', { projectId: lf.projectId, campaignId })
    expect(reply.ok).toBe(false)
    expect(JSON.stringify(reply)).not.toContain('../')
    expect(draw).not.toHaveBeenCalled()
    expect(touched).toEqual([])
    expect(lf.stand.seen.length).toBe(sent)
  })

  it("touches nothing outside the campaign's folder through two publishes and an end", async () => {
    const folder = pictureFolder(lf.projectId, lf.c1)
    const [extra = ''] = addVariants(lf, lf.c1, 1)
    const [theirs] = variantsOf(lf, lf.c2)
    const beside = [
      picturePath(lf.projectId, lf.c2, theirs!.id, 0),
      `${folder.slice(0, -1)}.png`,
      `${folder.slice(0, -1)}-old/${extra}-0.png`,
      `${pictureFolder(lf.projectId, lf.c1).replace(lf.projectId, '01JD5Z8Q4N3V6W7X8Y9Z0ABCDE')}${extra}-0.png`,
      `${folder}notes.txt`,
    ]
    for (const rel of beside) plant(rel)
    stubDraw(lf)
    data(await lf.f.user('approvals.publish', pair(lf)))
    bumpRev(lf, extra)
    data(await lf.f.user('approvals.publish', pair(lf)))
    data(await lf.f.user('approvals.endLink', pair(lf)))
    expect(touched.length).toBeGreaterThan(0)
    for (const p of touched) expect(p.startsWith(folder)).toBe(true)
    for (const rel of beside) expect(onDisk(rel)).toBe(true)
    for (const v of variantsOf(lf))
      expect(onDisk(picturePath(lf.projectId, lf.c1, v.id, v.rev))).toBe(false)
  })
})

const clipOf = (bytes: number[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(bytes))
      controller.close()
    },
  })

describe('clip paths [SV-10, spec/phases/round-2-approvals-video.md "R2V-3"]', () => {
  it('builds {folder}{variantId}-{rev}.mp4 with the same part checks as a picture', () => {
    const folder = pictureFolder(lf.projectId, lf.c1)
    expect(clipPath(lf.projectId, lf.c1, 'k3f9q2', 3)).toBe(`${folder}k3f9q2-3.mp4`)
    for (const [p, c, v, rev] of [
      ['../x', lf.c1, 'k3f9q2', 1],
      [lf.projectId, '../other-abc234', 'k3f9q2', 1],
      [lf.projectId, lf.c1, '../x', 1],
      [lf.projectId, lf.c1, 'k3f-q2', 1],
      [lf.projectId, lf.c1, 'k3f9q2', -1],
      [lf.projectId, lf.c1, 'k3f9q2', 1.5],
    ] as const) {
      expect(() => clipPath(p, c, v, rev)).toThrow(new Error(REFUSED_PATH))
    }
  })

  it.each([
    ['an .mp4 with a bad variant ID', 'k3f-q2-1.mp4'],
    ['an .mp4 with an upper-case variant ID', 'K3F9Q2-1.mp4'],
    ['an .mp4 with a padded rev', 'k3f9q2-01.mp4'],
    ['an .mp4 in a folder below', 'sub/k3f9q2-1.mp4'],
    ['an .mp4 that climbs out', '../other-abc234/k3f9q2-1.mp4'],
    ['a .mov', 'k3f9q2-1.mov'],
    ['an .MP4', 'k3f9q2-1.MP4'],
    ['a name ending .mp4.png', 'k3f9q2-1.mp4.png'],
    ['a name ending .png.mp4', 'k3f9q2-1.png.mp4'],
    ['x-1.mp4.png', 'x-1.mp4.png'],
  ])('refuses %s before any call, and writes nothing', async (_n, name) => {
    const store = lf.f.core.deps.approvals.pictures()
    const file = `${pictureFolder(lf.projectId, lf.c1)}${name}`
    const refused = new Error(REFUSED_PATH)
    await expect(store.putClip(file, clipOf([1, 2, 3]))).rejects.toThrow(refused)
    await expect(store.put(file, new Uint8Array([1]))).rejects.toThrow(refused)
    await expect(store.signedUrl(file, 60)).rejects.toThrow(refused)
    await expect(store.remove([file])).rejects.toThrow(refused)
    expect(fs.existsSync(root()) ? fs.readdirSync(root(), { recursive: true }) : []).toEqual([])
  })

  it("keeps a clip in another campaign's folder out of a listing and a removal", async () => {
    const [theirs] = variantsOf(lf, lf.c2)
    const mine = clipPath(lf.projectId, lf.c1, 'k3f9q2', 1)
    const other = clipPath(lf.projectId, lf.c2, theirs!.id, 0)
    const folder = pictureFolder(lf.projectId, lf.c1)
    expect(picturesIn(folder, [mine, other])).toEqual([mine])
    expect(() => removalFolder([mine, other])).toThrow(new Error(REFUSED_PATH))
    plant(other)
    const store = lf.f.core.deps.approvals.pictures()
    await expect(store.remove([mine, other])).rejects.toThrow(new Error(REFUSED_PATH))
    expect(onDisk(other)).toBe(true)
  })

  it("removes the campaign's own clips when the link is turned off, and no other", async () => {
    const [theirs] = variantsOf(lf, lf.c2)
    const [mine] = variantsOf(lf)
    const own = clipPath(lf.projectId, lf.c1, mine!.id, 0)
    const other = clipPath(lf.projectId, lf.c2, theirs!.id, 0)
    await lf.f.core.deps.approvals.pictures().putClip(own, clipOf([0, 0, 0, 24]))
    plant(other)
    expect(fs.readFileSync(path.join(root(), own))).toEqual(Buffer.from([0, 0, 0, 24]))
    data(await lf.f.user('approvals.endLink', pair(lf)))
    expect(onDisk(own)).toBe(false)
    expect(onDisk(other)).toBe(true)
  })
})
