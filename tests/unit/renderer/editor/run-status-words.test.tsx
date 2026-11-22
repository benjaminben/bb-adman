// spec/phases/round-2-editor.md D6, "In the editor" (R2E-5): the line under "Generate…" for a
// picture run, one row of the D6 table each, aria-live="polite".
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { RunStatus } from '@/renderer/editor/generate-fields/run-status'
import { placedRunsFor } from '@/renderer/stores/placed-runs'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { campaignApi } from '../screens/campaign/campaign-fixture'
import { jobRow } from '../stores/job-fixture'
import { BACKGROUND, LOGO, P, V, variantGet } from './editor-fixture'

const PLACED = 'Done. The first new picture is on the layer. Click another below to use it instead.'
const CLICK = 'Done. Click a new picture below to put it on the layer.'
const NONE = 'The run ended with no pictures.'

const row = (over: Partial<JobRow>) => jobRow('J1', { layerId: LOGO.id, slot: null, ...over })
const kept = (assetIds: string[]) => ({
  status: 'succeeded' as const,
  result: { assetIds, failures: {} },
})

async function open(count: number, wasEmpty: boolean | null) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: variantGet() }))
  if (wasEmpty !== null) {
    placedRunsFor(fake.api).register('J1', {
      projectId: P,
      variantId: V,
      layerId: LOGO.id,
      wasEmpty,
    })
  }
  await renderApp(<RunStatus projectId={P} layerId={LOGO.id} run={{ jobId: 'J1', count }} />, fake)
  return fake
}

describe('RunStatus words [spec/phases/round-2-editor.md D6]', () => {
  it.each([
    [1, 'queued', 'Making 1 picture…'],
    [3, 'queued', 'Making 3 pictures…'],
    [4, 'running', 'Making 4 pictures…'],
  ] as const)('a run of %i that is %s says "%s"', async (count, status, words) => {
    const fake = await open(count, null)
    act(() => fake.emit('job.updated', row({ status })))
    expect(await screen.findByText(words)).toBeVisible()
  })

  it.each([
    ['put on the empty layer', true, kept(['A5', 'A6']), PLACED],
    ['the layer had a picture', false, kept(['A5']), CLICK],
    ['a run this window did not start', null, kept(['A5']), CLICK],
    ['nothing kept', true, kept([]), NONE],
  ] as const)('a run done, %s', async (_name, wasEmpty, over, words) => {
    const fake = await open(2, wasEmpty)
    act(() => fake.emit('job.updated', row(over)))
    expect(await screen.findByText(words)).toBeVisible()
    expect(screen.getByText(words).closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('keeps "Making…" until the first picture is on the layer', async () => {
    const fake = await open(2, true)
    let answer: (v: unknown) => void = () => {}
    fake.onCommand('layer.update', () => new Promise((r) => (answer = r)) as never)
    act(() => fake.emit('job.updated', row(kept(['A5']))))
    await act(() => new Promise((r) => setTimeout(r, 0)))
    expect(screen.getByText('Making 2 pictures…')).toBeVisible()
    await act(async () => answer({ ok: true, data: null }))
    expect(await screen.findByText(PLACED)).toBeVisible()
  })
})

describe('GenerateFields registers its run with whether the layer was empty [D6]', () => {
  it.each([
    ['an empty layer gets the first picture', LOGO, PLACED, 1],
    ['a layer with a picture keeps it', BACKGROUND, CLICK, 0],
  ] as const)('%s', async (_name, layer, words, updates) => {
    const fake = campaignApi()
    fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
    fake.onQuery('variant.get', () => ({ ok: true, data: variantGet() }))
    fake.onCommand('generation.runImages', () => ({ ok: true, data: { jobId: 'J1' } }))
    await renderApp(<GenerateFields projectId={P} campaignId="C1" layer={layer} />, fake)
    await screen.findByText('None chosen')
    await userEvent.click(screen.getByRole('button', { name: 'Generate…' }))
    const dialog = await screen.findByRole('dialog', { name: 'Make pictures' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    act(() => fake.emit('job.updated', jobRow('J1', { layerId: layer.id, ...kept(['A5']) })))
    expect(await screen.findByText(words)).toBeVisible()
    expect(fake.commands.filter((c) => c.name === 'layer.update')).toHaveLength(updates)
  })
})
