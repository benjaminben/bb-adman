// Z-1b fix 4: the chosen clip's bar sits fully above its block, outside it, its right end at the
// block's right end, inside the lane. A place box spans the lane from its left edge to the
// block's right end and holds the bar at its right end (it grows to the right only when the bar
// is wider than the room left of the block's end). The block keeps its size; the commands are
// the same. The bar's height above the block is checked in a real window by dw-z-1b.shots.ts.
import '../../shared/scene/fake-fonts'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ClipTrack } from '@/renderer/editor/clip-track'
import { createVariantStore } from '@/renderer/stores/variant-store'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { P, V, assetRow, variantGet } from './editor-fixture'
import { variant } from '../screens/campaign/campaign-fixture'

const POST = variant(V, { format: 'video', durationMs: 8000 })
const WAVE = assetRow('A7', { kind: 'video', mime: 'video/mp4', displayName: 'wave.mp4' })
const CLIP: BackgroundClipRow = {
  id: 'K1',
  variantId: V,
  assetId: 'A7',
  startMs: 2000,
  inMs: 0,
  outMs: 1000,
  placement: null,
  soundOn: true,
}

async function draw() {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({
    ok: true,
    data: variantGet({ variant: POST, clips: [CLIP], assets: [WAVE] }),
  }))
  const store = createVariantStore(fake.api, P, V)
  await store.getState().load()
  await renderApp(
    <main>
      <ClipTrack projectId={P} variant={POST} store={store} />
    </main>,
    fake,
  )
}

describe("the chosen clip's bar [Z-1b]", () => {
  it("is placed outside the block, its place ending at the block's right end", async () => {
    await draw()
    const body = screen.getByRole('button', { name: 'wave.mp4', pressed: false })
    const box = body.closest<HTMLElement>('[data-clip]')!
    const before = box.style.width
    await userEvent.click(body)
    const bar = screen.getByRole('group', { name: 'wave.mp4' })
    expect(box.contains(bar)).toBe(false)
    expect(box.style.width).toBe(before)
    const place = bar.closest<HTMLElement>('[data-clip-bar]')
    expect(place).not.toBeNull()
    expect(place?.contains(box)).toBe(false)
    expect(place?.style.width).toBe('37.5%')
  })
})
