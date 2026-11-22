// CAMP-5 (spec/phases/design-wave-screens-b.md): the Translations tab drawn as one Section per
// language over a table of rows. The column heads show once; "Proposed" is the button that
// approves one row (today's command, once per click, never while the field holds an edit); the
// link toggle sets "use for every"; a failed job's words stay on the page with Retry; a running
// job shows a spinner and "Stop". Only the fake provider is answered; nothing here is paid.
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TranslationPanel } from '@/renderer/screens/campaign/translation-panel'
import { plainMessage } from '@/shared/providers/messages'
import type { TranslationJobState, TranslationRow } from '@/shared/schemas/queries/translation'
import { baseState, makeFakeApi } from '../../fake-api'
import { axeViolations, renderApp } from '../../render'
import { jobRow } from '../../stores/job-fixture'
import { LOCAL, MASTER, P, campaignGet } from './campaign-fixture'
import { translationRow as row, translations } from './translation-fixture'

const FAKE = { ...LOCAL, label: 'Fake provider', jobs: ['text' as const] }
const LINK = 'Use for every German post with this text box'

function tableApi(rows: TranslationRow[], jobs: TranslationJobState[] = []) {
  const state = baseState()
  const fake = makeFakeApi({ ...state, providers: [...state.providers, FAKE] })
  fake.onQuery('translation.forCampaign', () => ({
    ok: true,
    data: { ...translations(rows), jobs },
  }))
  fake.onCommand('translation.propose', () => ({ ok: true, data: { jobIds: ['J9'] } }))
  return fake
}

async function show(
  rows: TranslationRow[],
  jobs: TranslationJobState[] = [],
  setup: (fake: ReturnType<typeof makeFakeApi>) => void = () => {},
) {
  const fake = tableApi(rows, jobs)
  setup(fake)
  const view = await renderApp(
    <TranslationPanel projectId={P} campaignId="C1" data={campaignGet([MASTER])} />,
    fake,
  )
  const german = within(await screen.findByRole('region', { name: 'German' }))
  return { ...view, fake, german }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

function rowOf(line: string) {
  const field = screen.getByRole('textbox', { name: `German ${line}` })
  return { field, row: within(field.closest('li') as HTMLElement) }
}

const failedJob: TranslationJobState = {
  directionId: 'D1',
  language: 'de',
  jobId: 'J1',
  status: 'failed',
  errorKind: 'quota',
}

describe('the Translations tab [CAMP-5]', () => {
  it('has no card and no "Translations" heading; the source and target names head the columns once', async () => {
    const { german, container } = await show([row('L1'), row('L2', { title: 'Noon' })])
    expect(screen.queryByRole('heading', { name: 'Translations' })).toBeNull()
    expect(container.querySelector('[class*="card"]')).toBeNull()
    expect(german.getAllByText('English', { exact: true })).toHaveLength(1)
    expect(german.queryByText(/\(source\)/)).toBeNull()
    const heads = german.getByText('English', { exact: true }).parentElement as HTMLElement
    expect(within(heads).getByText('German', { exact: true })).toBeTruthy()
    expect(german.getAllByRole('textbox')).toHaveLength(2)
  })

  it('shows the approved count as a bar with "{a}/{b}" and its words in the title', async () => {
    const { german } = await show([row('L1', { status: 'approved' }), row('L2'), row('L3')])
    expect(german.getByTitle('1 of 3 approved').textContent).toContain('1/3')
  })

  it('"Proposed" sends the one-row approve once per click, and is disabled while the field holds an edit', async () => {
    const { fake } = await show([row('L1', { copyRev: 4 }), row('L2', { title: 'Noon' })])
    const one = rowOf('Morning · Story · Headline')
    const proposed = one.row.getByRole('button', { name: 'Proposed: approve' })
    await userEvent.type(one.field, ' neu')
    expect(proposed).toHaveProperty('disabled', true)
    await userEvent.keyboard('{Enter}')
    expect(sent(fake, 'translation.approve')).toEqual([])
    await userEvent.clear(one.field)
    await userEvent.type(one.field, 'Frischer Kaffee')
    expect(proposed).toHaveProperty('disabled', false)
    proposed.focus()
    await userEvent.hover(proposed)
    expect(sent(fake, 'translation.approve')).toEqual([])
    await userEvent.click(proposed)
    await waitFor(() =>
      expect(sent(fake, 'translation.approve')).toEqual([
        { projectId: P, layers: [{ layerId: 'L1', copyRev: 4 }] },
      ]),
    )
  })

  it('draws "Missing" and "Approved" as marks with their own icon and word, not buttons', async () => {
    await show([
      row('L1', { status: 'missing', source: null, text: '' }),
      row('L2', { title: 'Noon', status: 'approved', source: 'user' }),
    ])
    const missing = rowOf('Morning · Story · Headline').row
    const approved = rowOf('Noon · Story · Headline').row
    expect(missing.getByTitle('Missing').textContent).toContain('Missing')
    expect(approved.getByTitle('Approved').textContent).toContain('Approved')
    const icon = (el: HTMLElement) => el.querySelector('svg')?.innerHTML
    expect(icon(missing.getByTitle('Missing'))).not.toBe(icon(approved.getByTitle('Approved')))
    expect(missing.queryByRole('button', { name: /^(Missing|Approved|Proposed)/ })).toBeNull()
    expect(approved.queryByRole('button', { name: /^(Missing|Approved|Proposed)/ })).toBeNull()
  })

  it('names the source as a small icon with its word in the title', async () => {
    await show([row('L1', { source: 'agent' }), row('L2', { title: 'Noon', source: 'brief' })])
    expect(rowOf('Morning · Story · Headline').row.getByTitle('from an agent')).toBeTruthy()
    expect(rowOf('Noon · Story · Headline').row.getByTitle('from the brief')).toBeTruthy()
  })

  it('the link toggle sets "use for every" for the next save', async () => {
    const { fake } = await show([row('L1')])
    const one = rowOf('Morning · Story · Headline')
    const link = one.row.getByRole('button', { name: LINK, pressed: false })
    await userEvent.click(link)
    expect(one.row.getByRole('button', { name: LINK, pressed: true })).toBe(link)
    await userEvent.type(one.field, '!')
    await userEvent.tab()
    await waitFor(() =>
      expect(sent(fake, 'translation.set')).toEqual([
        { projectId: P, layerId: 'L1', text: 'Frischer Kaffee!', applyToSameLanguage: true },
      ]),
    )
  })

  it('"Approve all" is disabled with "Nothing proposed" when no row is proposed', async () => {
    const { german } = await show([row('L1', { status: 'approved' })])
    const all = german.getByRole('button', { name: 'Approve all German' })
    expect(all).toHaveProperty('disabled', true)
    expect(all.getAttribute('title')).toBe('Nothing proposed')
    expect(all.textContent).toBe('Approve all')
  })

  it('"Translate again…" opens the run dialog and sends nothing before its confirm', async () => {
    const { fake, german } = await show([row('L1')])
    const again = german.getByRole('button', { name: 'Translate German again…' })
    expect(again.textContent).toBe('Translate again…')
    await userEvent.click(again)
    const dialog = within(await screen.findByRole('dialog', { name: 'Translate' }))
    expect(dialog.getByText(/^Paid: 1 request/)).toBeVisible()
    expect(sent(fake, 'translation.propose')).toEqual([])
  })

  it('a failed job stays on the page as "Failed: {sentence}" with Retry, which opens the run dialog', async () => {
    const { fake } = await show([row('L1')], [failedJob], (api) =>
      api.onQuery('job.get', () => ({
        ok: true,
        data: jobRow('J1', { kind: 'translation', status: 'failed', errorKind: 'quota' }),
      })),
    )
    const sentence = plainMessage('quota', 'Google Gemini')
    expect(await screen.findByText(`Failed: ${sentence}`)).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(await screen.findByRole('dialog', { name: 'Translate' })).toBeTruthy()
    expect(sent(fake, 'translation.propose')).toEqual([])
    expect(sent(fake, 'job.retry')).toEqual([])
  })

  it('a running job shows a spinner and "Stop" in the header; Stop sends job.cancel', async () => {
    const { fake, german } = await show([row('L1')], [{ ...failedJob, status: 'running' }])
    expect(screen.queryByText('Running…')).toBeNull()
    expect(german.getByTitle('Translating')).toBeTruthy()
    await userEvent.click(german.getByRole('button', { name: 'Stop' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: P, jobId: 'J1' }])
  })

  it('a refusal stays one line under its row', async () => {
    const { fake } = await show([row('L1')])
    fake.onCommand('translation.approve', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message: 'A text changed after you read it.' },
    }))
    const one = rowOf('Morning · Story · Headline')
    await userEvent.click(one.row.getByRole('button', { name: 'Proposed: approve' }))
    expect((await one.row.findByRole('alert')).textContent).toBe(
      'A text changed after you read it.',
    )
  })

  it('keeps the help line in an InfoTip "About Translations" and passes axe', async () => {
    await show(
      [
        row('L1'),
        row('L2', { title: 'Noon', status: 'approved', source: 'user' }),
        row('L3', { title: 'Night', status: 'missing', source: null, text: '' }),
      ],
      [{ ...failedJob, status: 'running' }],
    )
    const region = within(screen.getByRole('region', { name: 'Translations' }))
    await userEvent.click(region.getByRole('button', { name: 'About Translations' }))
    expect(region.getByText(/^These are the texts on the posts themselves\./)).toBeTruthy()
    expect(await axeViolations()).toEqual([])
  })
})
