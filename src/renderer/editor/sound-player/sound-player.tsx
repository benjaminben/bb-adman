// P7-21 (spec/phases/phase-07-slices-2.md): the 'file' sound of a video variant in the editor.
// One <audio> at the asset's adman-asset address, its time kept to the playback time (audio 0
// is variant 0). It is muted and paused until the user presses Play: a scrub while paused only
// moves its time. While playing it is unmuted and put back to the playhead when it drifts more
// than DRIFT_MS. The playback stops itself at the variant's end, which pauses it. With 'clips'
// the canvas gives the Scene its sound; with 'none' nothing plays.
import { useEffect, useRef } from 'react'
import { useStore } from 'zustand'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'

export type SoundPlayerProps = {
  projectId: string
  variant: VariantSummary
  playback: PlaybackStore
}

const DRIFT_MS = 250

// Holds the audio still, muted, at the playhead time.
function hold(audio: HTMLAudioElement, timeMs: number) {
  audio.pause()
  audio.muted = true
  if (Math.abs(audio.currentTime * 1000 - timeMs) > 1) audio.currentTime = timeMs / 1000
}

// Plays the audio at the playhead time; past the file's own end it stays quiet.
function follow(audio: HTMLAudioElement, timeMs: number) {
  const fileEndMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : Infinity
  if (timeMs >= fileEndMs) {
    if (!audio.paused) audio.pause()
    return
  }
  if (Math.abs(audio.currentTime * 1000 - timeMs) > DRIFT_MS) audio.currentTime = timeMs / 1000
  audio.muted = false
  if (audio.paused) void audio.play()?.catch(() => undefined)
}

export function SoundPlayer({ projectId, variant, playback }: SoundPlayerProps) {
  const assetId = variant.sound === 'file' ? variant.soundAssetId : null
  if (!assetId) return null
  const url = assetUrl(projectId, assetId)
  return <FileSound key={url} url={url} playback={playback} />
}

function FileSound({ url, playback }: { url: string; playback: PlaybackStore }) {
  const element = useRef<HTMLAudioElement>(null)
  const timeMs = useStore(playback, (s) => s.timeMs)
  const playing = useStore(playback, (s) => s.playing)
  useEffect(() => {
    const audio = element.current
    if (!audio) return
    if (playing) follow(audio, timeMs)
    else hold(audio, timeMs)
  }, [playing, timeMs])
  useEffect(() => {
    const audio = element.current
    return () => audio?.pause()
  }, [])
  return <audio ref={element} src={url} muted preload="auto" data-sound-player />
}
