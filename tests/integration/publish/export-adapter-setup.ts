// P9-11 test helper: a core over temporary folders with Phase 6's check project open (one
// campaign, an English and a German ad of one size), a stand-in draw and picture encoder in
// place of the render window, local storage on a temporary folder for the fake storage, and a
// work folder at its real path. The export adapter itself is the real one. Nothing reaches a
// provider, a bucket or Dropbox. Not a test file.
import fs from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import { createRenderService } from '@/main/thumbnails/service'
import type { DrawScene } from '@/main/thumbnails/types'
import type { ExportPictures } from '@/main/export/types'
import type { ExportForPublishInput } from '@/main/publish/ports'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { JobRow } from '@/shared/schemas/rows/job'
import { data, makeFixture, type Fixture } from '../core-fixture'
import { openCheckProject, type CheckProject } from '../checks/check-fixture'

export const PNG_START = [0x89, 0x50, 0x4e, 0x47]
const ENDED = new Set(['succeeded', 'failed', 'cancelled'])

export type AdapterSetUp = {
  fx: Fixture
  p: CheckProject
  work: string
  storageRoot: string
  draws: { fail: boolean }
  input(over?: Partial<ExportForPublishInput>): ExportForPublishInput
  publish(input?: object): Promise<JobRow>
  storageFiles(): string[]
  reportRows(): number
}

function listed(dir: string, base = ''): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name
    return e.isDirectory() ? listed(path.join(dir, e.name), rel) : [rel]
  })
}

export async function adapterSetUp(): Promise<AdapterSetUp> {
  const fx = makeFixture({ env: { ADMAN_FAKE_PROVIDERS: '1' } })
  const p = await openCheckProject(fx)
  const draws = { fail: false }
  const draw: DrawScene = async (_input, size) => {
    if (draws.fail) throw new Error('The draw failed')
    return { png: new Uint8Array([...PNG_START, size.width % 256]), overflow: {} }
  }
  fx.core.deps.render = createRenderService({
    deps: () => fx.core.deps,
    bus: () => fx.core.bus,
    emit: () => undefined,
    draw,
  })
  const pictures = {
    toJpeg: () => new Uint8Array([0xff, 0xd8, 0xff]),
    shrink: () => new Uint8Array([0xff, 0xd8, 0xff]),
    stitch: vi.fn(),
  } as unknown as ExportPictures
  fx.core.deps.exportPictures = pictures
  const work = fs.realpathSync(fs.mkdtempSync(path.join(fx.root, 'work-')))
  const storageRoot = path.join(fx.root, 'storage')
  fs.mkdirSync(storageRoot)
  const storage = localStorageAt(storageRoot)
  fx.core.deps.publish.storageFor = () => storage
  const db = () => fx.core.deps.projects.requireOpen(p.projectId).db
  return {
    fx,
    p,
    work,
    storageRoot,
    draws,
    input: (over = {}) => ({
      projectId: p.projectId,
      campaignId: p.campaignId,
      outputRoot: work,
      proceedDespiteWarnings: true,
      proceedReason: 'Signed off by the client',
      publishHeader: { publishedAt: '2026-11-21T09:30:00.000Z', publishNumber: 2 },
      signal: new AbortController().signal,
      onProgress: () => undefined,
      ...over,
    }),
    async publish(input = {}) {
      const reply = await fx.user('publish.run', {
        projectId: p.projectId,
        campaignId: p.campaignId,
        storage: 'fake',
        replaceConfirmed: true,
        proceedDespiteWarnings: true,
        ...input,
      })
      const { jobId } = data<{ jobId: string }>(reply)
      return vi.waitFor(
        () => {
          const job = readWireRow(db(), 'job', { id: jobId }) as JobRow
          if (!ENDED.has(job.status)) throw new Error('not ended yet')
          return job
        },
        { timeout: 10_000, interval: 10 },
      )
    },
    storageFiles: () => listed(storageRoot).sort(),
    reportRows: () => readWireRows(db(), 'report').length,
  }
}
