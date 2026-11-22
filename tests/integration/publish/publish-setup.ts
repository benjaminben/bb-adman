// P9-10 test helper: the inspect set-up (a component project open in a core, local storage on a
// temporary folder through storageFor) with publish.run, the job rows and the ports a test
// replaces. The fake provider is listed, so `fake` is a ready storage. Nothing reaches a bucket
// or Dropbox. Not a test file.
import fs from 'node:fs'
import path from 'node:path'
import { vi } from 'vitest'
import { readWireRows } from '@/main/db/rows'
import type { PublishWarning } from '@/main/publish/ports'
import type { StorageProvider } from '@/main/providers/types'
import type { JobRow } from '@/shared/schemas/rows/job'
import { CAMPAIGN, makeComponentProject } from './component-project'
import { inspectSetUp, type InspectSetUp } from './inspect-setup'

export const FAKE = { ADMAN_FAKE_PROVIDERS: '1' }
const ENDED = new Set(['succeeded', 'failed', 'cancelled'])

export type PublishSetUp = InspectSetUp & {
  // What warningsForPublish answers; a test may change it.
  warnings: PublishWarning[]
  run(input?: object, actor?: 'user' | 'agent'): ReturnType<InspectSetUp['fx']['user']>
  jobs(): JobRow[]
  ended(jobId: string): Promise<JobRow>
  plant(rel: string, body: string | Buffer): void
  storageFiles(): Record<string, string>
}

export const runInput = {
  campaignId: CAMPAIGN,
  storage: 'fake',
  replaceConfirmed: false,
  proceedDespiteWarnings: false,
}

function listed(dir: string, base = ''): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const rel = base ? `${base}/${e.name}` : e.name
    return e.isDirectory() ? listed(path.join(dir, e.name), rel) : [rel]
  })
}

export async function publishSetUp(
  build: (p: ReturnType<typeof makeComponentProject>) => void = () => undefined,
  opts: { env?: Record<string, string>; storage?: StorageProvider } = {},
): Promise<PublishSetUp> {
  const x = await inspectSetUp(build, { env: FAKE, ...opts })
  const db = () => x.fx.core.deps.projects.get(x.projectId)?.db
  const s: PublishSetUp = {
    ...x,
    warnings: [],
    run: (input = {}, actor = 'user') =>
      x.fx.core.bus.execute(
        'publish.run',
        { projectId: x.projectId, ...runInput, ...input },
        { actor },
      ),
    jobs: () => {
      const handle = db()
      return handle ? (readWireRows(handle, 'job') as JobRow[]) : []
    },
    async ended(jobId) {
      return vi.waitFor(
        () => {
          const job = s.jobs().find((j) => j.id === jobId)
          if (!job || !ENDED.has(job.status)) throw new Error('not ended yet')
          return job
        },
        { timeout: 10_000, interval: 10 },
      )
    },
    plant(rel, body) {
      const file = path.join(x.storageRoot, ...rel.split('/'))
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, body)
    },
    storageFiles() {
      return Object.fromEntries(
        listed(x.storageRoot).map((rel) => [
          rel,
          fs.readFileSync(path.join(x.storageRoot, rel)).toString('base64'),
        ]),
      )
    },
  }
  x.fx.core.deps.publish.warningsForPublish = async () => s.warnings
  return s
}
