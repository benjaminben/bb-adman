// DLG-7 (spec/phases/design-wave-screens-b.md, "DLG-7 — Review dialogs"): the sync review
// uses kind="review" with two panes, the out-of-date variants listed on the left and the
// picked one's changes on the right. Picking another row never loses a tick or a choice, so
// "Accept selected" and "Accept all" send exactly what they sent before the redraw. Translate
// stays two clicks: the first shows the cost and sends nothing, only Confirm sends, once.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SyncButton } from '@/renderer/dialogs/sync-review'
import type { SyncChange, SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { Result } from '@/shared/schemas/result'
import { axeViolations } from '../render'
import { costLine } from '../cost-line'
import {
  MASTER,
  P,
  campaignApi,
  campaignGet,
  renderWith,
  sent,
  variant,
} from '../screens/campaign/campaign-fixture'

const STALE = { ...MASTER.badges, outOfDate: true }
const V2 = variant('V2', { title: 'Spring post', badges: STALE })
const V3 = variant('V3', { title: 'German post', language: 'de', sizeLabel: '9:16', badges: STALE })
const SPRING = 'Spring post · 1:1 · en'
const GERMAN = 'German post · 9:16 · de'

const change = (layerKey: string, over: Partial<SyncChange> = {}): SyncChange => ({
  layerKey,
  layerName: layerKey[0]!.toUpperCase() + layerKey.slice(1),
  kind: 'update',
  groups: ['style'],
  proposed: {},
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
        change('headline', {
          groups: ['copy', 'style'],
          proposed: { copy: 'Fresh as spring' },
          blockedByOverride: ['style.color'],
        }),
        change('badge', { kind: 'add-layer' }),
      ],
    },
    {
      variantId: 'V3',
      changes: [
        change('headline', {
          groups: ['copy'],
          proposedTranslation: { text: 'Hallo', status: 'failed' },
          blockedByOverride: ['geometry'],
        }),
      ],
    },
  ],
}

const ok = (data: unknown): Result<unknown> => ({ ok: true, data })

async function openReview() {
  const fake = campaignApi()
  const layers = [{ id: 'L1', key: 'headline', copy: 'Cool as winter' }]
  fake.onQuery('variant.get', () => ok({ layers }))
  fake.onQuery('sync.preview', () => ok(PREVIEW))
  fake.onCommand('translation.propose', () => ok({ jobIds: ['J1'] }))
  const campaign = campaignGet([MASTER, V2, V3])
  await renderWith(
    <main>
      <h1>Campaign</h1>
      <SyncButton projectId={P} campaign={campaign} direction={campaign.directions[0]!} />
    </main>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Sync 2 out of date…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Sync Main' })
  await within(dialog).findByRole('group', { name: SPRING })
  return { fake, dialog }
}

const pick = (dialog: HTMLElement, name: string) =>
  userEvent.click(within(dialog).getByRole('button', { name }))
const tick = (dialog: HTMLElement, name: string) =>
  userEvent.click(within(dialog).getByRole('checkbox', { name }))
const take = (dialog: HTMLElement, path: string) =>
  userEvent.click(
    within(
      within(dialog).getByRole('radiogroup', { name: `Changed on this variant: ${path}` }),
    ).getByRole('radio', { name: "Take the master's" }),
  )
const applied = (fake: ReturnType<typeof campaignApi>) =>
  sent(fake, 'sync.apply').map((c) => c.input)
const decision = (variantId: string, layerKey: string, overrides: object[] = []) => ({
  variantId,
  layerKey,
  accept: true,
  overrides,
})
const keep = (path: string) => ({ path, choice: 'keep-mine' })
const master = (path: string) => ({ path, choice: 'take-master' })

describe('the sync review as a review dialog [DLG-7]', () => {
  it('lists the variants on the left and shows the first one on the right', async () => {
    const { dialog } = await openReview()
    const list = within(dialog).getByRole('list', { name: 'Out-of-date variants' })
    const rows = within(list).getAllByRole('button', { name: /·/ })
    expect(rows.map((r) => r.getAttribute('aria-label'))).toEqual([SPRING, GERMAN])
    expect(rows[0]).toHaveAttribute('aria-current', 'true')
    expect(within(list).getByText('9:16 · de')).toBeVisible()
    expect(within(dialog).queryByRole('group', { name: GERMAN })).toBeNull()
    await pick(dialog, GERMAN)
    expect(within(dialog).getByRole('group', { name: GERMAN })).toBeVisible()
    expect(within(dialog).queryByRole('group', { name: SPRING })).toBeNull()
    expect(within(dialog).getByRole('button', { name: GERMAN })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(await axeViolations()).toEqual([])
  })

  it('draws each blocked field as "Mine" | "Master", keeping the old names', async () => {
    const { dialog } = await openReview()
    const choice = within(dialog).getByRole('radiogroup', {
      name: 'Changed on this variant: style: colour',
    })
    expect(within(choice).getByRole('radio', { name: 'Keep mine' })).toBeChecked()
    expect(within(choice).getByText('Mine')).toBeVisible()
    expect(within(choice).getByText('Master')).toBeVisible()
  })

  it("shows the variant's own text beside the master's new text", async () => {
    const { dialog } = await openReview()
    const right = within(dialog).getByRole('group', { name: SPRING })
    expect(await within(right).findByText('Cool as winter')).toBeVisible()
    const cells = within(right)
      .getAllByRole('definition')
      .map((d) => d.textContent)
    expect(cells).toEqual(['Cool as winter', 'Fresh as spring'])
  })

  it('keeps ticks and choices on a variant that is no longer shown', async () => {
    const { dialog } = await openReview()
    await tick(dialog, 'Headline: text, style')
    await take(dialog, 'style: colour')
    await pick(dialog, GERMAN)
    await tick(dialog, 'Headline: text')
    await pick(dialog, SPRING)
    expect(within(dialog).getByRole('checkbox', { name: 'Headline: text, style' })).toBeChecked()
    expect(within(dialog).getByRole('radio', { name: "Take the master's" })).toBeChecked()
  })

  it.each([
    {
      what: 'a tick only on the variant not shown, a choice on an unticked change',
      steps: async (d: HTMLElement) => {
        await pick(d, GERMAN)
        await tick(d, 'Headline: text')
        await pick(d, SPRING)
        await take(d, 'style: colour')
      },
      button: 'Accept selected',
      decisions: [decision('V3', 'headline', [keep('geometry')])],
    },
    {
      what: 'ticks on both variants with a choice on each, ending on the second',
      steps: async (d: HTMLElement) => {
        await tick(d, 'Badge: new layer from the master')
        await take(d, 'style: colour')
        await pick(d, GERMAN)
        await take(d, 'position and size')
        await tick(d, 'Headline: text')
      },
      button: 'Accept selected',
      decisions: [decision('V2', 'badge'), decision('V3', 'headline', [master('geometry')])],
    },
    {
      what: 'accept all after a choice on the variant no longer shown',
      steps: async (d: HTMLElement) => {
        await pick(d, GERMAN)
        await take(d, 'position and size')
        await pick(d, SPRING)
      },
      button: 'Accept all',
      decisions: [
        decision('V2', 'headline', [keep('style.color')]),
        decision('V2', 'badge'),
        decision('V3', 'headline', [master('geometry')]),
      ],
    },
    {
      what: 'accept all with no choice made, every blocked field kept as mine',
      steps: async (d: HTMLElement) => {
        await pick(d, GERMAN)
      },
      button: 'Accept all',
      decisions: [
        decision('V2', 'headline', [keep('style.color')]),
        decision('V2', 'badge'),
        decision('V3', 'headline', [keep('geometry')]),
      ],
    },
  ])('sends the same decisions as before: $what', async ({ steps, button, decisions }) => {
    const { fake, dialog } = await openReview()
    await steps(dialog)
    await userEvent.click(within(dialog).getByRole('button', { name: button }))
    await waitFor(() => expect(applied(fake)).toHaveLength(1))
    expect(applied(fake)[0]).toEqual({ projectId: P, directionId: 'D1', masterRev: 7, decisions })
  })

  it('marks the untranslated variant "No German" and keeps Translate two clicks', async () => {
    const { fake, dialog } = await openReview()
    const row = within(dialog).getByRole('listitem', { name: GERMAN })
    expect(within(row).getByText('No German')).toBeVisible()
    await userEvent.click(within(row).getByRole('button', { name: 'Translate' }))
    expect(sent(fake, 'translation.propose')).toEqual([])
    const german = within(dialog).getByRole('group', { name: 'German translation' })
    expect(within(german).getByText(costLine('Paid: 1 request → Google Gemini'))).toBeVisible()
    const confirm = within(german).getByRole('button', { name: 'Confirm' })
    expect(confirm).toHaveAccessibleDescription('Paid: 1 request to Google Gemini')
    await userEvent.click(confirm)
    expect(sent(fake, 'translation.propose').map((c) => c.input)).toEqual([
      { projectId: P, provider: 'gemini', mode: 'sync', directionId: 'D1', language: 'de' },
    ])
    expect(within(dialog).queryByRole('button', { name: 'Confirm' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Translate' })).toBeNull()
  })

  it('shows the untranslated change on the right as a mark with the old sentence as its tip', async () => {
    const { dialog } = await openReview()
    await pick(dialog, GERMAN)
    const right = within(dialog).getByRole('group', { name: GERMAN })
    const mark = within(right).getByTitle(
      'No translation yet. The text stays as it is and is marked as missing a translation.',
    )
    expect(mark).toHaveTextContent(/^No German/)
  })
})
