// P8-6: the image export job (spec/phases/phase-08.md "Export run", "Drawing at full size").
// A real core and job runner over temporary folders; the draw, the picture encoder and the
// report port are stand-ins. Security class short: every write goes through exportTarget.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { setupExport, type ExportSetup } from './export-job-fixture'
import { AD_FAILURES } from '@/shared/export/messages'
import { postTitle } from '@/shared/export/safe-title'

let s: ExportSetup | undefined
afterEach(() => {
  s?.fx.cleanup()
  s = undefined
})

async function setup(): Promise<ExportSetup> {
  s = await setupExport()
  return s
}

describe('the export job writes each image ad [P8-6]', () => {
  it('writes two sizes in two languages as four files at the layout names, in order', async () => {
    const t = await setup()
    const end = await t.run()
    expect(end.status).toBe('succeeded')
    const ordered = t.ordered()
    expect(t.reportOutcomes().map((o) => o.variantId)).toEqual(ordered.map((v) => v.id))
    const names = ordered.map(
      (v) => `${t.campaignId}/${postTitle(v.title)}/${v.sizeLabel}/${v.language}-${v.id}.png`,
    )
    expect(t.files()).toEqual([...names].sort())
    expect(t.reportOutcomes().map((o) => o.file)).toEqual(names)
    for (const name of names) {
      const bytes = fs.readFileSync(path.join(t.root, name))
      expect(bytes.subarray(0, 4)).toEqual(Buffer.from([137, 80, 78, 71]))
      expect(bytes.toString('latin1')).not.toContain('generation')
      expect(bytes.toString('latin1')).not.toContain(t.fx.root)
    }
  })

  it('makes JPG files with toJpeg at the quality of the plan', async () => {
    const t = await setup()
    await t.run({ imageFormat: 'jpg', jpgQuality: 72 })
    expect(t.files().every((name) => name.endsWith('.jpg'))).toBe(true)
    expect(t.files()).toHaveLength(4)
    expect(t.toJpeg).toHaveBeenCalledTimes(4)
    for (const [, quality] of t.toJpeg.mock.calls) expect(quality).toBe(72)
    const first = fs.readFileSync(path.join(t.root, t.files()[0] as string))
    expect([...first]).toEqual([0xff, 0xd8, 72])
  })

  it('fails an ad with a missing file, names the file, and writes nothing for it', async () => {
    const t = await setup()
    const [gone] = t.ordered()
    t.useMissingPicture(gone?.id as string, 'Beach shoot.png')
    const end = await t.run()
    const outcome = t.reportOutcomes().find((o) => o.variantId === gone?.id)
    expect(outcome).toEqual({
      variantId: gone?.id,
      rev: null,
      file: null,
      failure: 'A file this ad uses is missing: Beach shoot.png.',
      picture: null,
    })
    expect(t.files()).toHaveLength(3)
    expect(t.files().some((name) => name.includes(gone?.id as string))).toBe(false)
    expect(end.result).toEqual({ exported: 3, failed: 1, reportId: 'R1' })
  })

  it('fails an ad deleted before it was exported', async () => {
    const t = await setup()
    const gone = t.ordered().find((v) => v.language === 'de')
    const variantIds = t.ordered().map((v) => v.id)
    data(await t.fx.user('variant.remove', { projectId: t.projectId, variantIds: [gone?.id] }))
    await t.run({ variantIds })
    const outcome = t.reportOutcomes().find((o) => o.variantId === gone?.id)
    expect(outcome).toMatchObject({ rev: null, file: null, failure: AD_FAILURES.deleted })
    expect(t.files()).toHaveLength(3)
  })

  it('fails only the ad whose draw throws', async () => {
    const t = await setup()
    t.failDrawWhen((size) => size.height === 1920)
    const end = await t.run()
    expect(end.status).toBe('succeeded')
    const failed = t.reportOutcomes().filter((o) => o.failure !== null)
    expect(failed.map((o) => o.failure)).toEqual([AD_FAILURES.notDrawn, AD_FAILURES.notDrawn])
    for (const o of failed) expect(o.rev).toBe(t.variant(o.variantId).rev)
    expect(t.files()).toHaveLength(2)
    expect(end.result).toEqual({ exported: 2, failed: 2, reportId: 'R1' })
  })

  it('fails a video ad with "The video could not be made." when FFmpeg is missing, and goes on', async () => {
    const t = await setup()
    const [video] = t.ordered()
    t.makeVideo(video?.id as string)
    const end = await t.run()
    expect(end.status).toBe('succeeded')
    const outcome = t.reportOutcomes().find((o) => o.variantId === video?.id)
    expect(outcome).toMatchObject({ file: null, failure: AD_FAILURES.videoNotMade })
    expect(t.files()).toHaveLength(3)
  })

  it('gives a fixed sentence, never the error text, when the video port throws its own', async () => {
    const t = await setup()
    const [video] = t.ordered()
    t.makeVideo(video?.id as string)
    t.fx.core.deps.export.video = {
      exportVariant: async () => {
        throw new Error(`spawn failed at ${t.root}/ffmpeg`)
      },
    }
    await t.run()
    const outcome = t.reportOutcomes().find((o) => o.variantId === video?.id)
    expect(outcome?.failure).toBe(AD_FAILURES.videoNotMade)
  })

  it('raises the progress to 1, one step per ad', async () => {
    const t = await setup()
    const end = await t.run()
    expect(t.progressSeen()).toEqual([0.25, 0.5, 0.75, 1])
    expect(end.progress).toBe(1)
  })
})

describe('what the export job hands on and keeps out [P8-6, A-195, A-196]', () => {
  it('hands the report port one outcome per ad with the drawn rev and a shrunk picture', async () => {
    const t = await setup()
    await t.run()
    expect(t.report).toHaveBeenCalledTimes(1)
    const [, plan, target, outcomes, checks] = t.report.mock.calls[0] ?? []
    expect(plan).toMatchObject({ campaignId: t.campaignId, root: t.root })
    expect(typeof target?.write).toBe('function')
    expect([...(checks?.keys() ?? [])].sort()).toEqual(
      t
        .ordered()
        .map((v) => v.id)
        .sort(),
    )
    for (const o of outcomes ?? []) {
      expect(o.rev).toBe(t.variant(o.variantId).rev)
      expect([...(o.picture ?? [])]).toEqual([0xff, 0xd8, 240])
    }
    expect(t.shrink).toHaveBeenCalledTimes(4)
    for (const [, side] of t.shrink.mock.calls) expect(side).toBe(240)
  })

  it('keeps counts only in the job result, and no folder path in the row, events or log', async () => {
    const t = await setup()
    const end = await t.run()
    expect(end.result).toEqual({ exported: 4, failed: 0, reportId: 'R1' })
    expect(JSON.stringify(t.jobRow(end.id))).not.toContain(t.fx.root)
    expect(JSON.stringify(t.fx.events)).not.toContain(t.fx.root)
    const logs = t.fx.readLogs()
    expect(logs).not.toContain(t.fx.root)
    const done = logs
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((line) => line.name === 'export.done')
    expect(done).toHaveLength(1)
    expect(done[0]).toMatchObject({
      level: 'info',
      projectId: t.projectId,
      campaignId: t.campaignId,
      context: { exported: 4, failed: 0 },
    })
  })

  it('fails a job with no plan with export_not_retried, writing nothing', async () => {
    const t = await setup()
    const end = await t.run({}, { withoutPlan: true })
    expect(end.status).toBe('failed')
    expect(end.errorKind).toBe('other')
    expect(t.errorDetail(end.id)).toBe('export_not_retried')
    expect(t.files()).toEqual([])
    expect(t.report).not.toHaveBeenCalled()
  })

  it('stops on cancel after the first ad: one file, no .partial, no report, cancelled', async () => {
    const t = await setup()
    t.cancelOnDraw(2)
    const end = await t.run()
    expect(end.status).toBe('cancelled')
    expect(t.files()).toHaveLength(1)
    expect(t.allNames().some((name) => name.endsWith('.partial'))).toBe(false)
    expect(t.report).not.toHaveBeenCalled()
  })

  it('writes only through the export target: a linked campaign folder fails every ad', async () => {
    const t = await setup()
    const outside = fs.mkdtempSync(path.join(t.fx.root, 'outside-'))
    fs.symlinkSync(outside, path.join(t.root, t.campaignId))
    const end = await t.run()
    expect(end.result).toEqual({ exported: 0, failed: 4, reportId: 'R1' })
    const failures = t.reportOutcomes().map((o) => o.failure)
    expect(failures).toEqual(Array(4).fill(AD_FAILURES.notWritten))
    expect(fs.readdirSync(outside)).toEqual([])
  })
})

describe("the export job with the core's own report port [P8-6, P8-9]", () => {
  it('ends with the ID of the report it saved', async () => {
    const t = await setup()
    t.useCoreReport()
    const end = await t.run()
    expect(end.result).toEqual({
      exported: 4,
      failed: 0,
      reportId: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
    })
  })
})
