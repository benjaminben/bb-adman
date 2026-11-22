// spec/phases/phase-07-slices-2.md, P7-20: "Add clip…" lists the asset library's pictures and
// its MP4 and MOV videos (no WebM, no missing file); choosing one sends clip.add at the first
// free place. "Import…" goes through the picker and asset.import, then reads the list again.
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ClipTrack } from '@/renderer/editor/clip-track'
import { createVariantStore } from '@/renderer/stores/variant-store'
import { makeFakeApi } from '../fake-api'
import { axeViolations, renderApp } from '../render'
import { P, V, assetRow, variantGet } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'

const VIDEO_POST = variant(V, { format: 'video', durationMs: 8000 })
const LIBRARY = [
  assetRow('A1', { displayName: 'beach.png' }),
  assetRow('A2', { displayName: 'dunes.jpg', mime: 'image/jpeg' }),
  assetRow('A3', { kind: 'video', mime: 'video/mp4', displayName: 'wave.mp4' }),
  assetRow('A4', { kind: 'video', mime: 'video/quicktime', displayName: 'pier.mov' }),
  assetRow('A5', { kind: 'video', mime: 'video/webm', displayName: 'gulls.webm' }),
  assetRow('A6', { displayName: 'lost.png', missing: true }),
  assetRow('A8', { kind: 'font', mime: 'font/ttf', displayName: 'Sans.ttf' }),
]

async function setup() {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: variantGet({ variant: VIDEO_POST }) }))
  let library = LIBRARY
  fake.onQuery('asset.list', () => ({ ok: true, data: library }))
  const store = createVariantStore(fake.api, P, V)
  await store.getState().load()
  const view = await renderApp(
    <main>
      <ClipTrack projectId={P} variant={VIDEO_POST} store={store} />
    </main>,
    fake,
  )
  const sent = (name: string) => fake.commands.filter((c) => c.name === name).map((c) => c.input)
  const setLibrary = (rows: typeof LIBRARY) => {
    library = rows
  }
  return { ...view, fake, sent, setLibrary }
}

describe('AddClip: "Add clip…" [P7-20]', () => {
  it('lists the usable pictures and videos and sends clip.add for the one chosen', async () => {
    const { sent, fake } = await setup()
    const user = userEvent.setup()
    const open = screen.getByRole('button', { name: 'Add clip…' })
    expect(open).toHaveAttribute('aria-expanded', 'false')
    await user.click(open)
    const list = await screen.findByRole('list', { name: 'Pictures and videos' })
    const names = within(list)
      .getAllByRole('button')
      .map((b) => b.textContent)
    expect(names).toEqual(['beach.png', 'dunes.jpg', 'wave.mp4', 'pier.mov'])
    expect(fake.queries.find((q) => q.name === 'asset.list')?.input).toEqual({
      projectId: P,
      library: 'asset',
    })
    expect(await axeViolations()).toEqual([])
    await user.click(within(list).getByRole('button', { name: 'wave.mp4' }))
    expect(sent('clip.add')).toEqual([{ projectId: P, variantId: V, assetId: 'A3' }])
    expect(screen.queryByRole('list', { name: 'Pictures and videos' })).toBeNull()
  })

  it('imports through the picker and asset.import, then lists the new file', async () => {
    const { sent, fake, setLibrary } = await setup()
    const user = userEvent.setup()
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/clips/tide.mp4'] } }))
    fake.onCommand('asset.import', () => {
      setLibrary([
        ...LIBRARY,
        assetRow('A9', { kind: 'video', mime: 'video/mp4', displayName: 'tide.mp4' }),
      ])
      return { ok: true, data: { assetIds: ['A9'] } }
    })
    await user.click(screen.getByRole('button', { name: 'Add clip…' }))
    await user.click(await screen.findByRole('button', { name: 'Import…' }))
    expect(fake.queries.find((q) => q.name === 'dialog.pickFiles')?.input).toEqual({
      purpose: 'import',
      multiple: true,
    })
    expect(sent('asset.import')).toEqual([
      { projectId: P, paths: ['/clips/tide.mp4'], library: 'asset', copy: false },
    ])
    expect(await screen.findByRole('button', { name: 'tide.mp4' })).toBeInTheDocument()
  })

  it('sends nothing when the picker is cancelled, and says so when the library has nothing usable', async () => {
    const { sent, fake, setLibrary } = await setup()
    const user = userEvent.setup()
    setLibrary([])
    fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: [] } }))
    await user.click(screen.getByRole('button', { name: 'Add clip…' }))
    expect(
      await screen.findByText('No pictures or videos in the assets library yet.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Import…' }))
    expect(sent('asset.import')).toEqual([])
  })

  it('shows a refused clip.add as the sentence under the row', async () => {
    const { fake } = await setup()
    const user = userEvent.setup()
    const message = 'Use a picture, or an MP4 or MOV video, from the assets library.'
    fake.onCommand('clip.add', () => ({
      ok: false,
      error: { code: 'RULE_VIOLATION', message, details: { reason: 'clip_asset_not_usable' } },
    }))
    await user.click(screen.getByRole('button', { name: 'Add clip…' }))
    await user.click(await screen.findByRole('button', { name: 'beach.png' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
  })
})
