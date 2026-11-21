// SP-4 (spec/subject-photos.md, "Removing a form photo", "After a refusal"; A-111, A-118):
// Cancel and the page going away remove every photo the form added, never a reused one, and
// nothing once the campaign is made. After a refused step, made subjects' rows use the made
// subject and attached photos leave the form's photos, so pressing Create again repeats nothing.
import { describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { addPhoto } from './brief-form-fixture'
import { briefApi, openForm, openPage, photoNames, sent } from './brief-load-photos-fixture'

type Fake = ReturnType<typeof briefApi>['fake']
const names = (fake: Fake) => fake.commands.map((c) => c.name)
const removed = (fake: Fake) =>
  sent(fake, 'asset.remove').map((i) => (i as { assetId: string }).assetId)
const create = () => userEvent.click(screen.getByRole('button', { name: 'Create campaign' }))

// The form with B1 (added), B2 (reused) from the brief and F1 added to row 1 on the form.
async function openWithPhotos() {
  const { fake } = briefApi()
  fake.reuse('B2')
  const form = await openForm(fake)
  await addPhoto(form, 1)
  return { fake, form }
}

describe('removing the photos the form added [SP-4, A-111]', () => {
  it('removes the added photos on Cancel and keeps the reused one', async () => {
    const { fake } = await openWithPhotos()
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(removed(fake).sort()).toEqual(['B1', 'F1']))
  })

  it('removes the added photos when the page goes away with the form open', async () => {
    const { fake } = briefApi()
    fake.reuse('B2')
    const { unmount } = await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await addPhoto(await screen.findByRole('region', { name: 'Brief' }), 1)
    unmount()
    await waitFor(() => expect(removed(fake).sort()).toEqual(['B1', 'F1']))
  })

  it('removes nothing once the campaign is made, even when the page then goes away', async () => {
    const { fake } = briefApi()
    const { unmount } = await openPage(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Load a brief' }))
    await screen.findByRole('region', { name: 'Brief' })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled(),
    )
    await create()
    await waitFor(() => expect(screen.queryByRole('region', { name: 'Brief' })).toBeNull())
    unmount()
    expect(removed(fake)).toEqual([])
  })
})

describe('after a refused step on Create [SP-4, A-118]', () => {
  it('a refused asset.update: made rows use their subject, attached photos stay on Cancel', async () => {
    const { fake } = briefApi()
    fake.refuseUpdate('B2')
    const form = await openForm(fake)
    await create()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'That subject is not in this project.',
    )
    for (const [n, id] of [
      [1, 'citrus-can'],
      [2, 'berry-bottle'],
    ] as const) {
      const row = within(form).getByRole('group', { name: `Subject ${n}` })
      await waitFor(() =>
        expect(within(row).getByLabelText('Use a subject this project has')).toBeChecked(),
      )
      expect(within(row).getByLabelText('Project subject')).toHaveValue(id)
    }
    expect(photoNames(form, 1)).toEqual([])
    expect(photoNames(form, 2)).toEqual(['bottle.png'])
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(removed(fake)).toEqual(['B2']))
  })

  it('a second Create after a refused asset.update sends only what is left', async () => {
    const { fake } = briefApi()
    fake.refuseUpdate('B2')
    await openForm(fake)
    await create()
    await screen.findByRole('alert')
    const before = fake.commands.length
    fake.refuseUpdate('B2', false)
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled(),
    )
    await create()
    await waitFor(() => expect(names(fake)).toContain('campaign.create'))
    expect(names(fake).slice(before)).toEqual(['asset.update', 'campaign.create'])
    expect(sent(fake, 'asset.update').at(-1)).toEqual({
      projectId: 'P1',
      assetId: 'B2',
      subjectId: 'berry-bottle',
    })
  })

  it('a refused campaign.create: a second Create sends campaign.create alone and Cancel removes nothing', async () => {
    const { fake } = briefApi()
    const message = 'The campaign could not be made.'
    fake.onCommand('campaign.create', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message },
    }))
    const form = await openForm(fake)
    await create()
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    await waitFor(() => expect(photoNames(form, 1)).toEqual([]))
    expect(photoNames(form, 2)).toEqual([])
    const before = fake.commands.length
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Create campaign' })).toBeEnabled(),
    )
    await create()
    await waitFor(() => expect(names(fake).slice(before)).toEqual(['campaign.create']))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(removed(fake)).toEqual([])
  })
})
