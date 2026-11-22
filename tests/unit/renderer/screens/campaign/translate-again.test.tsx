// P6-13 (spec/phases/phase-06.md, design addition 8; A-157): "Translate {language} again…" opens
// the run dialog (job text, title and confirm "Translate") and sends translation.propose only
// after the confirm, with the group's variant IDs and the provider chosen there. A failed newest
// job shows its sentence and "Retry" (a new propose, never job.retry); a running one "Running…"
// with "Stop" (job.cancel). Only the fake provider is answered; nothing here is paid.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import { attachedStoreFor, campaignJobs } from '@/renderer/stores/attached-store'
import { plainMessage } from '@/shared/providers/messages'
import type { TranslationJobState, TranslationRow } from '@/shared/schemas/queries/translation'
import { baseState, makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'
import { costLine } from '../../cost-line'
import { jobRow } from '../../stores/job-fixture'
import { LOCAL, MASTER, P, campaignGet } from './campaign-fixture'
import { translationRow as row, translations } from './translation-fixture'

const FAKE = { ...LOCAL, label: 'Fake provider', jobs: ['text' as const] }

function panelApi(rows: TranslationRow[], jobs: TranslationJobState[] = []) {
  const state = baseState()
  const fake = makeFakeApi({ ...state, providers: [...state.providers, FAKE] })
  fake.onQuery('translation.forCampaign', () => ({
    ok: true,
    data: { ...translations(rows), jobs },
  }))
  fake.onCommand('translation.propose', () => ({ ok: true, data: { jobIds: ['J9'] } }))
  return fake
}

async function show(rows: TranslationRow[], jobs: TranslationJobState[] = []) {
  const fake = panelApi(rows, jobs)
  const view = await renderApp(
    <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
    fake,
  )
  await screen.findByRole('region', { name: 'German' })
  return view
}

const proposes = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'translation.propose').map((c) => c.input)

const ROWS = [
  row('L1', { variantId: 'V2' }),
  row('L2', { variantId: 'V3' }),
  row('L3', { variantId: 'V2' }),
]

async function openAgain() {
  await userEvent.click(screen.getByRole('button', { name: 'Translate German again…' }))
  return within(await screen.findByRole('dialog', { name: 'Translate' }))
}

const failedJob: TranslationJobState = {
  directionId: 'D1',
  language: 'de',
  jobId: 'J1',
  status: 'failed',
  errorKind: 'quota',
}

describe('Translate {language} again… [P6-13, A-157]', () => {
  it('opens the run dialog with the paid line and sends nothing before the confirm', async () => {
    const { fake } = await show(ROWS)
    const dialog = await openAgain()
    expect(dialog.getByText(costLine('Paid: 1 request → Google Gemini'))).toBeVisible()
    expect(proposes(fake)).toEqual([])
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(proposes(fake)).toEqual([])
  })

  it('confirm sends translation.propose with the group variant IDs and the chosen provider', async () => {
    const { fake } = await show(ROWS)
    const dialog = await openAgain()
    await userEvent.click(dialog.getByRole('radio', { name: 'Fake provider' }))
    expect(dialog.getByText('This uses the fake provider. Nothing is charged.')).toBeVisible()
    expect(proposes(fake)).toEqual([])
    await userEvent.click(dialog.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(proposes(fake)).toEqual([{ projectId: P, provider: 'fake', variantIds: ['V2', 'V3'] }])
  })

  it('registers the started jobs with the campaign for the close warning', async () => {
    const { fake } = await show(ROWS)
    const dialog = await openAgain()
    await userEvent.click(dialog.getByRole('radio', { name: 'Fake provider' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const jobs = campaignJobs(attachedStoreFor(fake.api).getState(), P, 'C1')
    expect(jobs.map((j) => j.jobId)).toEqual(['J9'])
  })

  it('NEEDS_KEY opens the key dialog and sends again once a key is saved', async () => {
    const { fake, store } = await show(ROWS)
    let calls = 0
    fake.onCommand('translation.propose', () =>
      ++calls === 1
        ? {
            ok: false,
            error: { code: 'NEEDS_KEY', message: 'Add a key.', details: { provider: 'gemini' } },
          }
        : { ok: true, data: { jobIds: ['J9'] } },
    )
    const dialog = await openAgain()
    await userEvent.click(dialog.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(store.getState().keyRequest).not.toBeNull())
    expect(store.getState().keyRequest?.provider.id).toBe('gemini')
    act(() => store.getState().keyRequest?.resolve(true))
    await waitFor(() => expect(proposes(fake)).toHaveLength(2))
    expect(proposes(fake)[1]).toEqual({
      projectId: P,
      provider: 'gemini',
      variantIds: ['V2', 'V3'],
    })
  })

  it('shows a refusal inside the run dialog', async () => {
    const { fake } = await show(ROWS)
    fake.onCommand('translation.propose', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'There is no text to translate.' },
    }))
    const dialog = await openAgain()
    await userEvent.click(dialog.getByRole('button', { name: 'Translate' }))
    expect(await dialog.findByText('There is no text to translate.')).toBeVisible()
  })
})

describe('the translation job line [P6-13]', () => {
  it('a failed newest job shows its sentence and Retry, which sends a new propose', async () => {
    const fake = panelApi(ROWS, [failedJob])
    fake.onQuery('job.get', () => ({
      ok: true,
      data: jobRow('J1', { kind: 'translation', status: 'failed', errorKind: 'quota' }),
    }))
    await renderApp(
      <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
      fake,
    )
    const sentence = plainMessage('quota', 'Google Gemini')
    expect(await screen.findByText(`Failed: ${sentence}`)).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const dialog = within(await screen.findByRole('dialog', { name: 'Translate' }))
    expect(proposes(fake)).toEqual([])
    await userEvent.click(dialog.getByRole('radio', { name: 'Fake provider' }))
    await userEvent.click(dialog.getByRole('button', { name: 'Translate' }))
    await waitFor(() => expect(proposes(fake)).toHaveLength(1))
    expect(proposes(fake)[0]).toEqual({
      projectId: P,
      provider: 'fake',
      directionId: 'D1',
      language: 'de',
    })
    expect(fake.commands.some((c) => c.name === 'job.retry')).toBe(false)
  })

  it('a running job shows the spinner with Stop, which sends job.cancel', async () => {
    const { fake } = await show(ROWS, [{ ...failedJob, status: 'running', errorKind: null }])
    expect(screen.getByTitle('Translating')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(fake.commands).toContainEqual({
      name: 'job.cancel',
      input: { projectId: P, jobId: 'J1' },
    })
  })

  it('shows no line for a finished or cancelled job, nor for another language', async () => {
    await show(ROWS, [
      { ...failedJob, status: 'succeeded', errorKind: null },
      { ...failedJob, jobId: 'J2', language: 'fr' },
    ])
    expect(screen.queryByTitle('Translating')).toBeNull()
    expect(screen.queryByText(/^Failed: /)).toBeNull()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })
})
