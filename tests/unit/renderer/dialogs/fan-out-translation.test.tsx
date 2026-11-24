// P6-15 (spec/phases/phase-06.md, section 7): the fan-out dialog states the text calls with the
// Settings text provider before "Make variants", one request per new language and never fewer;
// a local or fake provider shows no paid line. The translation jobs in the reply are registered
// under the campaign for the tab's close warning.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FanOutButton } from '@/renderer/dialogs/fan-out'
import { translationLine } from '@/renderer/dialogs/fan-out/fan-out-costs'
import { translationCount } from '@/renderer/dialogs/fan-out/fan-out-model'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { LOCAL, P, campaignGet, sent, variant } from '../screens/campaign/campaign-fixture'
import { costLine } from '../cost-line'

const MASTER = variant('V1', { title: 'Master post', isMaster: true, sizeLabel: '1x1' })
const FAKE_TEXT: ProviderInfo = { ...LOCAL, label: 'Fake provider', jobs: ['image', 'text'] }
const SIZES = [
  { label: '1x1', width: 1080, height: 1080 },
  { label: '9x16', width: 1080, height: 1920 },
]

function data(): CampaignGet {
  const base = campaignGet([MASTER])
  return {
    ...base,
    campaign: { ...base.campaign, sizes: SIZES, languages: ['en', 'de', 'fr'] },
    directions: [{ id: 'D1', campaignId: 'C1', name: 'Beach day', masterVariantId: 'V1', sort: 0 }],
  }
}

function api(text: string) {
  const base = baseState()
  const settings = {
    ...base.settings,
    defaultProviders: { ...base.settings.defaultProviders, text },
  }
  const fake = makeFakeApi(baseState({ settings, providers: [...base.providers, FAKE_TEXT] }))
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: { variant: MASTER, campaignId: 'C1', layers: [], assets: [] },
  }))
  return fake
}

async function open(text = 'gemini') {
  const fake = api(text)
  await renderApp(
    <main>
      <h1>Summer Splash</h1>
      <FanOutButton projectId={P} campaign={data()} direction={data().directions[0]!} />
    </main>,
    fake,
  )
  await userEvent.click(screen.getByRole('button', { name: 'Make variants…' }))
  const dialog = await screen.findByRole('dialog', { name: 'Make variants of Beach day' })
  return { fake, dialog }
}

const tick = (name: string) => userEvent.click(screen.getByRole('button', { name }))
const make = () => screen.getByRole('button', { name: /^Make (\d+ )?variants?$/ })
const basis = {
  sizes: SIZES,
  languages: ['en', 'de', 'fr'],
  primaryLanguage: 'en',
  master: { sizeLabel: '1x1', language: 'en', width: 1080, height: 1080 },
  existing: [
    { sizeLabel: '1x1', language: 'en', format: 'image' as const },
    { sizeLabel: '1x1', language: 'fr', format: 'image' as const },
  ],
}

describe('translationCount and translationLine [P6-15]', () => {
  it.each([
    [{ sizes: [], languages: [] }, 0],
    [{ sizes: ['9x16'], languages: [] }, 0],
    [{ sizes: [], languages: ['de'] }, 1],
    [{ sizes: ['9x16'], languages: ['de'] }, 1],
    [{ sizes: ['9x16'], languages: ['de', 'fr'] }, 2],
    [{ sizes: [], languages: ['fr'] }, 0],
  ])('counts one request per new language other than the master’s: %j gives %i', (ticks, n) => {
    expect(translationCount(basis, ticks)).toBe(n)
  })

  it.each([
    [0, FAKE_TEXT, null],
    [2, FAKE_TEXT, 'Translating 2 languages uses the fake provider. Nothing is charged.'],
    [
      1,
      { id: 'other', label: 'Local text', local: true },
      'Translating 1 language runs on Local text. Nothing is charged.',
    ],
    [
      2,
      { id: 'gemini', label: 'Google Gemini', local: false },
      'Paid: up to 2 translations → Google Gemini',
    ],
    [1, null, 'No provider can translate yet. The new texts stay marked as missing a translation.'],
  ])('words %i language(s) with %j', (n, provider, line) => {
    expect(translationLine(n, provider)).toBe(line)
  })
})

describe('Fan-out dialog, translation [P6-15]', () => {
  it('shows the paid line for a paid text provider only when a new language is ticked', async () => {
    const { dialog } = await open()
    await tick('9x16 (1080×1920)')
    expect(within(dialog).queryByText(/translation/)).toBeNull()
    await tick('de')
    await tick('fr')
    expect(
      within(dialog).getByText(costLine('Paid: up to 2 translations → Google Gemini')),
    ).toBeVisible()
    expect(await axeViolations()).toEqual([])
  })

  it('shows no paid line with the fake provider', async () => {
    const { dialog } = await open('fake')
    await tick('de')
    expect(
      within(dialog).getByText(
        'Translating 1 language uses the fake provider. Nothing is charged.',
      ),
    ).toBeVisible()
    expect(within(dialog).queryByText(/paid/i)).toBeNull()
  })

  it('sends nothing before "Make variants", then registers the translation jobs under the campaign', async () => {
    const { fake } = await open('fake')
    fake.onCommand('variant.fanOut', () => ({
      ok: true,
      data: { variantIds: ['V2', 'V3'], fill: [], translationJobIds: ['T1', 'T2'] },
    }))
    await tick('de')
    await tick('fr')
    expect(fake.commands).toEqual([])
    await userEvent.click(make())
    const attached = attachedStoreFor(fake.api)
    await waitFor(() => expect(attached.getState().jobs.map((j) => j.jobId)).toEqual(['T1', 'T2']))
    for (const job of attached.getState().jobs) {
      expect(job.owner).toEqual({ projectId: P, campaignId: 'C1' })
    }
    expect(fake.commands.map((c) => c.name)).toEqual(['variant.fanOut'])
    expect(sent(fake, 'translation.propose')).toEqual([])
  })
})
