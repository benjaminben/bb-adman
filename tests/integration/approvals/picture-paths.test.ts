// The named isolation test (spec/approvals.md "Named tests", spec/approvals-client.md
// "Pictures"): bad IDs are refused before any call, and a publish and an end touch nothing
// outside the campaign's folder. The test store writes under a temporary folder with files
// planted beside the campaign's folder; every path the store is given is recorded.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TEST_PICTURES_FOLDER } from '@/main/approvals/test-picture-store'
import type { PictureStore } from '@/main/approvals/types'
import { pictureFolder, picturePath } from '@/shared/approvals/picture-paths'
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
