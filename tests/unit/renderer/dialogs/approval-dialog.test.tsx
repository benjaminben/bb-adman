// spec/approvals.md "The approval link dialog": each state, the commands each button sends,
// copy link and copy password, and the confirmation for turning a link off. The link password
// is read on the click and never drawn.
import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApprovalDialog } from '@/renderer/dialogs/approval-dialog'
import { APPROVALS_REASON_MESSAGES } from '@/shared/approvals/messages'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import type { Result } from '@/shared/schemas/result'
import { dateText, timeText } from '@/renderer/ui/signoff-list'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import {
  ADDRESS,
  C,
  P,
  TITLES,
  endedLink,
  forCampaign,
  liveLink,
} from '../stores/approvals-fixture'

const PASSWORD = 'q7rt-m4kp-z9wx-h2nb'
const ids = { projectId: P, campaignId: C }

async function openDialog(data: ApprovalsForCampaign = forCampaign()) {
  const fake = makeFakeApi()
  fake.onQuery('approvals.getPassword', () => ({ ok: true, data: { password: PASSWORD } }))
  const onClose = vi.fn()
  const user = userEvent.setup()
  const view = await renderApp(
    <ApprovalDialog {...ids} open onClose={onClose} data={data} titles={TITLES} />,
    fake,
  )
  const write = vi.spyOn(navigator.clipboard, 'writeText')
  const dialog = screen.getByRole('dialog', { name: 'Approval link' })
  return { ...view, fake, onClose, user, write, dialog }
}

const sent = (fake: ReturnType<typeof makeFakeApi>) => fake.commands.map((c) => [c.name, c.input])
const button = (name: string) => screen.getByRole('button', { name })

describe('approval dialog, not ready and no link [spec/approvals.md "The approval link dialog"]', () => {
  it.each([
    ['no_service', 'Set up the approvals service in Settings to make links.'],
    ['no_bucket', APPROVALS_REASON_MESSAGES.approvals_needs_bucket],
  ] as const)('%s: says what is missing and opens Settings', async (ready, line) => {
    const { dialog, user, store, onClose, fake } = await openDialog(forCampaign({ ready }))
    expect(dialog).toHaveTextContent(line)
    expect(await axeViolations()).toEqual([])
    await user.click(button('Open Settings'))
    expect(store.getState().view).toEqual({ kind: 'settings' })
    expect(onClose).toHaveBeenCalled()
    expect(fake.commands).toEqual([])
  })

  it('with no link, "Make link" sends createLink with a made password, then publish', async () => {
    const { dialog, user, fake } = await openDialog(forCampaign({ link: null }))
    expect(dialog).toHaveTextContent(
      "Make a link that shows this campaign's variants to reviewers. They need the link and the " +
        'password. Anyone who has both can sign off on a variant with their email address, or ' +
        'remove a sign-off.',
    )
    expect(screen.getByRole('radio', { name: 'Make a password for me' })).toBeChecked()
    expect(await axeViolations()).toEqual([])
    await user.click(button('Make link'))
    expect(sent(fake)).toEqual([
      ['approvals.createLink', ids],
      ['approvals.publish', ids],
    ])
  })

  it('keeps "Make link" disabled for a chosen password under 12 characters', async () => {
    const { user, fake } = await openDialog(forCampaign({ link: null }))
    await user.click(screen.getByRole('radio', { name: 'Choose a password' }))
    const field = screen.getByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')
    expect(field).toHaveAccessibleDescription('At least 12 characters.')
    await user.type(field, 'short-11chr')
    expect(button('Make link')).toBeDisabled()
    await user.type(field, 'x')
    await user.click(button('Make link'))
    expect(sent(fake)[0]).toEqual(['approvals.createLink', { ...ids, password: 'short-11chrx' }])
  })

  it('sends nothing on Escape or Cancel', async () => {
    const { user, fake, onClose } = await openDialog(forCampaign({ link: null }))
    await user.keyboard('{Escape}')
    await user.click(button('Cancel'))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(fake.commands).toEqual([])
  })

  it('shows a refusal by its sentence', async () => {
    const { user, fake, dialog } = await openDialog(forCampaign({ link: null }))
    const message = APPROVALS_REASON_MESSAGES.approvals_needs_bucket
    fake.onCommand('approvals.createLink', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'approvals_needs_bucket' } },
    }))
    await user.click(button('Make link'))
    expect(screen.getByRole('alert')).toHaveTextContent(message)
    expect(dialog).toBeInTheDocument()
    expect(sent(fake).map(([name]) => name)).toEqual(['approvals.createLink'])
  })
})

describe('approval dialog, a live link [spec/approvals.md "The approval link dialog"]', () => {
  it('shows the link, the gallery lines, the sign-offs by variant and the delete line', async () => {
    const { dialog } = await openDialog()
    expect(screen.getByRole('textbox', { name: 'Link' })).toHaveValue(ADDRESS)
    expect(screen.getByRole('textbox', { name: 'Link' })).toHaveAttribute('readonly')
    expect(dialog).toHaveTextContent(`Updated ${timeText(liveLink().publishedAt ?? '')}.`)
    expect(dialog).toHaveTextContent('2 variants changed since.')
    expect(screen.getByRole('list', { name: 'Sign-offs for Square post' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent('If you delete this campaign, turn its link off first.')
    expect(await axeViolations()).toEqual([])
  })

  it('copies the link on click', async () => {
    const { user, write } = await openDialog()
    await user.click(button('Copy link'))
    expect(write).toHaveBeenCalledWith(ADDRESS)
    expect(screen.getByRole('status')).toHaveTextContent('Copied.')
  })

  it('reads the password on the click, copies it, and never draws or keeps it', async () => {
    const { user, write, fake, store } = await openDialog()
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    expect(fake.queries.some((q) => q.name === 'approvals.getPassword')).toBe(false)
    await user.click(button('Copy password'))
    expect(fake.queries.filter((q) => q.name === 'approvals.getPassword')).toEqual([
      { name: 'approvals.getPassword', input: ids },
    ])
    expect(write).toHaveBeenCalledWith(PASSWORD)
    expect(screen.getByRole('status')).toHaveTextContent('Copied.')
    expect(document.documentElement.outerHTML).not.toContain(PASSWORD)
    const values = [...document.querySelectorAll('input')].map((i) => i.value)
    expect(values).not.toContain(PASSWORD)
    expect(JSON.stringify(store.getState())).not.toContain(PASSWORD)
    for (const spy of [log, warn, error]) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain(PASSWORD)
    }
  })

  it('says where the password is when this computer does not keep it', async () => {
    const { dialog } = await openDialog(forCampaign({ link: liveLink({ passwordKept: false }) }))
    expect(dialog).toHaveTextContent('The password is kept on the computer that made the link.')
    expect(screen.queryByRole('button', { name: 'Copy password' })).toBeNull()
  })

  it('sets a new password', async () => {
    const { user, fake, dialog } = await openDialog()
    await user.click(button('Set a new password…'))
    expect(dialog).toHaveTextContent(
      'People who already opened the link must enter the new password.',
    )
    expect(await axeViolations()).toEqual([])
    await user.click(button('Set password'))
    expect(sent(fake)).toEqual([['approvals.setPassword', ids]])
  })

  it('updates the gallery, with its waiting line and the buttons disabled', async () => {
    const { user, fake } = await openDialog()
    let finish: (r: Result<unknown>) => void = () => undefined
    fake.onCommand('approvals.publish', () => new Promise((resolve) => (finish = resolve)))
    await user.click(button('Update gallery'))
    expect(screen.getByText('Updating the gallery…')).toBeInTheDocument()
    expect(button('Update gallery')).toBeDisabled()
    expect(button('Turn off link…')).toBeDisabled()
    finish({ ok: true, data: { variants: 3, drawn: 2 } })
    expect(await screen.findByRole('button', { name: 'Update gallery' })).toBeEnabled()
    expect(sent(fake)).toEqual([['approvals.publish', ids]])
  })

  it('turns off only after the confirmation, with "Keep link" focused', async () => {
    const { user, fake, dialog } = await openDialog()
    await user.click(button('Turn off link…'))
    expect(dialog).toHaveTextContent(
      'Turn off this link? Reviewers can no longer open it. The gallery and its pictures are ' +
        'deleted from the service and your bucket. Sign-offs so far stay in this project.',
    )
    expect(button('Keep link')).toHaveFocus()
    expect(await axeViolations()).toEqual([])
    await user.click(button('Keep link'))
    expect(fake.commands).toEqual([])
    await user.click(button('Turn off link…'))
    await user.click(button('Turn off link'))
    expect(sent(fake)).toEqual([['approvals.endLink', ids]])
  })
})

describe('approval dialog, an ended link [spec/approvals.md "The approval link dialog"]', () => {
  it('says when it ended, keeps its sign-offs, and makes a new link', async () => {
    const { dialog, user, fake } = await openDialog(forCampaign({ link: endedLink() }))
    expect(dialog).toHaveTextContent(
      `This link was turned off on ${dateText(endedLink().endedAt ?? '')}. ` +
        'Its sign-offs are kept below.',
    )
    expect(dialog).toHaveTextContent(
      'Sign-offs from the old link will be removed from this project.',
    )
    expect(screen.getByRole('list', { name: 'Sign-offs for Square post' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
    await user.click(button('Make a new link'))
    await user.click(button('Make link'))
    expect(sent(fake)).toEqual([
      ['approvals.createLink', ids],
      ['approvals.publish', ids],
    ])
  })
})
