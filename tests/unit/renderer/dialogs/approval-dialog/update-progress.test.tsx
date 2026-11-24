// R2V-7 (spec/phases/round-2-approvals-video.md "The dialog"): while "Update gallery" runs, the
// waiting line follows approvals.progress for this campaign only, and "Stop" sends
// approvals.cancelUpdate once, then reads "Stopping…".
import { describe, expect, it } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApprovalDialog } from '@/renderer/dialogs/approval-dialog'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { C, P, TITLES, VARIANTS, forCampaign } from '../../stores/approvals-fixture'

const ids = { projectId: P, campaignId: C }

async function updating() {
  const fake = makeFakeApi()
  let finish: (r: Result<unknown>) => void = () => undefined
  fake.onCommand('approvals.publish', () => new Promise((resolve) => (finish = resolve)))
  fake.onCommand('approvals.cancelUpdate', () => ({ ok: true, data: { stopped: true } }))
  const user = userEvent.setup()
  await renderApp(
    <ApprovalDialog {...ids} open onClose={() => undefined} data={forCampaign()} titles={TITLES} />,
    fake,
  )
  await user.click(screen.getByRole('button', { name: 'Update gallery' }))
  const progress = (step: 'making' | 'sending', done: number, total: number, campaignId = C) =>
    act(() =>
      fake.emit('approvals.progress', {
        projectId: P,
        campaignId,
        step,
        done,
        total,
        unitsDone: 0,
        unitsTotal: 0,
      }),
    )
  return { fake, user, progress, finish: (r: Result<unknown>) => act(() => finish(r)) }
}

describe('the waiting line of "Update gallery" [R2V-7]', () => {
  it('follows the progress of this campaign and ignores another campaign', async () => {
    const { progress } = await updating()
    expect(screen.getByText('Updating the gallery…')).toBeInTheDocument()
    progress('making', 0, 2)
    expect(screen.getByText('Making video 1 of 2…')).toBeInTheDocument()
    progress('sending', 1, 2)
    expect(screen.getByText('Sending video 2 of 2…')).toBeInTheDocument()
    progress('making', 0, 5, 'another-campaign')
    expect(screen.getByText('Sending video 2 of 2…')).toBeInTheDocument()
    progress('making', 0, 5, C)
    expect(screen.getByText('Making video 1 of 5…')).toBeInTheDocument()
  })

  it('sends approvals.cancelUpdate on "Stop", then disables it and reads "Stopping…"', async () => {
    const { fake, user, progress, finish } = await updating()
    progress('making', 0, 1)
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByText('Stopping…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeDisabled()
    progress('sending', 0, 1)
    expect(screen.getByText('Stopping…')).toBeInTheDocument()
    expect(fake.commands.map((c) => [c.name, c.input])).toEqual([
      ['approvals.publish', ids],
      ['approvals.cancelUpdate', ids],
    ])
    await finish({ ok: true, data: { variants: 3, drawn: 1, clips: 0 } })
    expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull()
    expect(screen.queryByText('Stopping…')).toBeNull()
  })

  it('starts the next update with the plain line again', async () => {
    const { user, progress, finish } = await updating()
    progress('making', 0, 1)
    await finish({ ok: true, data: { variants: 3, drawn: 1, clips: 1 } })
    await user.click(screen.getByRole('button', { name: 'Update gallery' }))
    expect(screen.getByText('Updating the gallery…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stop' })).toBeEnabled()
  })
})

describe('the still-only lines under "Gallery" [R2V-7]', () => {
  it('names each variant the gallery shows as a still only, with its reason', async () => {
    const [v1, v2, v3] = VARIANTS
    const data = forCampaign({
      variants: [
        { ...v1!, stillOnly: 'no_tool' },
        { ...v2!, stillOnly: 'too_long' },
        { ...v3!, stillOnly: 'too_large' },
      ],
    })
    await renderApp(
      <ApprovalDialog {...ids} open onClose={() => undefined} data={data} titles={TITLES} />,
      makeFakeApi(),
    )
    const gallery = screen.getByRole('region', { name: 'Gallery' })
    expect(gallery).toHaveTextContent(
      'Square post: sent as a still picture. This copy of Adman cannot make videos, because ' +
        'FFmpeg is missing.',
    )
    expect(gallery).toHaveTextContent(
      'Story: sent as a still picture. Videos longer than 3 minutes are not sent.',
    )
    expect(gallery).toHaveTextContent(
      'Wide banner: sent as a still picture. Its video is larger than 384 MB.',
    )
    expect(await axeViolations()).toEqual([])
  })

  it('shows no line when every variant is sent whole', async () => {
    await renderApp(
      <ApprovalDialog
        {...ids}
        open
        onClose={() => undefined}
        data={forCampaign()}
        titles={TITLES}
      />,
      makeFakeApi(),
    )
    expect(screen.getByRole('region', { name: 'Gallery' })).not.toHaveTextContent('still picture')
  })
})
