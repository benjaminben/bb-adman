// spec/screens-ai.md, "Place text with AI" [FR-061, workflow 5.1 step 6] (P4-16): the top bar's
// button, the run dialog, the attached job and its banner line, and the finish step that moves
// the text layers with one layer.updateMany, also when the tab is not the one shown.
import '../../shared/scene/fake-fonts'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import { layoutPatches } from '@/shared/generation/layout-patches'
import type { LayoutJobBox } from '@/shared/schemas/jobs/layout-proposal'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import { BACKGROUND, HEADLINE, LOGO, P, V, variantGet } from './editor-fixture'

const BOXES: LayoutJobBox[] = [
  {
    slot: 'L1',
    x: 40,
    y: 60,
    width: 1000,
    height: 240,
    fontSize: 96,
    color: '#FFFFFF',
    align: 'left',
  },
  { slot: 'gone', x: 0, y: 0, width: 10, height: 10, fontSize: 9, color: null, align: 'center' },
]
const TARGET = { projectId: P, variantId: V }
const BUTTON = 'Place text with AI…'

const row = (status: JobRow['status'], over: Partial<JobRow> = {}) =>
  jobRow('J1', {
    kind: 'layout_proposal',
    status,
    variantId: V,
    slot: null,
    request: {},
    result: status === 'succeeded' ? { boxes: BOXES } : null,
    ...over,
  })

async function open(reply: VariantGet = variantGet()) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  fake.onQuery('job.get', () => ({ ok: true, data: row('succeeded') }))
  fake.onCommand('generation.proposeLayout', () => ({ ok: true, data: { jobId: 'J1' } }))
  const view = await renderApp(<Editor projectId={P} variantId={V} />, fake)
  await screen.findByRole('heading', { name: 'Master post' })
  return { ...view, fake }
}

const sent = (fake: ReturnType<typeof makeFakeApi>, name: string) =>
  fake.commands.filter((c) => c.name === name).map((c) => c.input)

async function start(fake: ReturnType<typeof makeFakeApi>) {
  await userEvent.click(screen.getByRole('button', { name: BUTTON }))
  const dialog = await screen.findByRole('dialog', { name: 'Place text with AI' })
  expect(dialog).toHaveTextContent('This sends 1 paid request to Google Gemini.')
  await userEvent.click(screen.getByRole('button', { name: 'Place text' }))
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  expect(sent(fake, 'generation.proposeLayout')).toEqual([{ ...TARGET, provider: 'gemini' }])
}

describe('Place text with AI [spec/screens-ai.md "Place text with AI", P4-16]', () => {
  it.each([
    ['blank copy', { ...HEADLINE, copy: '  ' }],
    ['a hidden text layer', { ...HEADLINE, visible: false }],
  ])('is disabled with the hint when the variant has no text to place: %s', async (_c, text) => {
    await open(variantGet({ layers: [BACKGROUND, text, LOGO] }))
    const button = screen.getByRole('button', { name: BUTTON })
    expect(button).toBeDisabled()
    expect(button).toHaveAccessibleDescription('Add text to a text layer first.')
  })

  it('opens the run dialog, sends generation.proposeLayout and shows the banner line', async () => {
    const { fake } = await open()
    expect(screen.getByRole('button', { name: BUTTON })).toBeEnabled()
    await start(fake)
    expect(screen.getByRole('status')).toHaveTextContent('Placing text with AI…')
    expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(await axeViolations()).toEqual([])
  })

  it('is disabled while the run it started is going, and enabled again when it ends', async () => {
    const { fake } = await open()
    await start(fake)
    expect(screen.getByRole('button', { name: BUTTON })).toBeDisabled()
    fake.emit('job.updated', row('succeeded'))
    await waitFor(() => expect(screen.getByRole('button', { name: BUTTON })).toBeEnabled())
  })

  it('Cancel in the dialog sends nothing', async () => {
    const { fake } = await open()
    await userEvent.click(screen.getByRole('button', { name: BUTTON }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))
    expect(sent(fake, 'generation.proposeLayout')).toEqual([])
  })

  it('registers the job as attached to the variant tab, with a finish step', async () => {
    const { fake } = await open()
    await start(fake)
    const jobs = attachedStoreFor(fake.api).getState().jobs
    expect(jobs.map((j) => [j.jobId, j.owner])).toEqual([['J1', TARGET]])
  })

  it('on success sends one layer.updateMany built by layoutPatches and drops the line', async () => {
    const { fake } = await open()
    await start(fake)
    fake.emit('job.updated', row('succeeded'))
    const updates = layoutPatches(BOXES, [BACKGROUND, HEADLINE, LOGO])
    await waitFor(() => expect(sent(fake, 'layer.updateMany')).toEqual([{ ...TARGET, updates }]))
    expect(updates).toHaveLength(1)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('applies on success while another tab is shown (the editor is gone)', async () => {
    const { fake, unmount } = await open()
    await start(fake)
    unmount()
    fake.emit('job.updated', row('succeeded'))
    await waitFor(() => expect(sent(fake, 'layer.updateMany')).toHaveLength(1))
  })

  it('a cancelled job sends nothing; Stop sends job.cancel and forgets the job', async () => {
    const { fake } = await open()
    await start(fake)
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }))
    expect(sent(fake, 'job.cancel')).toEqual([{ projectId: P, jobId: 'J1' }])
    expect(attachedStoreFor(fake.api).getState().jobs).toEqual([])
    fake.emit('job.updated', row('cancelled'))
    fake.emit('job.updated', row('succeeded'))
    await new Promise((r) => setTimeout(r, 10))
    expect(sent(fake, 'layer.updateMany')).toEqual([])
    expect(screen.queryByRole('status')).toBeNull()
  })

  it.each([
    [
      'no reason',
      {},
      'Text could not be placed. Google Gemini could not finish this request. Try again.',
    ],
    [
      'a local reason',
      { errorKind: 'other' as const, errorReason: 'key_missing' as const },
      'Text could not be placed. Your Google Gemini key was removed after this run was queued. Add it in Settings, then try again.',
    ],
  ])('a failure shows its sentence with Dismiss: %s', async (_c, over, words) => {
    const { fake } = await open()
    await start(fake)
    fake.emit('job.updated', row('failed', { errorKind: 'other', ...over }))
    expect(await screen.findByRole('status')).toHaveTextContent(words)
    expect(sent(fake, 'layer.updateMany')).toEqual([])
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows a failure whose row came before the reply', async () => {
    const { fake } = await open()
    fake.onCommand('generation.proposeLayout', () => {
      fake.emit('job.updated', row('failed', { errorKind: 'other' }))
      return { ok: true, data: { jobId: 'J1' } }
    })
    await start(fake)
    expect(await screen.findByRole('status')).toHaveTextContent(/^Text could not be placed\./)
  })

  it.each([
    ['layer.updateMany is refused', 'layer.updateMany'],
    ['variant.get is refused', 'variant.get'],
  ])('drops the result quietly when the variant was deleted: %s', async (_c, refused) => {
    const { fake, store } = await open()
    await start(fake)
    const notFound = {
      ok: false as const,
      error: { code: 'NOT_FOUND' as const, message: 'That variant was not found.' },
    }
    if (refused === 'variant.get') fake.onQuery('variant.get', () => notFound)
    else fake.onCommand('layer.updateMany', () => notFound)
    fake.emit('job.updated', row('succeeded'))
    await waitFor(() => expect(fake.queries.some((q) => q.name === 'job.get')).toBe(true))
    await new Promise((r) => setTimeout(r, 10))
    expect(store.getState().error).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows another refusal of layer.updateMany in the banner', async () => {
    const { fake } = await open()
    await start(fake)
    fake.onCommand('layer.updateMany', () => ({
      ok: false,
      error: { code: 'INVALID_INPUT', message: 'That layer is locked.' },
    }))
    fake.emit('job.updated', row('succeeded'))
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Text could not be placed. That layer is locked.',
      ),
    )
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument()
  })

  // spec/jobs.md "Finished, not yet looked at" [FR-218] (P4-T3): the window marks the job seen
  // once, when the finish step has put its result on the layers. No mark for a failed or
  // cancelled job, or a result that could not be put on the layers.
  it.each<[string, JobRow['status'], boolean, number]>([
    ['a result put on the layers, sent once', 'succeeded', false, 1],
    ['a failed job', 'failed', false, 0],
    ['a cancelled job', 'cancelled', false, 0],
    ['a result whose layer.updateMany is refused', 'succeeded', true, 0],
  ])('job.markSeen for %s', async (_c, status, refuse, marks) => {
    const { fake } = await open()
    await start(fake)
    if (refuse) {
      const error = { code: 'INVALID_INPUT' as const, message: 'That layer is locked.' }
      fake.onCommand('layer.updateMany', () => ({ ok: false, error }))
    }
    fake.emit('job.updated', row(status, { errorKind: status === 'failed' ? 'other' : null }))
    fake.emit('job.updated', row(status, { errorKind: status === 'failed' ? 'other' : null }))
    if (status === 'succeeded') {
      await waitFor(() => expect(sent(fake, 'layer.updateMany')).toHaveLength(1))
    }
    await new Promise((r) => setTimeout(r, 10))
    const expected = { projectId: P, jobIds: ['J1'] }
    expect(sent(fake, 'job.markSeen')).toEqual(Array(marks).fill(expected))
  })
})
