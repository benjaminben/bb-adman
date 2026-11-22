// R2C-1 (spec/phases/round-2-campaign.md, design addition 1): the campaign page's head as its
// own component, showing what it showed inside the page: "Back to project", the campaign's
// name, the approval bar, "Export…", "Reports" and "Publish…".
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useApi } from '@/renderer/app/app-context'
import { CampaignHead } from '@/renderer/screens/campaign/campaign-head'
import { createApprovalsStore } from '@/renderer/stores/approvals-store'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import layout from '@/renderer/ui/layout.module.css'
import { axeViolations } from '../../render'
import { forCampaign } from '../../stores/approvals-fixture'
import { MASTER, P, SECOND, campaignApi, campaignGet, renderWith } from './campaign-fixture'

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
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Summer Splash' }))
    expect(screen.getByRole('menuitem', { name: 'Reports…' })).toBeInTheDocument()
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

// CAMP-3 (spec/phases/design-wave-screens-b.md, "CAMP-3"): one head row. Back is an icon,
// Publish… the one primary, Reports… in the More menu; the paid count is the head's mark on the
// campaign views; a refresh failure stays words on the page.
const OFFLINE = 'The approvals service could not be reached. Check the address and your connection.'

function Row(props: { failure?: string; paid?: boolean }) {
  const api = useApi()
  const [approvals] = useState(() => {
    const store = createApprovalsStore(api, P, 'C1')
    store.setState({ data: forCampaign(), failure: props.failure ?? null, start: () => () => {} })
    return store
  })
  return (
    <main>
      <CampaignHead
        projectId={P}
        campaignId="C1"
        data={campaignGet([MASTER, SECOND])}
        approvals={approvals}
        onBack={() => {}}
        paid={props.paid ?? true}
      />
    </main>
  )
}

function drawRow(props: { failure?: string; paid?: boolean } = {}) {
  const fake = campaignApi()
  fake.onQuery('campaign.paidCount', () => ({ ok: true, data: { pictures: 3, videos: 1, text: 0 } }))
  fake.onQuery('report.list', () => ({ ok: true, data: [] }))
  return renderWith(<Row {...props} />, fake)
}

describe('the campaign head row [CAMP-3]', () => {
  it('draws "Back to project" as an icon button with its name as the tip', async () => {
    await drawRow()
    const back = screen.getByRole('button', { name: 'Back to project' })
    expect(back).toHaveAttribute('title', 'Back to project')
    expect(back).toHaveTextContent('')
  })

  it('has Publish… as the only primary button', async () => {
    const { container } = await drawRow()
    const primaries = container.querySelectorAll(`button.${layout.primary}`)
    expect([...primaries].map((b) => b.textContent)).toEqual(['Publish…'])
  })

  it('opens the reports dialog from "Reports…" in the More menu, sending no command', async () => {
    const { fake } = await drawRow()
    expect(screen.queryByRole('button', { name: 'Reports' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'More actions for Summer Splash' }))
    await userEvent.click(screen.getByRole('menuitem', { name: 'Reports…' }))
    expect(screen.getByRole('dialog', { name: 'Reports' })).toBeInTheDocument()
    expect(fake.commands).toEqual([])
  })

  it('shows the paid count as its mark on the campaign views only', async () => {
    const shown = await drawRow()
    expect(await screen.findByText('Paid so far: 3 pictures, 1 video')).toBeInTheDocument()
    shown.unmount()
    const { fake } = await drawRow({ paid: false })
    await act(async () => {})
    expect(screen.queryByText(/^Paid so far/)).toBeNull()
    expect(fake.queries.some((q) => q.name === 'campaign.paidCount')).toBe(false)
  })

  it("keeps a refresh failure's words on the page", async () => {
    await drawRow({ failure: OFFLINE })
    expect(screen.getByText(OFFLINE)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument()
  })

  it('has no accessibility violations', async () => {
    await drawRow({ failure: OFFLINE })
    await screen.findByText('Paid so far: 3 pictures, 1 video')
    expect(await axeViolations()).toEqual([])
  })
})
