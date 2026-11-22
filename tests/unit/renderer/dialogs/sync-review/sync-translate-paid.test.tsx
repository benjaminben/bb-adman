// P6-18 (spec/phases/phase-06.md, "Paid calls"; spec/screens.md, "Paid confirm line"): with a
// paid text provider the sync review sends nothing on open. Each language whose changes have no
// translation gets a line with "Translate"; it opens the paid confirm with one paid request (one
// job for this direction and language), and only "Confirm" sends translation.propose in `sync`
// mode. A failure's "Retry" goes through the same confirm. With a local provider no line shows.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SyncButton } from '@/renderer/dialogs/sync-review'
import type { AppState } from '@/shared/schemas/queries/app'
import type { SyncPreview, SyncPreviewReply } from '@/shared/schemas/queries/sync'
import type { Result } from '@/shared/schemas/result'
import { baseState } from '../../fake-api'
import {
  LOCAL,
  MASTER,
  P,
  campaignApi,
  campaignGet,
  renderWith,
  sent,
  variant,
} from '../../screens/campaign/campaign-fixture'
import { jobRow } from '../../stores/job-fixture'

const STALE = { ...MASTER.badges, outOfDate: true }
const V3 = variant('V3', { title: 'German post', language: 'de', sizeLabel: '9:16', badges: STALE })
const V4 = variant('V4', { title: 'French post', language: 'fr', sizeLabel: '1:1', badges: STALE })
const PAID_LINE = 'This sends 1 paid request(s) to Google Gemini.'

const waiting = (variantId: string): SyncPreview => ({
  variantId,
  changes: [
    {
      layerKey: 'headline',
      layerName: 'Headline',
      kind: 'update',
      groups: ['copy'],
      proposed: {},
      proposedTranslation: { text: 'Kühl in den Sommer', status: 'failed' },
      blockedByOverride: [],
    },
  ],
})

const preview = (ids: string[]): SyncPreviewReply => ({
  directionId: 'D1',
  masterVariantId: 'V1',
  masterRev: 7,
  variants: ids.map(waiting),
})

const ok = (data: unknown): Result<unknown> => ({ ok: true, data })

function localText(): Partial<AppState> {
  const base = baseState()
  return {
    settings: {
      ...base.settings,
      defaultProviders: { ...base.settings.defaultProviders, text: 'fake' },
    },
    providers: [...base.providers, { ...LOCAL, jobs: ['image', 'text'] }],
  }
}

// The default state's text provider is Google Gemini, which the registry marks as not local.
async function draw(ids = ['V3'], state: Partial<AppState> = {}) {
  const fake = campaignApi({ state })
  fake.onQuery('sync.preview', () => ok(preview(ids)))
  fake.onCommand('translation.propose', () => ok({ jobIds: ['J1'] }))
  const variants = [MASTER, V3, V4].filter((v) => v === MASTER || ids.includes(v.id))
  const campaign = campaignGet(variants)
  await renderWith(
    <SyncButton projectId={P} campaign={campaign} direction={campaign.directions[0]!} />,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: /^Sync \d out of date…$/ }))
  const dialog = await screen.findByRole('dialog', { name: 'Sync Main' })
  await within(dialog).findByRole('group', { name: 'German post · 9:16 · de' })
  return { fake, dialog }
}

const proposes = (fake: ReturnType<typeof campaignApi>) =>
  sent(fake, 'translation.propose').map((c) => c.input)

const SYNC_DE = {
  projectId: P,
  provider: 'gemini',
  mode: 'sync',
  directionId: 'D1',
  language: 'de',
}

describe('a paid text provider in the sync review [P6-18]', () => {
  it('sends nothing on open and offers "Translate" for the language', async () => {
    const { fake, dialog } = await draw()
    expect(within(dialog).getByText('German has no translation yet.')).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Translate' })).toBeVisible()
    expect(within(dialog).getByText(/^No translation yet\./)).toBeVisible()
    expect(proposes(fake)).toEqual([])
  })

  it('"Translate" shows the paid line; Cancel sends nothing; only Confirm sends', async () => {
    const { fake, dialog } = await draw()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Translate' }))
    expect(within(dialog).getByText(PAID_LINE)).toBeVisible()
    expect(proposes(fake)).toEqual([])
    const german = within(dialog).getByRole('group', { name: 'German translation' })
    await userEvent.click(within(german).getByRole('button', { name: 'Cancel' }))
    expect(within(dialog).queryByText(PAID_LINE)).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Translate' })).toBeVisible()
    expect(proposes(fake)).toEqual([])
    await userEvent.click(within(dialog).getByRole('button', { name: 'Translate' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(proposes(fake)).toEqual([SYNC_DE])
    expect(await within(dialog).findByText('Translating…')).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: 'Translate' })).toBeNull()
  })

  it('a failure shows "Retry", which goes through the same confirm', async () => {
    const { fake, dialog } = await draw()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Translate' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    await within(dialog).findByText('Translating…')
    const failed = jobRow('J1', {
      kind: 'translation',
      status: 'failed',
      errorKind: 'quota',
      provider: 'gemini',
      variantId: null,
    })
    act(() => fake.emit('job.updated', failed))
    expect(await within(dialog).findByText(/^The translation did not finish: /)).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(within(dialog).getByText(PAID_LINE)).toBeVisible()
    expect(proposes(fake)).toHaveLength(1)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(proposes(fake)).toEqual([SYNC_DE, SYNC_DE])
  })

  it('a refused propose shows the failed line with its message and "Retry"', async () => {
    const { fake, dialog } = await draw()
    fake.onCommand('translation.propose', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'There is no text to translate.' },
    }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Translate' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(
      await within(dialog).findByText(
        'The translation did not finish: There is no text to translate.',
      ),
    ).toBeVisible()
    expect(within(dialog).getByRole('button', { name: 'Retry' })).toBeVisible()
  })

  it('gives each language its own line and sends only the confirmed one', async () => {
    const { fake, dialog } = await draw(['V3', 'V4'])
    expect(within(dialog).getByText('French has no translation yet.')).toBeVisible()
    const buttons = within(dialog).getAllByRole('button', { name: 'Translate' })
    expect(buttons).toHaveLength(2)
    await userEvent.click(buttons[0]!)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }))
    expect(proposes(fake)).toEqual([SYNC_DE])
  })
})

describe('a local text provider in the sync review [P6-18]', () => {
  it('starts on its own with no "Translate" line and no confirm', async () => {
    const { fake, dialog } = await draw(['V3'], localText())
    expect(proposes(fake)).toEqual([{ ...SYNC_DE, provider: 'fake' }])
    expect(within(dialog).queryByRole('button', { name: 'Translate' })).toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Confirm' })).toBeNull()
  })
})
