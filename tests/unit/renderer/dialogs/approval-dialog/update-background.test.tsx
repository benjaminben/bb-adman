// D-110 (spec/approvals.md "An update in the background"): the dialog can be closed while
// "Update gallery" runs, every button that sends stays disabled, a dialog drawn again shows the
// bar at its latest value, and a failure that came while it was closed is in its alert.
import { describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AppProvider } from '@/renderer/app/app-context'
import { ApprovalDialog } from '@/renderer/dialogs/approval-dialog'
import { updateKey } from '@/renderer/stores/gallery-updates'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { C, P, TITLES, forCampaign } from '../../stores/approvals-fixture'

const ids = { projectId: P, campaignId: C }
const button = (name: string) => screen.getByRole('button', { name })
const FAILED = 'The approvals service could not be reached.'

async function updating(data: ApprovalsForCampaign = forCampaign()) {
  const fake = makeFakeApi()
  let finish: (r: Result<unknown>) => void = () => undefined
  fake.onCommand('approvals.publish', () => new Promise((resolve) => (finish = resolve)))
  fake.onCommand('approvals.createLink', () => ({ ok: true, data: {} }))
  const onClose = vi.fn()
  const user = userEvent.setup()
  const dialog = (shown: boolean) => (
    <AppProvider api={fake.api} store={view.store}>
      {shown && <ApprovalDialog {...ids} open onClose={onClose} data={data} titles={TITLES} />}
    </AppProvider>
  )
  const view = await renderApp(
    <ApprovalDialog {...ids} open onClose={onClose} data={data} titles={TITLES} />,
    fake,
  )
  const show = (shown: boolean) => view.rerender(dialog(shown))
  return {
    ...view,
    fake,
    user,
    onClose,
    show,
    finish: (r: Result<unknown>) => act(() => finish(r)),
  }
}

describe('the dialog while "Update gallery" runs [D-110]', () => {
  it('can be closed, and keeps every button that sends disabled', async () => {
    const { user, onClose } = await updating()
    await user.click(button('Update gallery'))
    expect(button('Update gallery')).toBeDisabled()
    expect(button('Turn off link…')).toBeDisabled()
    expect(screen.queryByText('Working…')).toBeNull()
    expect(button('Close')).toBeEnabled()
    await user.click(button('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows the bar at its latest value when drawn again', async () => {
    const { user, fake, show } = await updating()
    await user.click(button('Update gallery'))
    show(false)
    const counts = { step: 'making', done: 0, total: 1, unitsDone: 1, unitsTotal: 2 } as const
    act(() => fake.emit('approvals.progress', { ...ids, ...counts }))
    show(true)
    expect(screen.getByText('Making video 1 of 1…')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(button('Update gallery')).toBeDisabled()
  })

  it('shows a failure that came while it was closed, until another command is sent', async () => {
    const { user, show, finish, store } = await updating()
    await user.click(button('Update gallery'))
    show(false)
    await finish({ ok: false, error: { code: 'PROVIDER_ERROR', message: FAILED } })
    expect(store.getState().error).toBe(FAILED)
    show(true)
    expect(screen.getByRole('alert')).toHaveTextContent(FAILED)
    expect(button('Update gallery')).toBeEnabled()
    await user.click(button('Update gallery'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('sends the publish step of "Make link" through the same owner', async () => {
    const { user, store } = await updating(forCampaign({ link: null }))
    await user.click(button('Make link'))
    await vi.waitFor(() => expect(store.getState().updates[updateKey(P, C)]?.running).toBe(true))
  })
})
