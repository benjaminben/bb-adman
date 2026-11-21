// spec/approvals.md "The campaign page", the approval bar: "Approval link…"; with a live link
// the signed-off count, "Checked {time}" or the last refresh's failure, and "Refresh"; with an
// ended link "Link turned off"; after a gone reply the gone sentence.
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApprovalBar } from '@/renderer/screens/campaign/approval-bar'
import { createApprovalsStore, type ApprovalsStoreState } from '@/renderer/stores/approvals-store'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import { timeText } from '@/renderer/ui/signoff-list'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { C, P, TITLES, endedLink, forCampaign, liveLink } from '../../stores/approvals-fixture'

const OFFLINE = 'The approvals service could not be reached. Check the address and your connection.'
const GONE = APPROVALS_REASON_MESSAGES.approval_link_gone
const CHECKED = `Checked ${timeText(liveLink().checkedAt ?? '')}`

async function showBar(state: Partial<ApprovalsStoreState>) {
  const fake = makeFakeApi()
  const store = createApprovalsStore(fake.api, P, C)
  store.setState(state)
  const view = await renderApp(
    <main>
      <ApprovalBar projectId={P} campaignId={C} store={store} titles={TITLES} />
    </main>,
    fake,
  )
  return { ...view, fake, bar: screen.getByRole('group', { name: 'Approval link' }) }
}

describe('approval bar [spec/approvals.md "The campaign page"]', () => {
  it.each([
    ['a live link', { data: forCampaign() }, ['Signed off: 1 of 2 variants', CHECKED], [GONE]],
    [
      'a failed refresh',
      { data: forCampaign(), failure: OFFLINE },
      ['Signed off: 1 of 2 variants', OFFLINE],
      [CHECKED],
    ],
    ['an ended link', { data: forCampaign({ link: endedLink() }) }, ['Link turned off'], [GONE]],
    [
      'a link found gone',
      { data: forCampaign({ link: endedLink() }), notice: GONE },
      [GONE],
      ['Link turned off', 'Signed off'],
    ],
    ['no link', { data: forCampaign({ link: null }) }, [], ['Signed off', 'Link turned off']],
  ])('with %s, draws its lines', async (_name, state, shown, hidden) => {
    const { bar } = await showBar(state)
    expect(screen.getByRole('button', { name: 'Approval link…' })).toBeEnabled()
    for (const line of shown) expect(bar).toHaveTextContent(line)
    for (const line of hidden) expect(bar).not.toHaveTextContent(line)
    const refresh = screen.queryByRole('button', { name: 'Refresh' })
    expect(refresh !== null).toBe(state.data.link?.state === 'live')
    expect(await axeViolations()).toEqual([])
  })

  it('sends approvals.refresh on "Refresh"', async () => {
    const { fake } = await showBar({ data: forCampaign() })
    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(fake.commands).toEqual([
      { name: 'approvals.refresh', input: { projectId: P, campaignId: C } },
    ])
  })

  it('draws "Refresh" disabled while a refresh runs', async () => {
    await showBar({ data: forCampaign(), refreshing: true })
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled()
  })

  it('opens the approval link dialog', async () => {
    await showBar({ data: forCampaign() })
    await userEvent.click(screen.getByRole('button', { name: 'Approval link…' }))
    expect(screen.getByRole('dialog', { name: 'Approval link' })).toBeInTheDocument()
  })

  it('keeps "Approval link…" disabled until the first read arrives', async () => {
    await showBar({ data: null })
    expect(screen.getByRole('button', { name: 'Approval link…' })).toBeDisabled()
  })
})
