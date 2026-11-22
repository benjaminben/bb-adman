// P4-12 (spec/screens-ai.md, "The paid count"; FR-230): the campaign overview shows the paid
// count under the campaign name; a variant's tab does not.
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import '../../../shared/scene/fake-fonts'
import { CampaignView } from '@/renderer/screens/campaign/campaign-view'
import { P, campaignApi, renderWith } from './campaign-fixture'

const LINE = 'Paid generations for this campaign so far: 3 pictures, 0 videos. Text requests: 2.'

function withCount() {
  const fake = campaignApi()
  fake.onQuery('campaign.paidCount', () => ({
    ok: true,
    data: { pictures: 3, videos: 0, text: 2 },
  }))
  return fake
}

describe('CampaignView paid count [P4-12, FR-230]', () => {
  it("draws the campaign's paid count on the overview, under the name", async () => {
    const { fake } = await renderWith(
      <CampaignView projectId={P} campaignId="C1" onBack={() => {}} />,
      withCount(),
    )
    const name = await screen.findByRole('heading', { name: 'Summer Splash' })
    const line = await screen.findByText(LINE)
    expect(name.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(fake.queries.find((q) => q.name === 'campaign.paidCount')?.input).toEqual({
      projectId: P,
      campaignId: 'C1',
    })
  })

  it("is not drawn on a variant's tab", async () => {
    await renderWith(<CampaignView projectId={P} campaignId="C1" onBack={() => {}} />, withCount())
    await screen.findByText(LINE)
    await userEvent.dblClick(await screen.findByRole('button', { name: /^Master post/ }))
    await waitFor(() => expect(screen.queryByText(LINE)).toBeNull())
  })
})
