// spec/screens-ai.md, "Attached jobs and the close warning" [D-036]: the dialog shown before a
// close that would leave attached jobs running. Jobs are registered through the store directly:
// no screen starts an attached job yet.
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { attachedStoreFor, variantJobs } from '@/renderer/stores/attached-store'
import type { JobKind } from '@/shared/config/job-kinds'
import { axeViolations, renderApp } from '../render'
import { baseState, makeFakeApi } from '../fake-api'
import { jobRow } from '../stores/job-fixture'

const FAKE = {
  id: 'fake',
  label: 'Fake provider',
  jobs: ['layout' as const, 'text' as const],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops' as const,
  serverText: false,
}

function Harness(props: { place: 'tab' | 'dialog'; onClosed: () => void }) {
  const { ask, warning } = useCloseWarning(props.place)
  return (
    <main>
      <h1>Campaign</h1>
      <button
        type="button"
        onClick={() => ask((s) => variantJobs(s, 'P1', ['V1']), props.onClosed)}
      >
        Close tab
      </button>
      {warning}
    </main>
  )
}

type Started = { id: string; kind: JobKind; provider: string }

async function draw(started: Started[], place: 'tab' | 'dialog' = 'tab') {
  const fake = makeFakeApi(baseState({ providers: [...baseState().providers, FAKE] }))
  const store = attachedStoreFor(fake.api)
  for (const job of started) {
    store.getState().register(job.id, { projectId: 'P1', variantId: 'V1' })
    act(() => fake.emit('job.updated', jobRow(job.id, { ...job, status: 'running' })))
  }
  const onClosed = vi.fn()
  const view = await renderApp(<Harness place={place} onClosed={onClosed} />, fake)
  await userEvent.click(screen.getByRole('button', { name: 'Close tab' }))
  return { ...view, onClosed, store }
}

const cancels = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.commands.filter((c) => c.name === 'job.cancel').map((c) => c.input)

describe('close warning [spec/screens-ai.md, D-036]', () => {
  it.each([
    ['layout_proposal', 'Stop placing text with AI?', 'Placing text with AI is still running.'],
    ['copy_options', 'Stop writing copy options?', 'Writing copy options is still running.'],
    ['brief_extraction', 'Stop reading the brief?', 'Reading the brief is still running.'],
  ] as const)('names one %s task', async (kind, title, start) => {
    await draw([{ id: 'J1', kind, provider: 'fake' }])
    const dialog = screen.getByRole('dialog', { name: title })
    expect(dialog).toHaveAccessibleDescription(`${start} Closing this tab stops it.`)
  })

  it('counts several tasks, and names the dialog it closes', async () => {
    await draw(
      [
        { id: 'J1', kind: 'layout_proposal', provider: 'fake' },
        { id: 'J2', kind: 'copy_options', provider: 'fake' },
      ],
      'dialog',
    )
    const dialog = screen.getByRole('dialog', { name: 'Stop 2 AI tasks?' })
    expect(dialog).toHaveAccessibleDescription(
      '2 AI tasks are still running. Closing this dialog stops them.',
    )
  })

  it.each([
    ['shows', 'gemini', true],
    ['leaves out', 'fake', false],
  ])('%s the paid line for a %s job', async (_, provider, shown) => {
    await draw([{ id: 'J1', kind: 'layout_proposal', provider }])
    const line = screen.queryByText('A request already sent may still be charged.')
    expect(line !== null).toBe(shown)
  })

  it('focuses "Keep open", which closes nothing and sends nothing', async () => {
    const { fake, onClosed, store } = await draw([
      { id: 'J1', kind: 'layout_proposal', provider: 'gemini' },
    ])
    const keep = screen.getByRole('button', { name: 'Keep open' })
    expect(keep).toHaveFocus()
    await userEvent.click(keep)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onClosed).not.toHaveBeenCalled()
    expect(cancels(fake)).toEqual([])
    expect(store.getState().jobs).toHaveLength(1)
  })

  it('Escape keeps it open too', async () => {
    const { onClosed } = await draw([{ id: 'J1', kind: 'layout_proposal', provider: 'fake' }])
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onClosed).not.toHaveBeenCalled()
  })

  it('"Stop and close" sends job.cancel for each job, then closes', async () => {
    const { fake, onClosed, store } = await draw([
      { id: 'J1', kind: 'layout_proposal', provider: 'gemini' },
      { id: 'J2', kind: 'copy_options', provider: 'fake' },
    ])
    onClosed.mockImplementation(() => expect(cancels(fake)).toHaveLength(2))
    await userEvent.click(screen.getByRole('button', { name: 'Stop and close' }))
    expect(cancels(fake)).toEqual([
      { projectId: 'P1', jobId: 'J1' },
      { projectId: 'P1', jobId: 'J2' },
    ])
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(store.getState().jobs).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes at once when no job of the owner is running', async () => {
    const { fake, onClosed } = await draw([])
    expect(onClosed).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(cancels(fake)).toEqual([])
  })

  it('has no accessibility violations', async () => {
    await draw([{ id: 'J1', kind: 'layout_proposal', provider: 'gemini' }])
    expect(await axeViolations()).toEqual([])
  })
})
