// P9-11, review fix 1 (spec/phases/phase-09.md "Publishing"; A-219): Dropbox lists a folder in
// its display spelling, so a campaign folder shown as CAMPAIGN-ID/ holds this campaign's files.
// publish.run and the job count them, so the replace confirmation is not skipped. Local storage
// on a temporary folder whose list answers the folder in upper case; nothing leaves the machine.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import type { StorageProvider } from '@/main/providers/types'
import { data } from '../core-fixture'
import { CAMPAIGN } from './component-project'
import { jobSetUp, type JobSetUp } from './publish-job-setup'

let s: JobSetUp | undefined
let root: string | undefined
afterEach(() => {
  s?.cleanup()
  s = undefined
  if (root) fs.rmSync(root, { recursive: true, force: true })
})

// Local storage that lists {campaignId}/ as {CAMPAIGNID}/ once `shown` is true.
function displaySpelling(state: { shown: boolean }): StorageProvider {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-display-'))
  fs.mkdirSync(path.join(root, CAMPAIGN), { recursive: true })
  fs.writeFileSync(path.join(root, CAMPAIGN, 'report.html'), 'old report')
  const inner = localStorageAt(root)
  return {
    ...inner,
    async list(prefix) {
      const listed = await inner.list(prefix)
      if (!state.shown) return []
      return listed.map((p) => p.replace(CAMPAIGN, CAMPAIGN.toUpperCase()))
    },
  }
}

describe('a campaign folder in its display spelling [P9-11 review fix 1]', () => {
  it('publish.run counts its files and refuses replace_not_confirmed', async () => {
    s = await jobSetUp({ storage: displaySpelling({ shown: true }) })
    expect(await s.run()).toMatchObject({
      ok: false,
      error: { details: { reason: 'replace_not_confirmed' } },
    })
    expect(s.jobs()).toEqual([])
  })

  it('the job counts its files too, and ends without the confirmation', async () => {
    const state = { shown: false }
    s = await jobSetUp({ storage: displaySpelling(state) })
    const { jobId } = data<{ jobId: string }>(await s.run())
    state.shown = true
    const job = await s.ended(jobId)
    expect(job.status).toBe('failed')
    expect(s.hidden(jobId).error_detail).toBe('publish_replace_not_confirmed_failed')
    expect(s.fake.inputs).toEqual([])
  })
})
