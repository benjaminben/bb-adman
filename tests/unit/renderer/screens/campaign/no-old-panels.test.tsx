// Design wave CAMP-7 (C-12): pictures and videos are made in the editor's Generate panel, so
// the campaign page's Variants tab holds the direction grids only: no "Make pictures" panel,
// no "Runs" list, no slot view and no selection line. Replaces no-video-card (R2E-9), which
// kept "Make pictures".
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../../shared/scene/fake-fonts'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { jobRow } from '../../stores/job-fixture'
import { P, renderWith } from './campaign-fixture'
import { videoApi } from './video-fixture'

async function open() {
  const fake = videoApi({ jobs: [jobRow('J1', { status: 'failed' })] })
  await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, fake)
  await screen.findByRole('button', { name: /^Master post/ })
  return fake
}

describe('the Variants tab without the old panels [CAMP-7]', () => {
  it('has no "Make pictures", "Make a video" or "Slots" region and no "Runs" list', async () => {
    await open()
    for (const name of ['Make pictures', 'Make a video', 'Slots']) {
      expect(screen.queryByRole('region', { name })).toBeNull()
    }
    expect(screen.queryByRole('list', { name: 'Runs' })).toBeNull()
    expect(screen.queryByText('No runs yet.')).toBeNull()
  })

  it('has no selection line, also once a tile is selected', async () => {
    await open()
    await userEvent.click(screen.getByRole('button', { name: /^German post/ }))
    expect(screen.queryByText(/Runs and panels below are for/)).toBeNull()
  })

  it('reads no job.list and no template.slots for the page', async () => {
    const fake = await open()
    const names = fake.queries.map((q) => q.name)
    expect(names).not.toContain('job.list')
    expect(names).not.toContain('template.slots')
  })
})
