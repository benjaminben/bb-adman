// P7-21 (spec/phases/phase-07-slices-2.md): in the editor, a video clip on the track draws in
// the canvas from its asset address, and the sound plays only while the user has pressed Play.
import '../../shared/scene/fake-fonts'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Editor } from '@/renderer/editor/editor'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, P, V, assetRow, variantGet } from './editor-fixture'

const FILM = assetRow('AV', {
  kind: 'video',
  mime: 'video/mp4',
  displayName: 'harbour.mp4',
  durationMs: 4000,
})
const CLIP: BackgroundClipRow = {
  id: 'K1',
  variantId: V,
  assetId: 'AV',
  startMs: 0,
  inMs: 0,
  outMs: 4000,
  placement: null,
  soundOn: true,
}

function videoGet(
  sound: 'clips' | 'file' | 'none',
  over: Partial<VariantGet> = {},
  soundAssetId: string | null = null,
): VariantGet {
  const base = variantGet({ layers: [BACKGROUND, HEADLINE], clips: [CLIP], ...over })
  return {
    ...base,
    assets: [...base.assets, FILM],
    variant: { ...base.variant, format: 'video', durationMs: 8000, sound, soundAssetId },
  }
}

async function open(reply: VariantGet) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => ({ ok: true, data: reply }))
  fake.onQuery('history.state', () => ({ ok: true, data: { canUndo: false, canRedo: false } }))
  fake.onQuery('asset.list', () => ({ ok: true, data: [] }))
  await renderApp(<Editor projectId={P} variantId={V} />, fake)
  return screen.findByRole('region', { name: 'Canvas, Master post' })
}

// jsdom has no media playback; play() and pause() are watched instead.
let play: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

const media = () => [...document.querySelectorAll<HTMLMediaElement>('video, audio')]
const pressPlay = () => userEvent.click(screen.getByRole('button', { name: 'Play' }))

describe('Editor canvas draws a video clip [P7-21 fix]', () => {
  it('the clip under the time is a video at the asset address', async () => {
    const canvas = await open(videoGet('clips'))
    const video = canvas.querySelector('[data-stage] video')
    expect(video).not.toBeNull()
    expect(video).toHaveAttribute('src', `adman-asset://${P}/AV`)
  })

  it('a video asset no clip uses is not in the canvas', async () => {
    const canvas = await open(videoGet('clips', { clips: [] }))
    expect(canvas.querySelector('video')).toBeNull()
  })

  it('a missing video draws no video', async () => {
    const reply = videoGet('clips')
    reply.assets = reply.assets.map((a) => (a.id === 'AV' ? { ...a, missing: true } : a))
    const canvas = await open(reply)
    expect(canvas.querySelector('video')).toBeNull()
  })

  it('every media address is an adman-asset address', async () => {
    await open(videoGet('file', {}, 'AU'))
    expect(media().length).toBeGreaterThan(0)
    for (const el of media())
      expect(el.getAttribute('src')).toMatch(/^adman-asset:\/\/[^/]+\/[^/]+$/)
  })
})

describe('Sound plays only after Play [P7-21]', () => {
  it.each(['clips', 'file', 'none'] as const)(
    'with %s: on opening and on a scrub nothing is unmuted or played',
    async (sound) => {
      await open(videoGet(sound, {}, sound === 'file' ? 'AU' : null))
      const ruler = screen.getByRole('slider', { name: 'Time' })
      ruler.getBoundingClientRect = () => ({ left: 0, width: 800 }) as DOMRect
      act(() => {
        ruler.dispatchEvent(new MouseEvent('pointerdown', { clientX: 200, bubbles: true }))
      })
      expect(media().every((el) => el.muted)).toBe(true)
      expect(play).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['clips', 'video'],
    ['file', 'audio'],
  ] as const)(
    'with %s: Play unmutes and plays the %s; Pause mutes it again',
    async (sound, tag) => {
      await open(videoGet(sound, {}, sound === 'file' ? 'AU' : null))
      await pressPlay()
      const el = document.querySelector<HTMLMediaElement>(tag)!
      expect(el.muted).toBe(false)
      expect(play).toHaveBeenCalled()
      for (const other of media().filter((m) => m !== el)) expect(other.muted).toBe(true)
      await userEvent.click(screen.getByRole('button', { name: 'Pause' }))
      expect(el.muted).toBe(true)
    },
  )

  it('with none: Play leaves every element muted', async () => {
    await open(videoGet('none'))
    await pressPlay()
    expect(media().length).toBeGreaterThan(0)
    expect(media().every((el) => el.muted)).toBe(true)
  })
})
