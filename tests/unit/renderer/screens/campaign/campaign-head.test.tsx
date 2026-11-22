// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the campaign page's head as its
// own component, showing what it showed inside the page: "Back to project", the campaign's
// name, the approval bar, "Export…", "Reports" and "Publish…".
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useApi } from '@/renderer/app/app-context'
import { CampaignHead } from '@/renderer/screens/campaign/campaign-head'
import { createApprovalsStore } from '@/renderer/stores/approvals-store'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { axeViolations } from '../../render'
import { MASTER, P, SECOND, campaignGet, renderWith } from './campaign-fixture'

function Head(props: { data: CampaignGet | null; onBack: () => void }) {
  const api = useApi()
  const [approvals] = useState(() => createApprovalsStore(api, P, 'C1'))
  return (
    <main>
      <CampaignHead
        projectId={P}
        campaignId="C1"
        data={props.data}
        approvals={approvals}
        onBack={props.onBack}
      />
    </main>
  )
}

const draw = (data: CampaignGet | null = campaignGet([MASTER, SECOND]), onBack = () => {}) =>
  renderWith(<Head data={data} onBack={onBack} />)

describe('CampaignHead [R2C-1]', () => {
  it('goes back to the project', async () => {
    const onBack = vi.fn()
    await draw(undefined, onBack)
    await userEvent.click(screen.getByRole('button', { name: 'Back to project' }))
    expect(onBack).toHaveBeenCalledOnce()
  })

  it("shows the campaign's name, Export…, Reports and Publish…", async () => {
    await draw()
    expect(screen.getByRole('heading', { name: 'Summer Splash', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export…' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Publish…' })).toBeInTheDocument()
  })

  it('shows back and Export… but no name or Publish… before campaign.get answers', async () => {
    await draw(null)
    expect(screen.getByRole('button', { name: 'Back to project' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export…' })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Publish…' })).toBeNull()
  })

  it('has no accessibility violations', async () => {
    await draw()
    expect(await axeViolations()).toEqual([])
  })
})
