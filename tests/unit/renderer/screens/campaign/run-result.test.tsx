// SPEC 14 1.41 TP-2 "Results": one picture per asset ID through adman-asset://, and
// job.markSeen sent once when a succeeded run's results are first drawn.
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '../../../../../src/renderer/screens/campaign/campaign-view'
import { jobRow } from '../../stores/job-fixture'
import { P, campaignApi, renderWith, sent } from './campaign-fixture'

const A1 = '01JD00000000000000000000A1'
const A2 = '01JD00000000000000000000A2'

const succeeded = (over = {}) =>
  jobRow('J1', { status: 'succeeded', result: { assetIds: [A1, A2], failures: {} }, ...over })

async function results(fake: ReturnType<typeof campaignApi>) {
  await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, fake)
  return within(await screen.findByRole('list', { name: 'Runs' }))
}

describe('RunResult [SPEC 14 1.41 TP-2]', () => {
  it('draws one picture per asset ID with its adman-asset address', async () => {
    const list = await results(campaignApi({ jobs: [succeeded()] }))
    const images = list.getAllByRole('img')
    expect(images.map((i) => i.getAttribute('src'))).toEqual([
      `adman-asset://${P}/${A1}`,
      `adman-asset://${P}/${A2}`,
    ])
    expect(images.map((i) => i.getAttribute('alt'))).toEqual(['Result 1', 'Result 2'])
  })

  it('sends job.markSeen once for the job, even when its row changes again', async () => {
    const fake = campaignApi({ jobs: [succeeded()] })
    await results(fake)
    await waitFor(() => expect(sent(fake, 'job.markSeen')).toHaveLength(1))
    fake.emit('job.updated', succeeded({ updatedAt: '2026-11-21T03:00:00.000Z' }))
    await screen.findAllByRole('img')
    expect(sent(fake, 'job.markSeen').map((c) => c.input)).toEqual([
      { projectId: P, jobIds: ['J1'] },
    ])
  })

  it('sends no job.markSeen for a job already looked at', async () => {
    const fake = campaignApi({ jobs: [succeeded({ seenAt: '2026-11-21T01:00:00.000Z' })] })
    await results(fake)
    await screen.findAllByRole('img')
    expect(sent(fake, 'job.markSeen')).toEqual([])
  })

  it('draws no picture and says so when the result does not fit', async () => {
    const list = await results(campaignApi({ jobs: [succeeded({ result: { assetIds: 7 } })] }))
    expect(list.queryAllByRole('img')).toEqual([])
    expect(list.getByText('No pictures.')).toBeInTheDocument()
  })
})
