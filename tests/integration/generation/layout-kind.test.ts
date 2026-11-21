// P4-7: the layout_proposal job kind with a stand-in layout adapter (spec/ai-jobs.md "Layout
// proposal", "The job"). The picture comes from the real render service over a stand-in draw.
import { describe, it, expect, afterEach } from 'vitest'
import { makeLayoutFixture, PICTURE, type LayoutFixture } from './layout-fixture'
import { waitFor } from './generation-fixture'
import type { LayoutBox } from '@/main/providers/types'

let f: LayoutFixture
afterEach(() => f.cleanup())

const box = (over: Partial<LayoutBox> = {}): LayoutBox => ({
  slot: 'cta',
  x: 100,
  y: 200,
  width: 300,
  height: 80,
  fontSize: 32,
  color: '#FF0000',
  align: 'center',
  ...over,
})

const ended = (id: string) => () => ['succeeded', 'failed', 'cancelled'].includes(f.job(id).status)

async function run(): Promise<string> {
  const id = await f.start()
  await waitFor(ended(id))
  return id
}

describe('layout_proposal job [spec/ai-jobs.md "Layout proposal"]', () => {
  it('draws the variant without its text layers, longest side 1024, before the call', async () => {
    f = await makeLayoutFixture()
    f.t.propose = async () => [box()]
    await run()
    expect(f.draw).toHaveBeenCalledTimes(1)
    const [scene, size] = f.draw.mock.calls[0] ?? []
    expect(scene?.layers.map((l) => l.type)).toEqual(['background'])
    expect(size).toEqual({ width: 819, height: 1024 })
    expect(f.calls[0]?.input.background).toEqual({ bytes: PICTURE, mime: 'image/png' })
  })

  it('sends items in z order, the palette, the fonts and the variant size, with the signal', async () => {
    f = await makeLayoutFixture()
    f.t.propose = async () => [box()]
    await run()
    const [call] = f.calls
    expect(call?.input).toMatchObject({
      width: 1080,
      height: 1350,
      items: [
        { slot: 'l-text', text: 'Hello' },
        { slot: 'cta', text: 'Buy now' },
      ],
      palette: ['#FF0000', '#0000FF'],
      fonts: ['Inter', 'Brand Sans'],
    })
    expect(call?.opts?.signal).toBeInstanceOf(AbortSignal)
  })

  it('keeps the clamped boxes as its result, and counts the paid call', async () => {
    f = await makeLayoutFixture()
    f.t.propose = async () => [
      box({ x: -5.4, width: 5000, color: '#EE1111', align: 'justify' as 'left' }),
      box({ slot: 'logo' }),
      box({ x: 1 }),
      box({ slot: 'l-text', y: 2000, fontSize: 9000, color: 'blue' }),
    ]
    const id = await run()
    const job = f.job(id)
    expect(job).toMatchObject({ status: 'succeeded', paidCalls: 1 })
    expect(job.result).toEqual({
      boxes: [
        {
          slot: 'cta',
          x: 0,
          y: 200,
          width: 1080,
          height: 80,
          fontSize: 32,
          color: '#FF0000',
          align: 'center',
        },
        {
          slot: 'l-text',
          x: 100,
          y: 1349,
          width: 300,
          height: 1,
          fontSize: 1350,
          color: null,
          align: 'center',
        },
      ],
    })
  })

  it.each<[string, LayoutBox[]]>([
    ['no box', []],
    ['only unknown keys', [box({ slot: 'logo' })]],
    ['only boxes with a number not finite', [box({ x: NaN })]],
  ])('fails as other when the answer has %s', async (_, boxes) => {
    f = await makeLayoutFixture()
    f.t.propose = async () => boxes
    const id = await run()
    expect(f.job(id)).toMatchObject({ status: 'failed', errorKind: 'other', errorReason: null })
    const detail = f.db.prepare('SELECT error_detail FROM job WHERE id = ?').get(id)
    expect(detail).toEqual({ error_detail: 'No usable layout in the answer' })
  })

  it('fails as other with no reason and makes no call when the draw fails', async () => {
    f = await makeLayoutFixture({
      draw: async () => {
        throw new Error('x')
      },
    })
    const id = await run()
    expect(f.job(id)).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: null,
      paidCalls: 0,
    })
    expect(f.calls).toEqual([])
  })

  it('ends target_gone with no draw and no call when the variant was deleted', async () => {
    f = await makeLayoutFixture({ jobsAtOnce: 1 })
    let release = () => {}
    f.t.propose = () =>
      new Promise((resolve) => {
        release = () => resolve([box()])
      })
    const first = await f.start()
    const second = await f.start()
    await waitFor(() => f.calls.length === 1)
    f.db.prepare('DELETE FROM variant WHERE id = ?').run('v1')
    release()
    await waitFor(ended(second))
    expect(f.job(second)).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: 'target_gone',
      paidCalls: 0,
    })
    expect(f.draw).toHaveBeenCalledTimes(1)
    expect(f.calls).toHaveLength(1)
    await waitFor(ended(first))
  })

  it('keeps no result when it is cancelled while the call runs', async () => {
    f = await makeLayoutFixture()
    let release = () => {}
    f.t.propose = () =>
      new Promise((resolve) => {
        release = () => resolve([box()])
      })
    const id = await f.start()
    await waitFor(() => f.calls.length === 1)
    const cancelling = f.user('job.cancel', { jobId: id })
    release()
    await cancelling
    await waitFor(ended(id))
    expect(f.job(id)).toMatchObject({ status: 'cancelled', result: null })
  })
})
