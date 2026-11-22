// S2-5, FN-4 (spec/screens-campaign.md, "The confirm count on Retry"): the paid confirm line
// of Retry counts what job.retry will ask for, and a ComfyUI run asks for no confirm.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import type { JobRow } from '@/shared/schemas/rows/job'
import { baseState } from '../../fake-api'
import { jobRow } from '../../stores/job-fixture'
import { P, campaignApi, renderWith, sent } from './campaign-fixture'
import { COMFY, INFO, videoRow } from './video-fixture'

const KEPT = {
  assetIds: ['01JD000000000000000000AS01', '01JD000000000000000000AS02'],
  failures: {},
}
const REQUEST = { prompt: 'A can', referenceAssetIds: [], count: 4, width: 1080, height: 1080 }

async function runs(jobs: JobRow[], fake = campaignApi({ jobs })) {
  await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, fake)
  return { fake, list: within(await screen.findByRole('list', { name: 'Runs' })) }
}

describe('RunRow, the confirm count on Retry [FN-4]', () => {
  it.each([
    [
      'a cancelled picture row with two kept pictures asks for the rest',
      jobRow('J1', { status: 'cancelled', request: REQUEST, result: KEPT }),
      'This sends 2 paid request(s) to Google Gemini.',
    ],
    [
      // A video row's stored request is read as it is; kept asset IDs do not lower it.
      'a video row keeps the stored count',
      videoRow({
        status: 'failed',
        provider: 'gemini',
        request: { ...(videoRow().request as object), count: 4 },
        result: KEPT,
      }),
      'This sends 1 paid request(s) to Google Gemini.',
    ],
  ])('%s', async (_name, row, line) => {
    const { list } = await runs([row])
    await userEvent.click(list.getByRole('button', { name: 'Retry' }))
    expect(list.getByText(line)).toBeInTheDocument()
  })

  it('sends job.retry for a failed ComfyUI row with no confirm line', async () => {
    const row = jobRow('J1', { status: 'failed', provider: 'comfyui', errorReason: 'run_failed' })
    const fake = campaignApi({
      jobs: [row],
      state: { providers: [...baseState().providers, COMFY] },
    })
    fake.onQuery('comfy.getInfo', () => ({ ok: true, data: INFO }))
    const { list } = await runs([row], fake)
    await userEvent.click(list.getByRole('button', { name: 'Retry' }))
    expect(list.queryByText(/paid request/)).toBeNull()
    expect(sent(fake, 'job.retry').map((c) => c.input)).toEqual([{ projectId: P, jobId: 'J1' }])
  })
})
