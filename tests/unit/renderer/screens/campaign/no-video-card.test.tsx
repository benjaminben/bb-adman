// R2E-9 (spec/phases/round-2-editor.md): videos are made from the editor's Generate panel, so
// the campaign overview has no "Make a video" card. "Make pictures" and the runs stay.
import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import '../../../shared/scene/fake-fonts'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { P, renderWith } from './campaign-fixture'
import { videoApi } from './video-fixture'

describe('the campaign overview without the video card [R2E-9]', () => {
  it('has no "Make a video" region, and keeps "Make pictures"', async () => {
    await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, videoApi())
    expect(await screen.findByRole('region', { name: 'Make pictures' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Make a video' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Make a video' })).toBeNull()
  })
})
