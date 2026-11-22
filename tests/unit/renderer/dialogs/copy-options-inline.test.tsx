// DLG-4b (C-15): copy options draws its run setup inside its own body, with no dialog inside
// it. The cost line is last above the foot and in the description at the click; "Generate" is
// the one click that sends generation.copyOptions, once. Opening, "New options" and choosing an
// option send nothing; "Use" sends only layer.update. No provider is called.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyOptionsDialog } from '@/renderer/dialogs/copy-options-dialog'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { costLine, spoken } from '../cost-line'
import { baseState, makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { heldReply } from '../screens/campaign/held-reply'
import { jobRow } from '../stores/job-fixture'
import { layer } from '../editor/editor-fixture'

const TAGLINE = layer({ id: 'L3', variantId: 'V1', type: 'text', name: 'Tagline', slot: 'tag' })
const FAKE: ProviderInfo = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['image', 'text'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}
const PAID = 'Paid: 1 request → Google Gemini'

const copyJob = (id: string, over: Partial<JobRow> = {}) =>
  jobRow(id, {
    kind: 'copy_options',
    layerId: 'L3',
    slot: 'tag',
    request: { role: 'text', language: 'en', count: 3, maxChars: 120 },
    ...over,
  })
const DONE = copyJob('J2', { status: 'succeeded', result: { options: ['Chill out', 'Brrr'] } })

function described() {
  const ids = screen.getByRole('dialog').getAttribute('aria-describedby') ?? ''
  return ids.split(' ').map((id) => document.getElementById(id)?.textContent ?? '')
}

async function open(rows: JobRow[] = [DONE]) {
  const base = baseState()
  const fake = makeFakeApi(baseState({ providers: [...base.providers, FAKE] }))
  const atClick: string[][] = []
  fake.onQuery('job.list', () => ({ ok: true, data: rows }))
  fake.onCommand('generation.copyOptions', () => {
    atClick.push(described())
    return { ok: true, data: { jobId: 'J9' } }
  })
  const onClose = vi.fn()
  await renderApp(<CopyOptionsDialog open projectId="P1" layer={TAGLINE} onClose={onClose} />, fake)
  const dialog = await screen.findByRole('dialog', { name: 'Copy options for Tagline' })
  await act(async () => {})
  return { fake, dialog, onClose, atClick }
}

const names = (fake: ReturnType<typeof makeFakeApi>) => fake.commands.map((c) => c.name)
const generate = () => screen.getByRole('button', { name: 'Generate' })

describe('Copy options, the inline run [DLG-4b, C-15]', () => {
  it('with no options draws the setup in its own body, no dialog inside, nothing sent', async () => {
    const { fake, dialog } = await open([])
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog).getByRole('radio', { name: 'Google Gemini' })).toBeChecked()
    expect(within(dialog).getByRole('spinbutton', { name: 'Options' })).toHaveValue(4)
    expect(within(dialog).getByText(costLine(PAID))).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(spoken(PAID))
    expect(generate()).toBeEnabled()
    expect(fake.commands).toEqual([])
    expect(await axeViolations()).toEqual([])
  })

  it('choosing an option sends nothing; "Use" sends only layer.update and closes', async () => {
    const { fake, dialog, onClose } = await open()
    const before = names(fake)
    expect(before).toEqual(['job.markSeen'])
    const use = within(dialog).getByRole('button', { name: 'Use' })
    expect(use).toBeDisabled()
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Brrr' }))
    expect(names(fake)).toEqual(before)
    await userEvent.click(use)
    expect(fake.commands.slice(1)).toEqual([
      { name: 'layer.update', input: { projectId: 'P1', layerId: 'L3', patch: { copy: 'Brrr' } } },
    ])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('"New options" shows the setup in place and sends nothing', async () => {
    const { fake, dialog } = await open()
    const before = names(fake)
    const newOptions = within(dialog).getByRole('button', { name: 'Make new options…' })
    expect(newOptions).toHaveTextContent('New options')
    await userEvent.click(newOptions)
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog).getByText(costLine(PAID))).toBeVisible()
    expect(names(fake)).toEqual(before)
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(within(dialog).queryByText(costLine(PAID))).toBeNull()
    expect(within(dialog).getByRole('radio', { name: 'Chill out' })).toBeInTheDocument()
    expect(names(fake)).toEqual(before)
  })

  it('one Generate click sends one generation.copyOptions with the count and provider shown', async () => {
    const { fake, dialog, atClick } = await open([])
    const held = heldReply()
    fake.onCommand('generation.copyOptions', () => {
      atClick.push(described())
      return held.answer()
    })
    const count = within(dialog).getByRole('spinbutton', { name: 'Options' })
    await userEvent.clear(count)
    await userEvent.type(count, '2')
    expect(within(dialog).getByText(costLine(PAID))).toBeVisible()
    await userEvent.click(generate())
    expect(generate()).toBeDisabled()
    await userEvent.click(generate())
    expect(fake.commands).toEqual([
      {
        name: 'generation.copyOptions',
        input: { projectId: 'P1', variantId: 'V1', layerId: 'L3', count: 2, provider: 'gemini' },
      },
    ])
    expect(atClick).toEqual([[spoken(PAID)]])
    held.release({ ok: true, data: { jobId: 'J9' } })
    expect(await screen.findByText('Writing options…')).toBeInTheDocument()
  })

  it('a free provider draws its plain line, no MoneyLine, and sends to it', async () => {
    const { fake, dialog } = await open([])
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Fake provider' }))
    const free = 'This uses the fake provider. Nothing is charged.'
    expect(within(dialog).getByText(free)).toBeVisible()
    expect(within(dialog).queryByText(/Paid/)).toBeNull()
    expect(dialog).toHaveAccessibleDescription(free)
    await userEvent.click(generate())
    await waitFor(() => expect(names(fake)).toEqual(['generation.copyOptions']))
    expect(fake.commands[0]?.input).toMatchObject({ provider: 'fake', count: 4 })
  })

  it('Retry draws the failed run inline and sends one job.retry on its click', async () => {
    const failed = copyJob('J3', { status: 'failed', errorKind: 'timeout', provider: 'gemini' })
    const { fake, dialog } = await open([])
    await userEvent.click(generate())
    act(() => fake.emit('job.updated', { ...failed, id: 'J9' }))
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Retry' }))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
    expect(within(dialog).getByText('Provider: Google Gemini')).toBeInTheDocument()
    expect(within(dialog).getByText('Options: 3')).toBeInTheDocument()
    expect(within(dialog).getByText(costLine(PAID))).toBeVisible()
    expect(dialog).toHaveAccessibleDescription(spoken(PAID))
    expect(names(fake)).toEqual(['generation.copyOptions'])
    expect(await axeViolations()).toEqual([])
    const held = heldReply()
    fake.onCommand('job.retry', held.answer)
    const retry = within(dialog).getByRole('button', { name: 'Retry' })
    await userEvent.click(retry)
    expect(retry).toBeDisabled()
    await userEvent.click(retry)
    expect(fake.commands.slice(1)).toEqual([
      { name: 'job.retry', input: { projectId: 'P1', jobId: 'J9' } },
    ])
    held.release({ ok: true, data: { jobId: 'J8' } })
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull())
  })
})
