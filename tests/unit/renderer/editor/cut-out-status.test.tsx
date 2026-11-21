// The cut-out line's job row (spec/screens-ai.md "Cut-out"; P4-T3): a job.list reply that is not
// newer than the row job.updated already gave is dropped, as the job store does (F-10). On a
// tie, a finished held row is not turned back to "Cutting out…" by a listed running row.
import { act, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CutOutStatus } from '@/renderer/editor/picture-fields/cut-out-status'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { jobRow } from '../stores/job-fixture'
import { P } from './editor-fixture'

const AT = '2026-11-21T00:00:01.000Z'
const cut = (status: JobRow['status'], updatedAt: string) =>
  jobRow('J1', { kind: 'cutout', status, layerId: 'L2', updatedAt })

describe('CutOutStatus keeps the row it holds unless the listed row is newer', () => {
  it.each([
    ['an equal time: the finished row it holds wins', AT, 'Done.'],
    ['an older listed row', '2026-11-21T00:00:00.000Z', 'Done.'],
  ])('%s', async (_c, listedAt, words) => {
    const fake = makeFakeApi()
    let answer: (r: Result<unknown>) => void = () => {}
    fake.onQuery('job.list', () => new Promise((resolve) => (answer = resolve)))
    await renderApp(<CutOutStatus projectId={P} layerId="L2" jobId="J1" />, fake)
    act(() => fake.emit('job.updated', cut('succeeded', AT)))
    await act(async () => answer({ ok: true, data: [cut('running', listedAt)] }))
    expect(screen.getByText(new RegExp(`^${words}`))).toBeInTheDocument()
    expect(screen.queryByText('Cutting out…')).toBeNull()
  })

  it('takes a newer listed row', async () => {
    const fake = makeFakeApi()
    let answer: (r: Result<unknown>) => void = () => {}
    fake.onQuery('job.list', () => new Promise((resolve) => (answer = resolve)))
    await renderApp(<CutOutStatus projectId={P} layerId="L2" jobId="J1" />, fake)
    act(() => fake.emit('job.updated', cut('running', AT)))
    await act(async () =>
      answer({ ok: true, data: [cut('succeeded', '2026-11-21T00:00:02.000Z')] }),
    )
    expect(screen.getByText(/^Done\./)).toBeInTheDocument()
  })
})
