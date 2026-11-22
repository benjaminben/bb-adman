// P8-9 (spec/phases/phase-08.md "Report", saved; "The output folder", overwrite rule): the report
// port writes report-{stamp}.json and .html in {campaignId}/ through exportTarget, then saves the
// row with report.add. A report never replaces a file: a taken name moves both to -2 ... -99,
// and past that the report fails. Run through the port alone (P8-6 builds the job beside it).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { openCheckProject, type CheckProject } from '../checks/check-fixture'
import { createExportReport } from '@/main/export/report-port'
import type { ExportPlan, VariantOutcome } from '@/main/export/types'
import type { JobRunContext } from '@/main/jobs/types'
import { ProviderFailure } from '@/main/providers/types'
import { AD_FAILURES, REPORT_NOT_SAVED } from '@/shared/export/messages'
import { reportStamp } from '@/shared/export/output-paths'
import { fail, type Result } from '@/shared/schemas/result'

// A local time, so the stamp is the same on every machine.
const NOW = new Date(2026, 10, 21, 9, 30, 15)
const STAMP = reportStamp(NOW)

let f: Fixture | undefined
const folders: string[] = []
afterEach(() => {
  f?.cleanup()
  f = undefined
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true })
})

type Setup = { fx: Fixture; p: CheckProject; root: string; plan: ExportPlan }

async function setup(): Promise<Setup> {
  const fx = makeFixture()
  f = fx
  const p = await openCheckProject(fx)
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-report-')))
  folders.push(root)
  fs.mkdirSync(path.join(root, p.campaignId))
  const plan: ExportPlan = {
    projectId: p.projectId,
    campaignId: p.campaignId,
    root,
    variantIds: p.variantIds(),
    imageFormat: 'png',
    jpgQuality: 90,
    fps: 30,
    warningsSeen: [],
    proceeded: null,
  }
  return { fx, p, root, plan }
}

function jobContext(fx: Fixture, projectId: string, refuseAdd = false): JobRunContext {
  return {
    deps: fx.core.deps,
    projectId,
    signal: new AbortController().signal,
    call: (fn) => fn(),
    progress: () => undefined,
    cancelled: () => false,
    system: (command, input): Promise<Result<unknown>> =>
      refuseAdd && command === 'report.add'
        ? Promise.resolve(fail({ code: 'INTERNAL', message: 'Something went wrong.' }))
        : fx.core.bus.execute(command, input, { actor: 'user' }),
    onProgress: () => undefined,
    setRemoteJobId: () => undefined,
    keep: () => undefined,
  }
}

// The first ad exported with a picture, the second failed.
function outcomes(p: CheckProject): VariantOutcome[] {
  const [first, second] = p.variantIds()
  return [
    {
      variantId: first as string,
      rev: 1,
      file: `${p.campaignId}/Spring sale/1080x1080/en-${first}.png`,
      failure: null,
      picture: new Uint8Array([0xff, 0xd8, 0xff, 7, 7, 7]),
    },
    {
      variantId: second as string,
      rev: 1,
      file: null,
      failure: AD_FAILURES.notDrawn,
      picture: null,
    },
  ]
}

function write(s: Setup, refuseAdd = false) {
  const port = createExportReport(() => ({ ...s.fx.core.deps, now: () => NOW }))
  const target = { write: () => Promise.reject(new Error('unused')), exists: async () => false }
  return port.write(
    jobContext(s.fx, s.p.projectId, refuseAdd),
    s.plan,
    target,
    outcomes(s.p),
    new Map(),
  )
}

const inCampaign = (s: Setup, name: string) => path.join(s.root, s.p.campaignId, name)
const files = (s: Setup) => fs.readdirSync(path.join(s.root, s.p.campaignId)).sort()

describe('the report port writes both files, then the row [P8-9]', () => {
  it('writes report-{stamp}.json and .html, and the JSON is the row body', async () => {
    const s = await setup()
    const reportId = await write(s)
    expect(files(s)).toEqual([`report-${STAMP}.html`, `report-${STAMP}.json`])
    const row = s.p.db().prepare('SELECT * FROM report WHERE id = ?').get(reportId) as {
      output_dir: string
      body: string
    }
    expect(row.output_dir).toBe(s.root)
    const json = JSON.parse(fs.readFileSync(inCampaign(s, `report-${STAMP}.json`), 'utf8'))
    expect(json).toEqual(JSON.parse(row.body))
    expect(json).toMatchObject({
      campaignId: s.p.campaignId,
      createdAt: NOW.toISOString(),
      outputFolderName: path.basename(s.root),
      summary: { exported: 1, failed: 1 },
    })
  })

  it('puts each exported ad picture in the HTML, and no full folder path in either file', async () => {
    const s = await setup()
    await write(s)
    const html = fs.readFileSync(inCampaign(s, `report-${STAMP}.html`), 'utf8')
    const picture = Buffer.from([0xff, 0xd8, 0xff, 7, 7, 7]).toString('base64')
    expect(html).toContain(`data:image/jpeg;base64,${picture}`)
    expect(html).not.toContain(s.root)
    expect(fs.readFileSync(inCampaign(s, `report-${STAMP}.json`), 'utf8')).not.toContain(s.root)
  })
})

describe('a report never replaces a file [P8-9, A-193]', () => {
  it('moves both names to -2 when report-{stamp}.html is taken, and leaves the old file', async () => {
    const s = await setup()
    fs.writeFileSync(inCampaign(s, `report-${STAMP}.html`), 'an earlier report')
    await write(s)
    expect(files(s)).toEqual([
      `report-${STAMP}-2.html`,
      `report-${STAMP}-2.json`,
      `report-${STAMP}.html`,
    ])
    expect(fs.readFileSync(inCampaign(s, `report-${STAMP}.html`), 'utf8')).toBe('an earlier report')
  })

  it('moves both names on when only the .json is taken', async () => {
    const s = await setup()
    fs.writeFileSync(inCampaign(s, `report-${STAMP}.json`), '{}')
    await write(s)
    expect(files(s)).toContain(`report-${STAMP}-2.html`)
    expect(files(s)).not.toContain(`report-${STAMP}.html`)
  })

  it('fails on the 100th clash, writes nothing and saves no row', async () => {
    const s = await setup()
    fs.writeFileSync(inCampaign(s, `report-${STAMP}.html`), 'x')
    for (let n = 2; n <= 99; n += 1)
      fs.writeFileSync(inCampaign(s, `report-${STAMP}-${n}.json`), 'x')
    const before = files(s)
    const run = write(s)
    await expect(run).rejects.toBeInstanceOf(ProviderFailure)
    await expect(run).rejects.toMatchObject({
      error: { kind: 'other', detail: AD_FAILURES.notWritten },
    })
    expect(files(s)).toEqual(before)
    expect(s.p.db().prepare('SELECT COUNT(*) AS n FROM report').get()).toEqual({ n: 0 })
  })
})

describe('a report row that is not saved [P8-9]', () => {
  it('fails the job with its sentence, after the files are written', async () => {
    const s = await setup()
    const run = write(s, true)
    await expect(run).rejects.toBeInstanceOf(ProviderFailure)
    await expect(run).rejects.toMatchObject({ error: { kind: 'other', detail: REPORT_NOT_SAVED } })
    expect(files(s)).toEqual([`report-${STAMP}.html`, `report-${STAMP}.json`])
  })

  it('logs and replies nothing that holds the output folder', async () => {
    const s = await setup()
    await write(s)
    await write(s, true).catch(() => undefined)
    expect(s.fx.readLogs()).not.toContain(s.root)
    expect(JSON.stringify(s.fx.events)).not.toContain(s.root)
  })
})
