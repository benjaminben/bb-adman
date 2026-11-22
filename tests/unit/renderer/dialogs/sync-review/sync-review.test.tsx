// spec/screens-variants.md, "Sync review": SyncButton with its count opens the review of one
// direction. It reads sync.preview on open; one group per variant, one unticked checkbox per
// change, the override radios with "Keep mine" chosen; "Accept all" and "Accept selected" send
// sync.apply with the reply's masterRev; master_changed shows its message and reads again;
// success closes. Names from the project file are drawn as text only.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SyncButton } from '@/renderer/dialogs/sync-review'
import type { SyncChange, SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { Result } from '@/shared/schemas/result'
import { axeViolations } from '../../render'
import {
  MASTER,
  P,
  campaignApi,
  campaignGet,
  renderWith,
  variant,
} from '../../screens/campaign/campaign-fixture'
import { heldReply } from '../../screens/campaign/held-reply'

const STALE = { ...MASTER.badges, outOfDate: true }
const V2 = variant('V2', { title: 'Spring post', badges: STALE })
const V3 = variant('V3', { title: 'German post', language: 'de', sizeLabel: '9:16', badges: STALE })
const V4 = variant('V4', { title: 'Calm post' })

const update = (over: Partial<SyncChange>): SyncChange => ({
  layerKey: 'headline',
  layerName: 'Headline',
  kind: 'update',
  groups: ['copy', 'style'],
  proposed: { copy: 'Fresh as spring' },
  blockedByOverride: [],
  ...over,
})

const PREVIEW: SyncPreviewReply = {
  directionId: 'D1',
  masterVariantId: 'V1',
  masterRev: 7,
  variants: [
    {
      variantId: 'V2',
      changes: [
        update({ blockedByOverride: ['style.color'] }),
        { ...update({}), layerKey: 'badge', layerName: 'Badge', kind: 'add-layer' },
        {
          ...update({}),
          layerKey: 'sticker',
          layerName: 'Sticker',
          kind: 'remove-layer',
          groups: [],
        },
      ],
    },
    {
      variantId: 'V3',
      changes: [
        update({
          groups: ['copy'],
          proposed: {},
          proposedTranslation: { text: 'Hallo', status: 'failed' },
        }),
      ],
    },
  ],
}

const reply = (data: unknown): Result<unknown> => ({ ok: true, data })

async function draw(
  preview: SyncPreviewReply | (() => Promise<Result<unknown>>) = PREVIEW,
  variants = [MASTER, V2, V3, V4],
) {
  const fake = campaignApi()
  fake.onQuery('sync.preview', typeof preview === 'function' ? preview : () => reply(preview))
  const campaign = campaignGet(variants)
  const direction = campaign.directions[0]!
  const view = await renderWith(
    <main>
      <h1>Campaign</h1>
      <SyncButton projectId={P} campaign={campaign} direction={direction} />
    </main>,
    fake,
  )
  return view
}

async function open() {
  await userEvent.click(screen.getByRole('button', { name: 'Sync 2 out of date…' }))
  return screen.findByRole('dialog', { name: 'Sync Main' })
}

const applies = (fake: ReturnType<typeof campaignApi>) =>
  fake.commands.filter((c) => c.name === 'sync.apply').map((c) => c.input)

describe('SyncButton and the sync review', () => {
  it('counts the out-of-date variants of the direction; at 0 it is disabled', async () => {
    const { unmount } = await draw()
    expect(screen.getByRole('button', { name: 'Sync 2 out of date…' })).toBeEnabled()
    unmount()
    await draw(PREVIEW, [MASTER, V4])
    expect(screen.queryByRole('button', { name: /^Sync/ })).toBeNull()
  })

  it('reads sync.preview on open and shows "Reading the changes…" meanwhile', async () => {
    const held = heldReply()
    const { fake } = await draw(held.answer)
    const dialog = await open()
    expect(within(dialog).getByText('Reading the changes…')).toBeInTheDocument()
    expect(fake.queries.filter((q) => q.name === 'sync.preview').map((q) => q.input)).toEqual([
      { projectId: P, directionId: 'D1' },
    ])
    held.release(reply(PREVIEW))
    expect(
      await within(dialog).findByRole('group', { name: 'Spring post · 1:1 · en' }),
    ).toBeVisible()
  })

  it('says every variant is up to date when the reply has none', async () => {
    await draw({ ...PREVIEW, variants: [] })
    const dialog = await open()
    expect(await within(dialog).findByText('Every variant is up to date.')).toBeVisible()
  })

  it('lists one group per variant with one unticked checkbox per change', async () => {
    await draw()
    const dialog = await open()
    const first = await within(dialog).findByRole('group', { name: 'Spring post · 1:1 · en' })
    expect(within(first).getAllByRole('checkbox')).toHaveLength(3)
    expect(within(first).getByRole('checkbox', { name: 'Headline: text, style' })).not.toBeChecked()
    expect(within(first).getByText('New text: Fresh as spring')).toBeVisible()
    expect(
      within(first).getByRole('checkbox', { name: 'Badge: new layer from the master' }),
    ).toBeVisible()
    expect(
      within(first).getByRole('checkbox', { name: 'Sticker: removed from the master' }),
    ).toBeVisible()
    const second = within(dialog).getByRole('group', { name: 'German post · 9:16 · de' })
    expect(within(second).getByRole('checkbox', { name: 'Headline: text' })).not.toBeChecked()
    expect(
      within(second).getByText(
        'No translation yet. The text stays as it is and is marked as missing a translation.',
      ),
    ).toBeVisible()
    expect(within(second).queryByText(/New text/)).toBeNull()
    expect(await axeViolations()).toEqual([])
  })

  it('offers each blocked path with "Keep mine" chosen', async () => {
    await draw()
    const dialog = await open()
    const choice = await within(dialog).findByRole('radiogroup', {
      name: 'Changed on this variant: style: colour',
    })
    expect(within(choice).getByRole('radio', { name: 'Keep mine' })).toBeChecked()
    expect(within(choice).getByRole('radio', { name: "Take the master's" })).not.toBeChecked()
  })

  it('"Accept selected" sends only the ticked changes with their choices and the masterRev', async () => {
    const { fake } = await draw()
    const dialog = await open()
    const button = await within(dialog).findByRole('button', { name: 'Accept selected' })
    expect(button).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('checkbox', { name: 'Headline: text, style' }))
    await userEvent.click(within(dialog).getByRole('radio', { name: "Take the master's" }))
    await userEvent.click(button)
    await waitFor(() => expect(applies(fake)).toHaveLength(1))
    expect(applies(fake)[0]).toEqual({
      projectId: P,
      directionId: 'D1',
      masterRev: 7,
      decisions: [
        {
          variantId: 'V2',
          layerKey: 'headline',
          accept: true,
          overrides: [{ path: 'style.color', choice: 'take-master' }],
        },
      ],
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('"Accept all" sends every change, a blocked path kept as mine', async () => {
    const { fake } = await draw()
    const dialog = await open()
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Accept all' }))
    await waitFor(() => expect(applies(fake)).toHaveLength(1))
    const sent = applies(fake)[0] as { masterRev: number; decisions: Array<{ layerKey: string }> }
    expect(sent.masterRev).toBe(7)
    expect(sent.decisions.map((d) => d.layerKey)).toEqual([
      'headline',
      'badge',
      'sticker',
      'headline',
    ])
    expect(sent.decisions[0]).toMatchObject({
      overrides: [{ path: 'style.color', choice: 'keep-mine' }],
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('on master_changed shows the message and reads sync.preview again', async () => {
    const { fake, store } = await draw()
    const message = 'The master changed after the review opened. Look at the changes again.'
    fake.onCommand('sync.apply', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'master_changed' } },
    }))
    const dialog = await open()
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Accept all' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    await waitFor(() =>
      expect(fake.queries.filter((q) => q.name === 'sync.preview')).toHaveLength(2),
    )
    expect(await within(dialog).findByRole('button', { name: 'Accept all' })).toBeEnabled()
    expect(within(dialog).getByRole('alert')).toHaveTextContent(message)
    expect(store.getState().error).toBe(message)
  })

  it('shows another refusal in the dialog and keeps it open', async () => {
    const { fake } = await draw()
    const message = 'A sync choice does not match the changes.'
    fake.onCommand('sync.apply', () => ({ ok: false, error: { code: 'INVALID_INPUT', message } }))
    const dialog = await open()
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Accept all' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(message)
    expect(fake.queries.filter((q) => q.name === 'sync.preview')).toHaveLength(1)
  })

  it('draws a title and a layer name holding markup as text', async () => {
    const marked = variant('V2', { title: '<b>Bold</b> post', badges: STALE })
    const preview = {
      ...PREVIEW,
      variants: [{ variantId: 'V2', changes: [update({ layerName: '<i>Head</i>' })] }],
    }
    await draw(preview, [MASTER, marked, V3])
    const dialog = await open()
    expect(
      await within(dialog).findByRole('group', { name: '<b>Bold</b> post · 1:1 · en' }),
    ).toBeVisible()
    expect(within(dialog).getByRole('checkbox', { name: '<i>Head</i>: text, style' })).toBeVisible()
    expect(dialog.querySelector('b, i')).toBeNull()
  })

  it('Cancel closes with focus back on the button; opening again reads afresh, unticked', async () => {
    const { fake } = await draw()
    let dialog = await open()
    const box = await within(dialog).findByRole('checkbox', { name: 'Headline: text, style' })
    await userEvent.click(box)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('button', { name: 'Sync 2 out of date…' })).toHaveFocus()
    dialog = await open()
    const again = await within(dialog).findByRole('checkbox', { name: 'Headline: text, style' })
    expect(again).not.toBeChecked()
    expect(fake.queries.filter((q) => q.name === 'sync.preview')).toHaveLength(2)
  })
})
