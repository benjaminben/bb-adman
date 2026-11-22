// P9-10, the named test (spec/phases/phase-09.md "Publishing", clean-up, A-219): every path a
// publish lists, reads, writes or deletes starts with {campaignId}/. Local storage in a temporary
// folder holds another campaign's folder, a {campaignId}x/ folder and a root file; two
// publishes run; the files outside stay byte for byte, and the second publish removes the
// files of the first that it no longer has.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import {
  recordedPaths,
  recordingStorage,
  type RecordingStorage,
} from '../../helpers/recording-storage'
import { PNG } from '../../helpers/fake-publish-export'
import { CAMPAIGN } from './component-project'
import { jobSetUp, type JobSetUp } from './publish-job-setup'

let s: JobSetUp | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
})

const OUTSIDE = {
  'other-camp-zz2345/report.html': 'another campaign',
  'other-camp-zz2345/exports/Summer/1080x1080/en-vaaaaa.png': 'another ad',
  [`${CAMPAIGN}x/report.html`]: 'a neighbour folder',
  [`${CAMPAIGN}x/manifest.json`]: '{"format":1}',
  'root.txt': 'a file at the root',
}

describe('campaign folder isolation [P9-10, A-219]', () => {
  it('lists, writes and removes only under {campaignId}/ across two publishes', async () => {
    s = await jobSetUp()
    const x = s
    for (const [rel, body] of Object.entries(OUTSIDE)) x.plant(rel, body)
    const before = x.storageFiles()
    const recording: RecordingStorage = recordingStorage(localStorageAt(x.storageRoot))
    x.fx.core.deps.publish.storageFor = () => recording

    // The first publish has one more ad than the second.
    x.fake.change = (files, root) => {
      const extra = path.join(root, 'Autumn', '1080x1080', 'en-vccccc.png')
      fs.mkdirSync(path.dirname(extra), { recursive: true })
      fs.writeFileSync(extra, PNG)
      return [...files, { role: 'ad', relPath: 'Autumn/1080x1080/en-vccccc.png', absPath: extra }]
    }
    expect((await x.publish()).status).toBe('succeeded')
    const stale = `${CAMPAIGN}/exports/Autumn/1080x1080/en-vccccc.png`
    expect(Object.keys(x.storageFiles())).toContain(stale)

    x.fake.change = (files) => files
    const second = await x.publish()
    expect(second).toMatchObject({ status: 'succeeded', result: { publishNumber: 2, removed: 1 } })
    expect(Object.keys(x.storageFiles())).not.toContain(stale)

    const paths = recordedPaths(recording)
    expect(paths.length).toBeGreaterThan(0)
    for (const p of paths) expect(p.startsWith(`${CAMPAIGN}/`)).toBe(true)
    expect(recording.calls.filter((c) => c.op === 'remove')).toEqual([
      { op: 'remove', paths: [stale] },
    ])
    const after = x.storageFiles()
    for (const rel of Object.keys(OUTSIDE)) expect(after[rel]).toBe(before[rel])
  })
})
