// SPEC 14 1.43 T-4: the campaign list shows each campaign's number of variants.
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CampaignList } from '@/renderer/screens/project-home/campaign-list'
import { campaign } from './project-fixture'

describe('CampaignList [SPEC 14 1.43 T-4]', () => {
  it('shows "2" for a campaign with two variants', () => {
    const two = { ...campaign('summer-k3f9q2', 'Summer'), variantCount: 2 }
    render(<CampaignList campaigns={[two]} onOpen={() => {}} />)
    const row = within(screen.getByRole('list', { name: 'Campaigns' })).getByRole('listitem')
    expect(within(row).getByTitle('2 variants')).toBeInTheDocument()
  })
})
