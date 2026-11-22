// HOME-2 (spec/phases/design-wave-screens-b.md; choice C-13): the brief form is its own page, a
// SubPage "New campaign" with Back, the form, and a foot holding "Cancel" and "Create campaign".
// Back and Escape do what Cancel does (the form's added photos are removed, the home returns,
// focus on "Load a brief"); with typed work they first ask "Leave this brief?" (orchestrator's
// ruling), and only "Leave" runs the clean-up.
import { describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SubPage } from '@/renderer/ui/sub-page'
import { axeViolations } from '../../render'
import { addPhoto } from './brief-form-fixture'
import { briefApi, openForm, sent } from './brief-load-photos-fixture'

type Fake = ReturnType<typeof briefApi>['fake']
const removed = (fake: Fake) =>
  sent(fake, 'asset.remove').map((i) => (i as { assetId: string }).assetId)
const page = () => screen.queryByRole('region', { name: 'New campaign' })
const question = () => screen.queryByRole('dialog', { name: 'Leave this brief?' })
const back = () => userEvent.click(screen.getByRole('button', { name: 'Back' }))
const escape = () => userEvent.keyboard('{Escape}')

async function expectHome(fake: Fake, photos: string[]) {
  await waitFor(() => expect(page()).toBeNull())
  await waitFor(() => expect(screen.getByRole('button', { name: 'Load a brief' })).toHaveFocus())
  await waitFor(() => expect(removed(fake).sort()).toEqual(photos))
  expect(screen.getByRole('heading', { name: 'Campaigns' })).toBeInTheDocument()
}

describe('the New campaign page [HOME-2, C-13]', () => {
  it('shows the form as a page titled "New campaign", focus in the first field', async () => {
    const { fake } = briefApi()
    const form = await openForm(fake)
    expect(within(form).getByRole('heading', { level: 2, name: 'New campaign' })).toBeVisible()
    await waitFor(() => expect(within(form).getByLabelText('Campaign name')).toHaveFocus())
    expect(screen.queryByRole('heading', { name: 'Campaigns' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Assets' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Brief' })).toBeNull()
    expect(screen.getAllByRole('heading', { name: 'New campaign' })).toHaveLength(1)
  })

  it('ends with Cancel, then "Create campaign" as the last tab stop', async () => {
    const { fake } = briefApi()
    const form = await openForm(fake)
    const create = within(form).getByRole('button', { name: 'Create campaign' })
    await waitFor(() => expect(create).toBeEnabled())
    const stops = within(form)
      .getAllByRole('button')
      .filter((b) => !b.hasAttribute('disabled') && b.tabIndex >= 0)
    expect(stops.at(-1)).toBe(create)
    expect(stops.at(-2)).toHaveAccessibleName('Cancel')
    expect(create.compareDocumentPosition(within(form).getByLabelText('Campaign name'))).toBe(
      Node.DOCUMENT_POSITION_PRECEDING,
    )
  })

  it('turns the spinner inside "Create campaign" while creating, the words a status', async () => {
    const { fake } = briefApi()
    let release = () => {}
    fake.onCommand('campaign.create', async () => {
      await new Promise<void>((r) => (release = r))
      return { ok: true, data: { campaignId: 'C9' } }
    })
    const form = await openForm(fake)
    const create = within(form).getByRole('button', { name: 'Create campaign' })
    await waitFor(() => expect(create).toBeEnabled())
    await userEvent.click(create)
    expect(await within(form).findByRole('status')).toHaveTextContent('Creating the campaign…')
    expect(create.querySelector('svg')).not.toBeNull()
    await act(async () => release())
  })

  it('passes axe', async () => {
    const { fake } = briefApi()
    const form = await openForm(fake)
    expect(await axeViolations(form)).toEqual([])
  })
})

describe('leaving the page untouched [HOME-2]', () => {
  it.each([
    ['Back', back],
    ['Escape', escape],
  ])('%s leaves at once and removes the brief photos as Cancel does', async (_, leave) => {
    const { fake } = briefApi()
    fake.reuse('B2')
    await openForm(fake)
    await leave()
    expect(question()).toBeNull()
    await expectHome(fake, ['B1'])
  })
})

describe('leaving with typed work asks first [HOME-2, ruling]', () => {
  async function typed() {
    const { fake } = briefApi()
    fake.reuse('B2')
    const form = await openForm(fake)
    await addPhoto(form, 1)
    await userEvent.type(within(form).getByLabelText('Campaign name'), ' two')
    return { fake, form }
  }

  it.each([
    ['Back', back],
    ['Escape', escape],
  ])('%s asks "Leave this brief?"; Leave removes the added photos', async (_, leave) => {
    const { fake } = await typed()
    await leave()
    const dialog = await screen.findByRole('dialog', { name: 'Leave this brief?' })
    expect(dialog).toHaveAccessibleDescription('What you typed will be lost.')
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus()
    expect(removed(fake)).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Leave' }))
    await expectHome(fake, ['B1', 'F1'])
  })

  it.each([
    ['Keep editing', () => userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))],
    ['Escape in the question', escape],
  ])('%s keeps the brief as typed and removes nothing', async (_, keep) => {
    const { fake, form } = await typed()
    await escape()
    await screen.findByRole('dialog', { name: 'Leave this brief?' })
    await keep()
    await waitFor(() => expect(question()).toBeNull())
    expect(page()).toBe(form)
    expect(within(form).getByLabelText('Campaign name')).toHaveValue('Summer Splash two')
    expect(removed(fake)).toEqual([])
  })

  it('asks also when Escape is pressed with nothing focused', async () => {
    await typed()
    act(() => (document.activeElement as HTMLElement).blur())
    await escape()
    expect(await screen.findByRole('dialog', { name: 'Leave this brief?' })).toBeVisible()
  })

  it('Cancel in the foot asks nothing and removes the added photos', async () => {
    const { fake } = await typed()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(question()).toBeNull()
    await expectHome(fake, ['B1', 'F1'])
  })
})

describe('Escape that something else takes [HOME-2, SH-2 pattern]', () => {
  it.each([
    ['a menu', 'menu'],
    ['a dialog', 'dialog'],
  ])('does not leave while %s is open', async (_, role) => {
    const { fake } = briefApi()
    await openForm(fake)
    const open = document.createElement('div')
    open.setAttribute('role', role)
    document.body.append(open)
    await escape()
    open.remove()
    expect(page()).not.toBeNull()
    expect(question()).toBeNull()
    expect(removed(fake)).toEqual([])
  })

  it('does not leave when a part marked the key handled', async () => {
    const { fake } = briefApi()
    const form = await openForm(fake)
    const field = within(form).getByLabelText('Campaign name')
    field.addEventListener('keydown', (e) => e.preventDefault(), { once: true })
    fireEvent.keyDown(field, { key: 'Escape' })
    expect(page()).not.toBeNull()
  })

  it('a SubPage with escapeBack false leaves Escape to its caller', async () => {
    const onBack = vi.fn()
    render(
      <SubPage title="New campaign" onBack={onBack} escapeBack={false}>
        <input aria-label="Name" />
      </SubPage>,
    )
    await userEvent.click(screen.getByLabelText('Name'))
    await escape()
    expect(onBack).not.toHaveBeenCalled()
    await back()
    expect(onBack).toHaveBeenCalledOnce()
  })
})
