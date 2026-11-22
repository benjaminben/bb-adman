// P4-17 (spec/screens-ai.md, "Copy options"; spec/ai-jobs.md, "Copy options") [REQ: FR-045]:
// the dialog shows the layer's newest succeeded copy options, makes new ones through the run
// dialog, and uses one with layer.update { copy }. Provider text is drawn as plain text.
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { CopyOptionsDialog } from '@/renderer/dialogs/copy-options-dialog'
import { attachedStoreFor, dialogJobs } from '@/renderer/stores/attached-store'
import type { JobRow } from '@/shared/schemas/rows/job'
import { axeViolations, renderApp } from '../render'
import { makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'
import { layer } from '../editor/editor-fixture'

const TAGLINE = layer({ id: 'L3', variantId: 'V1', type: 'text', name: 'Tagline', slot: 'tag' })
const REQUEST = { role: 'text', language: 'en', count: 3, maxChars: 120 }

const copyJob = (id: string, over: Partial<JobRow> = {}) =>
  jobRow(id, {
    kind: 'copy_options',
    layerId: 'L3',
    slot: 'tag',
    request: REQUEST,
    createdAt: `2026-11-21T00:00:0${id.slice(1)}.000Z`,
    ...over,
  })

const OLD = copyJob('J1', {
  status: 'succeeded',
  result: { options: ['Old one'] },
  seenAt: 'x',
})
const NEWEST_DONE = copyJob('J2', {
  status: 'succeeded',
  result: { options: ['Chill out', '<b>Bold</b> & cold'] },
})
const NEWER_FAILED = copyJob('J3', { status: 'failed', errorKind: 'timeout' })
const PICTURE = jobRow('J4', { layerId: 'L3', status: 'succeeded', result: { assetIds: [] } })

async function open(rows: JobRow[] = [PICTURE, NEWER_FAILED, NEWEST_DONE, OLD]) {
  const fake = makeFakeApi()
  fake.onQuery('job.list', () => ({ ok: true, data: rows }))
  fake.onCommand('generation.copyOptions', () => ({ ok: true, data: { jobId: 'J9' } }))
  fake.onCommand('job.retry', () => ({ ok: true, data: { jobId: 'J8' } }))
  const onClose = vi.fn()
  const view = await renderApp(
    <CopyOptionsDialog open projectId="P1" layer={TAGLINE} onClose={onClose} />,
    fake,
  )
  await screen.findByRole('dialog', { name: 'Copy options for Tagline' })
  await act(async () => {})
  return { ...view, onClose }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

async function startRun(fake: ReturnType<typeof makeFakeApi>) {
  await userEvent.click(screen.getByRole('button', { name: 'Make new options…' }))
  const run = await screen.findByRole('dialog', { name: 'Suggest copy' })
  expect(within(run).getByRole('spinbutton', { name: 'Options' })).toHaveValue(4)
  await userEvent.click(within(run).getByRole('button', { name: 'Suggest copy' }))
  await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Suggest copy' })).toBeNull())
  act(() => fake.emit('job.updated', copyJob('J9', { status: 'running' })))
}

describe('CopyOptionsDialog [spec/screens-ai.md "Copy options", FR-045]', () => {
  it('reads job.list for the layer and shows the newest succeeded options as plain text', async () => {
    const { fake } = await open()
    expect(fake.queries).toContainEqual({
      name: 'job.list',
      input: { projectId: 'P1', layerId: 'L3' },
    })
    const items = screen.getAllByRole('listitem')
    expect(items.map((i) => i.querySelector('p')?.textContent)).toEqual([
      'Chill out',
      '<b>Bold</b> & cold',
    ])
    expect(document.querySelector('b')).toBeNull()
    expect(screen.queryByText('Old one')).toBeNull()
  })

  it('marks the shown options seen once; options already seen are not marked again', async () => {
    const { fake } = await open()
    expect(sent(fake, 'job.markSeen')).toEqual([{ projectId: 'P1', jobIds: ['J2'] }])
    const second = await open([OLD])
    expect(sent(second.fake, 'job.markSeen')).toEqual([])
  })

  it('with no earlier options it says so and offers to make some', async () => {
    await open([])
    expect(screen.getByText('No options yet.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Make new options…' })).toBeEnabled()
  })

  it('Make new options goes through the run dialog to generation.copyOptions and attaches the job', async () => {
    const { fake } = await open()
    await startRun(fake)
    expect(sent(fake, 'generation.copyOptions')).toEqual([
      { projectId: 'P1', variantId: 'V1', layerId: 'L3', count: 4, provider: 'gemini' },
    ])
    const store = attachedStoreFor(fake.api).getState()
    expect(dialogJobs(store, 'copy-options:L3').map((j) => j.jobId)).toEqual(['J9'])
    expect(screen.getByText('Writing options…')).toBeInTheDocument()
    expect(screen.queryByText('Chill out')).toBeNull()
    expect(screen.getByRole('button', { name: 'Make new options…' })).toBeDisabled()
  })

  it('Stop sends job.cancel for the running job', async () => {
    const { fake } = await open()
    await startRun(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: 'P1', jobId: 'J9' }])
    act(() => fake.emit('job.updated', copyJob('J9', { status: 'cancelled' })))
    expect(screen.queryByText('Writing options…')).toBeNull()
    expect(screen.getByText('Chill out')).toBeInTheDocument()
  })

  it('shows the new options when the job succeeds, marks them seen, and "Use this text" sends layer.update and closes', async () => {
    const { fake, onClose } = await open()
    await startRun(fake)
    const done = copyJob('J9', { status: 'succeeded', result: { options: ['Ice ice', 'Brrr'] } })
    act(() => fake.emit('job.updated', done))
    expect(await screen.findByText('Brrr')).toBeInTheDocument()
    await waitFor(() =>
      expect(sent(fake, 'job.markSeen')).toContainEqual({ projectId: 'P1', jobIds: ['J9'] }),
    )
    const use = screen.getAllByRole('button', { name: 'Use this text' })[1]!
    expect(use).toHaveAccessibleDescription('Brrr')
    await userEvent.click(use)
    expect(sent(fake, 'layer.update')).toEqual([
      { projectId: 'P1', layerId: 'L3', patch: { copy: 'Brrr' } },
    ])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('a refused layer.update shows its message and keeps the dialog open', async () => {
    const { fake, onClose } = await open()
    fake.onCommand('layer.update', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That layer is locked.' },
    }))
    await userEvent.click(screen.getAllByRole('button', { name: 'Use this text' })[0]!)
    expect(await screen.findByRole('alert')).toHaveTextContent('That layer is locked.')
    expect(onClose).not.toHaveBeenCalled()
  })

  it('a failed run shows its sentence and "Retry" sends job.retry through the run dialog', async () => {
    const { fake } = await open()
    await startRun(fake)
    act(() => fake.emit('job.updated', copyJob('J9', { status: 'failed', errorKind: 'timeout' })))
    expect(
      await screen.findByText('Google Gemini took too long to answer. Try again.'),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }))
    const retry = await screen.findByRole('dialog', { name: 'Retry the run' })
    expect(within(retry).getByText('Options: 3')).toBeInTheDocument()
    await userEvent.click(within(retry).getByRole('button', { name: 'Retry' }))
    expect(sent(fake, 'job.retry')).toEqual([{ projectId: 'P1', jobId: 'J9' }])
    act(() => fake.emit('job.updated', copyJob('J8', { status: 'running' })))
    expect(await screen.findByText('Writing options…')).toBeInTheDocument()
  })

  it.each([
    ['Close button', () => userEvent.click(screen.getByRole('button', { name: 'Close' }))],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('closing by %s with nothing running closes at once', async (_, close) => {
    const { onClose } = await open()
    await close()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closing while the job runs warns; "Keep open" keeps it, "Stop and close" stops and closes', async () => {
    const { fake, onClose } = await open()
    await startRun(fake)
    await userEvent.keyboard('{Escape}')
    const warning = await screen.findByRole('dialog', { name: 'Stop writing copy options?' })
    expect(warning).toHaveAccessibleDescription(
      'Writing copy options is still running. Closing this dialog stops it.',
    )
    await userEvent.click(within(warning).getByRole('button', { name: 'Keep open' }))
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Copy options for Tagline' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    const again = await screen.findByRole('dialog', { name: 'Stop writing copy options?' })
    await userEvent.click(within(again).getByRole('button', { name: 'Stop and close' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: 'P1', jobId: 'J9' }])
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('has no accessibility violations, with options and while running', async () => {
    const { fake } = await open()
    expect(await axeViolations()).toEqual([])
    await startRun(fake)
    expect(await axeViolations()).toEqual([])
  })
})
