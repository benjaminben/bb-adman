// P6-16 (spec/phases/phase-06.md, section 7; spec/data-rules.md, "Sync"): translation in the
// sync review. With a local text provider, opening sends one translation.propose in `sync`
// mode per language whose change has no usable text, shows "Translating…", and reads the
// preview again when the job succeeds. A failure shows its sentence, "Retry" and a field to
// type the text by hand (translation.set). With a paid provider nothing is sent on open.
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SyncButton } from '@/renderer/dialogs/sync-review'
import type { AppState } from '@/shared/schemas/queries/app'
import type { SyncPreviewReply } from '@/shared/schemas/queries/sync'
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

const previewWith = (status: 'proposed' | 'failed', text: string): SyncPreviewReply => ({
  directionId: 'D1',
  masterVariantId: 'V1',
  masterRev: 7,
  variants: [
    {
      variantId: 'V3',
      changes: [
        {
          layerKey: 'headline',
          layerName: 'Headline',
          kind: 'update',
          groups: ['copy'],
          proposed: {},
          proposedTranslation: { text, status },
          blockedByOverride: [],
        },
      ],
    },
  ],
})

const WAITING = previewWith('failed', 'Kühl in den Sommer')
const ARRIVED = previewWith('proposed', '[de] Frisch von den Gipfeln')
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

async function draw(previews: SyncPreviewReply[], state: Partial<AppState> = localText()) {
  const fake = campaignApi({ state })
  let reads = 0
  fake.onQuery('sync.preview', () => ok(previews[Math.min(reads++, previews.length - 1)]))
  fake.onCommand('translation.propose', () => ok({ jobIds: ['J1'] }))
  const campaign = campaignGet([MASTER, V3])
  await renderWith(
    <SyncButton projectId={P} campaign={campaign} direction={campaign.directions[0]!} />,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Sync 1 out of date…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Sync Main' })
  await within(dialog).findByRole('group', { name: 'German post · 9:16 · de' })
  return { fake, dialog }
}

const ended = (status: 'succeeded' | 'failed', errorKind: 'quota' | null = null) =>
  jobRow('J1', { kind: 'translation', status, errorKind, provider: 'fake', variantId: null })

describe('translation in the sync review [P6-16]', () => {
  it('starts one sync translation per language, then shows the proposed text', async () => {
    const { fake, dialog } = await draw([WAITING, ARRIVED])
    expect(sent(fake, 'translation.propose').map((c) => c.input)).toEqual([
      { projectId: P, provider: 'fake', mode: 'sync', directionId: 'D1', language: 'de' },
    ])
    expect(await within(dialog).findByText('Translating…')).toBeVisible()
    act(() => fake.emit('job.updated', ended('succeeded')))
    expect(
      await within(dialog).findByText('Proposed translation: [de] Frisch von den Gipfeln'),
    ).toBeVisible()
    expect(sent(fake, 'translation.propose')).toHaveLength(1)
  })

  it('shows a failure with its sentence and "Retry", which starts the language again', async () => {
    const { fake, dialog } = await draw([WAITING])
    await within(dialog).findByText('Translating…')
    act(() => fake.emit('job.updated', ended('failed', 'quota')))
    expect(await within(dialog).findByText(/^The translation did not finish: /)).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'translation.propose')).toHaveLength(2)
    expect(within(dialog).queryByRole('button', { name: 'Try again' })).toBeNull()
  })

  it('saves a text typed by hand with translation.set, then reads the changes again', async () => {
    const { fake, dialog } = await draw([WAITING])
    fake.onQuery('variant.get', () => ok({ layers: [{ id: 'L9', key: 'headline' }] }))
    act(() => fake.emit('job.updated', ended('failed')))
    const field = await within(dialog).findByLabelText('Or type the translation')
    await userEvent.type(field, 'Frisch')
    const reads = fake.queries.filter((q) => q.name === 'sync.preview').length
    await userEvent.click(within(dialog).getByRole('button', { name: 'Use this text' }))
    expect(sent(fake, 'translation.set').map((c) => c.input)).toEqual([
      { projectId: P, layerId: 'L9', text: 'Frisch', applyToSameLanguage: false },
    ])
    expect(fake.queries.filter((q) => q.name === 'sync.preview').length).toBe(reads + 1)
  })

  it('sends nothing on open with a paid text provider, and keeps the Phase 5 line', async () => {
    const { fake, dialog } = await draw([WAITING], {})
    expect(await within(dialog).findByText(/^No translation yet\./)).toBeVisible()
    expect(sent(fake, 'translation.propose')).toEqual([])
  })

  it('sends nothing on open when the text has already arrived', async () => {
    const { fake, dialog } = await draw([ARRIVED])
    expect(within(dialog).getByText(/^Proposed translation: /)).toBeVisible()
    expect(sent(fake, 'translation.propose')).toEqual([])
  })
})
