// R2E-8 (spec/phases/round-2-editor.md D6): a done video run's clip under the line, drawn by
// its asset address, with controls and no autoplay, and marked seen once when first drawn.
// The video rows of D6's table, each once.
import { act, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ClipPreview } from '@/renderer/editor/clip-preview'
import { RunStatus } from '@/renderer/editor/generate-fields/run-status'
import type { JobRow } from '@/shared/schemas/rows/job'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { CLIP, videoRow } from '../screens/campaign/video-fixture'
import { BACKGROUND, P } from './editor-fixture'

const done = (over: Record<string, unknown> = {}, row: Partial<JobRow> = {}) =>
  videoRow({ layerId: BACKGROUND.id, status: 'succeeded', result: { ...CLIP, ...over }, ...row })

describe('ClipPreview [R2E-8, D6]', () => {
  it('draws the clip by its asset address with controls, no autoplay, and marks it seen once', async () => {
    const fake = makeFakeApi()
    const row = done({ clipId: 'C9' })
    await renderApp(<ClipPreview projectId={P} row={row} />, fake)
    const clip = screen.getByLabelText('Video result')
    expect(clip.tagName).toBe('VIDEO')
    expect(clip).toHaveAttribute('src', `adman-asset://${P}/${CLIP.assetId}`)
    expect(clip).toHaveAttribute('controls')
    expect(clip).toHaveAttribute('preload', 'metadata')
    expect(clip).not.toHaveAttribute('autoplay')
    await act(async () => {})
    const seen = fake.commands.filter((c) => c.name === 'job.markSeen').map((c) => c.input)
    expect(seen).toEqual([{ projectId: P, jobIds: ['J1'] }])
  })

  it('sends no job.markSeen for a clip already seen', async () => {
    const fake = makeFakeApi()
    await renderApp(<ClipPreview projectId={P} row={done({}, { seenAt: 'x' })} />, fake)
    await act(async () => {})
    expect(fake.commands.filter((c) => c.name === 'job.markSeen')).toEqual([])
  })
})

const run = { jobId: 'J1', count: 1, kind: 'video' as const }

async function status(row: JobRow) {
  const fake = makeFakeApi()
  await renderApp(<RunStatus projectId={P} layerId={BACKGROUND.id} run={run} />, fake)
  act(() => fake.emit('job.updated', row))
  return fake
}

describe('RunStatus for a video [R2E-8, D6]', () => {
  it.each([
    ['waiting', videoRow({ status: 'queued' }), 'Making the video. Waiting.'],
    [
      'waiting in the queue',
      videoRow({ status: 'running', result: { stage: 'waiting', queuePosition: 2 } }),
      'Making the video. Waiting (place 2).',
    ],
    [
      'done, the still replaced',
      done({ clipId: 'C9', replacedStill: true }),
      'Done. The new clip is on the timeline below, in place of the still.',
    ],
    ['done, added', done({ clipId: 'C9' }), 'Done. The new clip is on the timeline below.'],
    [
      'done, not on the track',
      done({ clipId: null }),
      'Done, but the clip could not be put on the timeline. Add it with Add clip… on the timeline.',
    ],
    ['cancelled', videoRow({ status: 'cancelled' }), 'Cancelled.'],
  ])('says the words for a run %s', async (_name, row, words) => {
    await status(row)
    expect(await screen.findByText(words)).toBeVisible()
    expect(screen.getByText(words).closest('[aria-live="polite"]')).not.toBeNull()
  })

  it('says how long it has worked', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.parse('2026-11-21T00:01:30.000Z'))
    try {
      await status(videoRow({ status: 'running' }))
      expect(await screen.findByText('Making the video. Working, 1 min.')).toBeVisible()
    } finally {
      vi.useRealTimers()
    }
  })

  it('shows the clip under the line once done, and none before', async () => {
    const fake = makeFakeApi()
    await renderApp(<RunStatus projectId={P} layerId={BACKGROUND.id} run={run} />, fake)
    act(() => fake.emit('job.updated', videoRow({ status: 'running' })))
    expect(screen.queryByLabelText('Video result')).toBeNull()
    act(() => fake.emit('job.updated', done({ clipId: 'C9' })))
    expect(await screen.findByLabelText('Video result')).toBeInTheDocument()
    act(() =>
      fake.emit('job.updated', done({ clipId: 'C9' }, { updatedAt: '2026-11-21T00:02:00.000Z' })),
    )
    await act(async () => {})
    expect(fake.commands.filter((c) => c.name === 'job.markSeen')).toHaveLength(1)
  })
})
