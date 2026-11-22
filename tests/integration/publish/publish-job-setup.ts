// P9-10 test helper for the publish job: the publish set-up with a background, an image, a
// flagged font and an MP4 clip with no movie box (videoFileFacts gives nothing, so it is
// skipped), the fake export port, and ways to read the job's hidden columns and the work
// folder. Not a test file.
import fs from 'node:fs'
import path from 'node:path'
import type { StorageProvider } from '@/main/providers/types'
import { WORK_FOLDER } from '@/main/publish/work-folder'
import type { JobRow } from '@/shared/schemas/rows/job'
import { fakePublishExport, type FakeExport } from '../../helpers/fake-publish-export'
import { data } from '../core-fixture'
import { BYTES } from './component-project'
import { id } from './inspect-setup'
import { publishSetUp, type PublishSetUp } from './publish-setup'

export const BG = id(1)
export const FONT = id(2)
export const IMG = id(3)
export const CLIP = id(4)

export type JobSetUp = PublishSetUp & {
  fake: FakeExport
  assetFiles: Record<string, string>
  publish(input?: object): Promise<JobRow>
  hidden(jobId: string): { error_detail: string | null; error_reason: string | null }
  workChildren(): string[]
}

export async function jobSetUp(opts: { storage?: StorageProvider } = {}): Promise<JobSetUp> {
  const assetFiles: Record<string, string> = {}
  const x = await publishSetUp((p) => {
    assetFiles[BG] = p.asset({ id: BG, file: 'bg.png', displayName: 'Beach' })
    assetFiles[IMG] = p.asset({ id: IMG, file: 'img.png', displayName: 'Bottle' })
    assetFiles[FONT] = p.asset({
      id: FONT,
      file: 'f.ttf',
      bytes: BYTES.ttf,
      kind: 'font',
      fontPublishAllowed: true,
      displayName: 'Open Sans',
    })
    assetFiles[CLIP] = p.asset({ id: CLIP, file: 'wave.mp4', bytes: BYTES.mp4, kind: 'video' })
    p.layer('vaaaaa', { background: BG })
    p.layer('vbbbbb', { image: IMG })
    p.layer('vaaaaa', { font: FONT })
    p.clip('vaaaaa', CLIP)
  }, opts)
  const fake = fakePublishExport()
  x.fx.core.deps.publish.exportForPublish = fake.port
  const s: JobSetUp = {
    ...x,
    fake,
    assetFiles,
    async publish(input = {}) {
      const { jobId } = data<{ jobId: string }>(await x.run({ replaceConfirmed: true, ...input }))
      return x.ended(jobId)
    },
    hidden(jobId) {
      const db = x.fx.core.deps.projects.get(x.projectId)?.db
      const row = db
        ?.prepare('SELECT error_detail, error_reason FROM job WHERE id = ?')
        .get(jobId) as { error_detail: string | null; error_reason: string | null }
      return row
    },
    workChildren() {
      const dir = path.join(x.fx.userData, WORK_FOLDER)
      return fs.existsSync(dir) ? fs.readdirSync(dir) : []
    },
  }
  return s
}
