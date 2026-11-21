// spec/editor.md, "Thumbnails on the screens": VariantThumbnail asks thumbnail.get, waits for
// thumbnail.changed while pending, asks again on a new rev, shows the PNG through an object
// URL freed when replaced or removed, shows "No preview" on failed, and drops late answers.
import { act, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AppProvider } from '@/renderer/app/app-context'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { ThumbnailGet } from '@/shared/schemas/queries/render'
import type { Result } from '@/shared/schemas/result'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'

const PNG = new Uint8Array([137, 80, 78, 71])
const ready = (rev: number): Result<ThumbnailGet> => ({
  ok: true,
  data: { state: 'ready', rev, png: PNG },
})
const pending = (rev: number): Result<ThumbnailGet> => ({
  ok: true,
  data: { state: 'pending', rev },
})

let made = 0
const create = vi.fn(() => `blob:thumb-${++made}`)
const revoke = vi.fn()
const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL }

beforeEach(() => {
  made = 0
  create.mockClear()
  revoke.mockClear()
  URL.createObjectURL = create
  URL.revokeObjectURL = revoke
})
afterEach(() => {
  URL.createObjectURL = original.create
  URL.revokeObjectURL = original.revoke
})

// A fake api whose thumbnail.get answers with each queued reply in turn, the last one after.
function thumbApi(...replies: Array<Result<ThumbnailGet> | Promise<Result<ThumbnailGet>>>) {
  const fake = makeFakeApi()
  let i = 0
  fake.onQuery('thumbnail.get', () => replies[Math.min(i++, replies.length - 1)] as Result<unknown>)
  return fake
}

const asks = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'thumbnail.get')

function thumb(rev: number) {
  return (
    <main>
      <VariantThumbnail projectId="P1" variantId="V1" rev={rev} alt="Summer Splash, 1x1" />
    </main>
  )
}

// Draws the thumbnail again with a new rev, inside the same app context.
function newRev(view: Awaited<ReturnType<typeof renderApp>>, rev: number) {
  view.rerender(
    <AppProvider api={view.fake.api} store={view.store}>
      {thumb(rev)}
    </AppProvider>,
  )
}

describe('VariantThumbnail [spec/editor.md, Thumbnails on the screens]', () => {
  it('waits while pending, asks again on thumbnail.changed for its variant, then shows the PNG', async () => {
    const fake = thumbApi(pending(1), ready(1))
    await renderApp(thumb(1), fake)
    await waitFor(() => expect(asks(fake)).toHaveLength(1))
    expect(asks(fake)[0]?.input).toEqual({ projectId: 'P1', variantId: 'V1' })
    expect(screen.queryByRole('img')).toBeNull()
    expect(screen.queryByText('No preview')).toBeNull()
    act(() => fake.emit('thumbnail.changed', { projectId: 'P1', variantId: 'OTHER' }))
    act(() => fake.emit('thumbnail.changed', { projectId: 'P2', variantId: 'V1' }))
    expect(asks(fake)).toHaveLength(1)
    act(() => fake.emit('thumbnail.changed', { projectId: 'P1', variantId: 'V1' }))
    const img = await screen.findByRole('img', { name: 'Summer Splash, 1x1' })
    expect(img.getAttribute('src')).toBe('blob:thumb-1')
    expect(asks(fake)).toHaveLength(2)
  })

  it('asks again on a new rev and frees the replaced object URL, then the last on removal', async () => {
    const fake = thumbApi(ready(1), ready(2))
    const view = await renderApp(thumb(1), fake)
    await screen.findByRole('img')
    newRev(view, 2)
    await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).toBe('blob:thumb-2'))
    expect(asks(fake)).toHaveLength(2)
    expect(revoke.mock.calls).toEqual([['blob:thumb-1']])
    view.unmount()
    expect(revoke.mock.calls).toEqual([['blob:thumb-1'], ['blob:thumb-2']])
  })

  it.each<[string, Result<unknown>]>([
    ['failed', { ok: true, data: { state: 'failed', rev: 1 } }],
    ['refused', { ok: false, error: { code: 'NOT_FOUND', message: 'No such variant.' } }],
  ])('shows "No preview" and nothing else when the answer is %s', async (_, reply) => {
    const fake = makeFakeApi()
    fake.onQuery('thumbnail.get', () => reply)
    await renderApp(thumb(1), fake)
    expect(await screen.findByText('No preview')).toBeTruthy()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('drops a late answer for an older rev', async () => {
    let answerOld: (r: Result<ThumbnailGet>) => void = () => {}
    const old = new Promise<Result<ThumbnailGet>>((resolve) => (answerOld = resolve))
    const fake = thumbApi(old, ready(2))
    const view = await renderApp(thumb(1), fake)
    newRev(view, 2)
    await waitFor(() => expect(screen.getByRole('img').getAttribute('src')).toBe('blob:thumb-1'))
    await act(async () => answerOld(ready(1)))
    expect(screen.getByRole('img').getAttribute('src')).toBe('blob:thumb-1')
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('drops an answer that comes after it is removed', async () => {
    let answer: (r: Result<ThumbnailGet>) => void = () => {}
    const late = new Promise<Result<ThumbnailGet>>((resolve) => (answer = resolve))
    const view = await renderApp(thumb(1), thumbApi(late))
    view.unmount()
    await act(async () => answer(ready(1)))
    expect(create).not.toHaveBeenCalled()
  })

  it('has no axe violations with the picture shown', async () => {
    await renderApp(thumb(1), thumbApi(ready(1)))
    await screen.findByRole('img')
    expect(await axeViolations()).toEqual([])
  })
})
