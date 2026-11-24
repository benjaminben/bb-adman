// D-110 (spec/approvals.md "An update in the background", the campaign page): while the
// campaign's "Update gallery" runs, the "Approvals" button shows the spinner in place of the
// link icon, and its name and tip are "Approvals: updating the gallery". It still opens the
// dialog. When the update ends it returns to its usual look.
import { describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import iconStyles from '@/renderer/ui/icon/icon.module.css'
import { ApprovalBar } from '@/renderer/screens/campaign/approval-bar'
import { createApprovalsStore } from '@/renderer/stores/approvals-store'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { C, P, TITLES, forCampaign } from '../../stores/approvals-fixture'

const UPDATING = 'Approvals: updating the gallery'

async function showBar() {
  const fake = makeFakeApi()
  let finish: (r: Result<unknown>) => void = () => undefined
  fake.onCommand('approvals.publish', () => new Promise((resolve) => (finish = resolve)))
  const store = createApprovalsStore(fake.api, P, C)
  store.setState({ data: forCampaign() })
  const view = await renderApp(
    <ApprovalBar projectId={P} campaignId={C} store={store} titles={TITLES} />,
    fake,
  )
  return { ...view, finish: (r: Result<unknown>) => act(() => finish(r)) }
}

describe('the "Approvals" button during an update [D-110]', () => {
  it('shows the spinner and says the gallery is updating, then returns to its usual look', async () => {
    const { store, finish } = await showBar()
    const usual = screen.getByRole('button', { name: /^Approval link…/ })
    expect(usual.querySelector(`.${iconStyles.spin}`)).toBeNull()
    act(() => void store.getState().updateGallery(P, C))
    const busy = screen.getByRole('button', { name: UPDATING })
    expect(busy).toHaveAttribute('title', UPDATING)
    expect(busy.querySelector(`.${iconStyles.spin}`)).not.toBeNull()
    const user = userEvent.setup()
    await user.click(busy)
    expect(screen.getByRole('dialog', { name: 'Approval link' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close' }))
    await finish({ ok: true, data: { variants: 2, drawn: 0, clips: 0 } })
    expect(screen.getByRole('button', { name: /^Approval link…/ })).not.toHaveAttribute(
      'title',
      UPDATING,
    )
  })

  it('ignores the update of another campaign', async () => {
    const { store } = await showBar()
    act(() => void store.getState().updateGallery(P, 'another-campaign'))
    expect(screen.queryByRole('button', { name: UPDATING })).toBeNull()
  })
})
