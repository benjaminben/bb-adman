// R2V-5, SV-13 (spec/phases/round-2-approvals-video.md "Making one clip"): a clip is exported
// only through deps.export.video (Phase 8's code and its one FFmpeg runner) into a work folder
// under {userData}/export-work that is removed on success, failure, a stop and a clip too
// large; nothing runs without the tool or for a video over 3 minutes. With the fetched FFmpeg,
// a 2 s drawn variant gives a real MP4; that case skips with "FFmpeg is not fetched." without.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi, type TestContext } from 'vitest'
import { makeClip, type ClipJob } from '@/main/approvals/clip-step'
import { ExportFailure } from '@/main/export/failure'
import { EXPORT_WORK } from '@/main/export/video/work-dir'
import { readWireRow } from '@/main/db/rows'
import { noMediaTool } from '@/main/media/no-media'
import { ProviderCancelled } from '@/main/providers/types'
import { CLIP_MAX_BYTES, CLIP_MAX_MS } from '@/shared/approvals/contract'
import { clipPath } from '@/shared/approvals/picture-paths'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { makeLinkFixture, pair, variantsOf, type LinkFixture } from './link-fixture'
import { ffmpegFetched, setupVideoExport, DURATION_MS } from '../export/video-export-fixture'

const CLIP = Buffer.from('\0\0\0\x18ftypisom made-up clip bytes')
let lf: LinkFixture

beforeEach(async () => {
  lf = await makeLinkFixture()
})
afterEach(() => {
  vi.restoreAllMocks()
  return lf.close()
})

const deps = () => lf.f.core.deps
const workBase = () => path.join(lf.f.userData, EXPORT_WORK)
const workLeft = () => (fs.existsSync(workBase()) ? fs.readdirSync(workBase()) : [])

function variant(ms: number): VariantRow {
  const id = variantsOf(lf)[0]!.id
  lf.db().prepare("UPDATE variant SET format = 'video', duration_ms = ? WHERE id = ?").run(ms, id)
  return readWireRow(lf.db(), 'variant', { id }) as VariantRow
}

function job(v: VariantRow, signal = new AbortController().signal) {
  const sent: Array<{ file: string; bytes: Buffer }> = []
  const steps: string[] = []
  const j: ClipJob = {
    project: lf.f.core.projects.requireOpen(lf.projectId),
    pair: pair(lf),
    variant: v,
    rev: v.rev,
    signal,
    put: async (file, data) => {
      const chunks: Uint8Array[] = []
      for await (const c of data as unknown as AsyncIterable<Uint8Array>) chunks.push(c)
      sent.push({ file, bytes: Buffer.concat(chunks) })
    },
    sending: () => void steps.push('sending'),
    logStep: (step) => void steps.push(step),
  }
  return { j, sent, steps }
}

const roots: string[] = []
function stubExport(act: () => void = () => undefined, size?: number) {
  return vi
    .spyOn(deps().export.video, 'exportVariant')
    .mockImplementation(async (jc, _scene, plan, target, file) => {
      roots.push(plan.root)
      expect(workLeft()).toHaveLength(1)
      act()
      if (jc.cancelled()) throw new ProviderCancelled()
      await target.write(file, CLIP)
      if (size) fs.truncateSync(path.join(plan.root, ...file.split('/')), size)
      return { still: null }
    })
}

const tool = (on: boolean) =>
  Object.assign(deps(), { media: { ...noMediaTool, available: () => on } })

describe('makeClip [R2V-5, SV-13]', () => {
  it('exports into a work folder under export-work, uploads the file and removes the folder', async () => {
    tool(true)
    const v = variant(6000)
    stubExport()
    const { j, sent, steps } = job(v)
    expect(await makeClip(deps(), j)).toEqual({
      file: clipPath(lf.projectId, lf.c1, v.id, v.rev),
      durationMs: 6000,
      bytes: CLIP.length,
    })
    expect(sent).toEqual([{ file: clipPath(lf.projectId, lf.c1, v.id, v.rev), bytes: CLIP }])
    expect(steps).toEqual(['sending'])
    expect(path.dirname(roots.at(-1)!)).toBe(fs.realpathSync(workBase()))
    expect(workLeft()).toEqual([])
  })

  const failExport = () => {
    throw new ExportFailure('The video could not be made.')
  }
  it.each([
    ['a failed export', 'clip_failed', failExport],
    ['a stop during the export', 'publish_cancelled', (stop: AbortController) => stop.abort()],
    ['a failed upload', 'upload', () => undefined],
  ] as const)('removes the work folder after %s', async (_name, reason, during) => {
    tool(true)
    const stop = new AbortController()
    stubExport(() => during(stop))
    const { j, sent } = job(variant(6000), stop.signal)
    if (reason === 'upload') j.put = () => Promise.reject(new Error('The upload failed'))
    const made = makeClip(deps(), j)
    if (reason === 'upload') await expect(made).rejects.toThrow('The upload failed')
    else await expect(made).rejects.toMatchObject({ details: { reason } })
    expect(sent).toEqual([])
    expect(workLeft()).toEqual([])
  })

  it('gives too_large for a file over the limit, uploads nothing and removes the folder', async () => {
    tool(true)
    const v = variant(6000)
    stubExport(() => undefined, CLIP_MAX_BYTES + 1)
    const { j, sent } = job(v)
    expect(await makeClip(deps(), j)).toBe('too_large')
    expect(sent).toEqual([])
    expect(workLeft()).toEqual([])
  })

  it.each([
    ['no_tool', false, 6000],
    ['too_long', true, CLIP_MAX_MS + 1],
  ] as const)('gives %s and runs nothing', async (reason, on, ms) => {
    tool(on)
    const exp = stubExport()
    const { j } = job(variant(ms))
    expect(await makeClip(deps(), j)).toBe(reason)
    expect(exp).not.toHaveBeenCalled()
    expect(fs.existsSync(workBase())).toBe(false)
  })

  it('makes a real MP4 of a 2 s drawn variant with the fetched FFmpeg', async (ctx: TestContext) => {
    if (!ffmpegFetched()) ctx.skip('FFmpeg is not fetched.')
    const t = await setupVideoExport()
    try {
      const db = t.fx.core.deps.projects.requireOpen(t.projectId).db
      const v = readWireRow(db, 'variant', { id: t.videoId }) as VariantRow
      const sent: Buffer[] = []
      const made = await makeClip(t.fx.core.deps, {
        project: t.fx.core.deps.projects.requireOpen(t.projectId),
        pair: { projectId: t.projectId, campaignId: t.campaignId },
        variant: v,
        rev: v.rev,
        signal: new AbortController().signal,
        put: async (_file, data) => {
          const chunks: Uint8Array[] = []
          for await (const c of data as unknown as AsyncIterable<Uint8Array>) chunks.push(c)
          sent.push(Buffer.concat(chunks))
        },
        sending: () => undefined,
        logStep: () => undefined,
      })
      const bytes = sent[0]!
      expect(bytes.subarray(4, 8).toString('latin1')).toBe('ftyp')
      expect(made).toMatchObject({ durationMs: DURATION_MS, bytes: bytes.length })
      expect(t.workLeft()).toEqual([])
    } finally {
      t.fx.cleanup()
    }
  })
})
