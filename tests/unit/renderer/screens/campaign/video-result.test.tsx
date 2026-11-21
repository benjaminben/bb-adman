// SPEC 14 1.57 TP-6 "The result": a succeeded video run shows <video controls
// preload="metadata"> with its adman-asset address, no autoplay, and sound as the clip has it.
import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import type { JobRow } from '@/shared/schemas/rows/job'
import { P, renderWith, sent } from './campaign-fixture'
import { A9, CLIP, videoApi, videoRow } from './video-fixture'

async function results(jobs: JobRow[]) {
  const fake = videoApi({ jobs })
  const { container } = await renderWith(
    <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />,
    fake,
  )
  const list = await screen.findByRole('list', { name: 'Runs' })
  return { fake, container, list }
}

const done = (over: Partial<JobRow> = {}) =>
  videoRow({ status: 'succeeded', result: CLIP, ...over })

describe('RunResult, a video run [SPEC 14 1.57 TP-6]', () => {
  it('shows one video with controls, its adman-asset address and no autoplay', async () => {
    const { list } = await results([done()])
    await waitFor(() => expect(list.querySelectorAll('video')).toHaveLength(1))
    const video = list.querySelector('video')!
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('preload', 'metadata')
    expect(video).toHaveAttribute('src', `adman-asset://${P}/${A9}`)
    expect(video).not.toHaveAttribute('autoplay')
    expect(video).not.toHaveAttribute('muted')
    expect(video.autoplay).toBe(false)
    expect(video.muted).toBe(false)
  })

  it('gives the clip a name and shows no picture', async () => {
    const { list } = await results([done()])
    const video = await within(list).findByLabelText('Video result')
    expect(video.tagName).toBe('VIDEO')
    expect(within(list).queryAllByRole('img')).toEqual([])
  })

  it('sends job.markSeen once for the job when the clip is first drawn', async () => {
    const { fake } = await results([done()])
    await waitFor(() => expect(sent(fake, 'job.markSeen')).toHaveLength(1))
    expect(sent(fake, 'job.markSeen')[0]?.input).toEqual({ projectId: P, jobIds: ['J1'] })
  })

  it('shows no video and says so when the result does not fit', async () => {
    const { list } = await results([done({ result: { assetIds: [A9] } })])
    expect(await within(list).findByText('No clip.')).toBeInTheDocument()
    expect(list.querySelector('video')).toBeNull()
  })
})
