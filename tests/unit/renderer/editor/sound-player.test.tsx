// P7-21 (spec/phases/phase-07-slices-2.md): the sound player is one <audio> for the 'file'
// sound, kept to the playback time from 0, played only while the playhead moves.
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SoundPlayer } from '@/renderer/editor/sound-player'
import { createPlaybackStore, type Clock } from '@/renderer/stores/playback-store'
import { variant } from '../screens/campaign/campaign-fixture'

const P = 'P1'
type Sound = 'clips' | 'file' | 'none'
const video = (sound: Sound, soundAssetId: string | null = 'AU') => ({
  ...variant('V1'),
  format: 'video' as const,
  durationMs: 8000,
  sound,
  soundAssetId,
})

// A clock whose frames run only when step() is called.
function standInClock() {
  let now = 0
  let queued: (() => void)[] = []
  const clock: Clock = {
    now: () => now,
    frame: (callback) => queued.push(callback),
    cancel: () => {
      queued = []
    },
  }
  const step = (ms: number) =>
    act(() => {
      now += ms
      const due = queued
      queued = []
      due.forEach((callback) => callback())
    })
  return { clock, step }
}

let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
beforeEach(() => {
  play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined)
})
afterEach(() => vi.restoreAllMocks())

function setUp(sound: Sound, soundAssetId: string | null = 'AU') {
  const { clock, step } = standInClock()
  const playback = createPlaybackStore(8000, clock)
  const view = render(
    <SoundPlayer projectId={P} variant={video(sound, soundAssetId)} playback={playback} />,
  )
  const audio = () => view.container.querySelector('audio')
  return { playback, step, audio, view }
}

describe('SoundPlayer [P7-21]', () => {
  it.each([
    ['clips', 'AU'],
    ['none', 'AU'],
    ['file', null],
  ] as const)('with %s (file %s): no audio element', (sound, assetId) => {
    expect(setUp(sound, assetId).audio()).toBeNull()
  })

  it('with file: one muted, paused <audio> at the asset address, at 0', () => {
    const { audio } = setUp('file')
    expect(audio()).toHaveAttribute('src', 'adman-asset://P1/AU')
    expect(audio()!.muted).toBe(true)
    expect(audio()!.currentTime).toBe(0)
    expect(play).not.toHaveBeenCalled()
  })

  it('a scrub while paused moves the audio time and plays nothing', () => {
    const { audio, playback } = setUp('file')
    act(() => playback.getState().scrub(3000))
    expect(audio()!.currentTime).toBe(3)
    expect(audio()!.muted).toBe(true)
    expect(play).not.toHaveBeenCalled()
  })

  it('Play unmutes and plays from the playhead; Pause pauses and mutes', () => {
    const { audio, playback, step } = setUp('file')
    act(() => playback.getState().scrub(2000))
    act(() => playback.getState().play())
    expect(audio()!.muted).toBe(false)
    expect(audio()!.currentTime).toBe(2)
    expect(play).toHaveBeenCalledOnce()
    step(100)
    act(() => playback.getState().pause())
    expect(pause).toHaveBeenCalled()
    expect(audio()!.muted).toBe(true)
  })

  it('while playing, a drift past a quarter second is put back to the playhead', () => {
    const { audio, playback, step } = setUp('file')
    act(() => playback.getState().play())
    audio()!.currentTime = 0.1
    step(150)
    expect(audio()!.currentTime).toBe(0.1)
    step(1000)
    expect(audio()!.currentTime).toBe(1.15)
  })

  it("stops at the variant's end", () => {
    const { audio, playback, step } = setUp('file')
    act(() => playback.getState().play())
    pause.mockClear()
    step(9000)
    expect(playback.getState().playing).toBe(false)
    expect(pause).toHaveBeenCalled()
    expect(audio()!.muted).toBe(true)
  })

  it('stops when it goes away', () => {
    const { playback, view } = setUp('file')
    act(() => playback.getState().play())
    pause.mockClear()
    view.unmount()
    expect(pause).toHaveBeenCalled()
  })
})
