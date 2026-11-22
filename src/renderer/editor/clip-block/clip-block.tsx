// P7-20 (spec/phases/phase-07-slices-2.md): one clip on the background row, placed by its
// time. The block moves by a drag or the arrows (100 ms, 1 s with Shift); its two ends trim
// the same way; Delete removes it. Every change is judged by the track rules before it is
// sent (clip-drag.ts), and a drag that would overlap snaps back. The block shows the stored
// place, apart from the drag in hand. ED-6: the chosen block's actions bar (clip-actions.tsx)
// is drawn beside it; Z-1b: fully above it, ending at its right end.
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { formatTime } from '@/renderer/stores/playback-store'
import { clipEnd, type TrackClip } from '@/shared/clips/track'
import { MAX_TRACK_MS } from '@/shared/schemas/commands/clip'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import {
  judgeMove,
  judgeTrim,
  moveBy,
  stepsOf,
  trimEndBy,
  trimStartBy,
  type ClipKind,
} from './clip-drag'
import { ClipActions } from './clip-actions'
import { useClipSend } from './use-clip-send'
import { useDrag } from './use-drag'
import styles from './clip-block.module.css'

export type ClipBlockProps = {
  projectId: string
  clip: BackgroundClipRow
  label: string // the file's display name, or "File not found"
  kind: ClipKind
  fileMs: number | null // a video file's length; null for a still
  durationMs: number // the variant's length: the lane's width
  track: TrackClip[] // every clip of the variant, as stored
  selected: boolean
  onSelect: () => void
  onResult: (message: string | null) => void // a refusal's sentence, or null
}

type Part = 'move' | 'start' | 'end'

const STEP_MS = 100
const FAR_MS = 1000

const asTrack = ({ id, startMs, inMs, outMs }: BackgroundClipRow): TrackClip => ({
  id,
  startMs,
  inMs,
  outMs,
})

function laneWidth(from: Element): number {
  return from.closest('[data-clip-lane]')?.getBoundingClientRect().width ?? 0
}

const share = (ms: number, durationMs: number) => (durationMs > 0 ? (ms / durationMs) * 100 : 0)

export function ClipBlock(props: ClipBlockProps) {
  const { clip, label, kind, fileMs, durationMs, track } = props
  const send = useClipSend(props.projectId, props.onResult)
  const [draft, setDraft] = useState<TrackClip | null>(null)
  const startDrag = useDrag()
  const stored = asTrack(clip)
  const shown = draft ?? stored

  const edits: Record<Part, (deltaMs: number) => TrackClip> = {
    move: (d) => moveBy(stored, d),
    start: (d) => trimStartBy(stored, d, kind),
    end: (d) => trimEndBy(stored, d, fileMs),
  }

  function commit(part: Part, next: TrackClip) {
    if (part !== 'move') {
      const trim = judgeTrim(stored, next, track)
      if (trim.kind === 'update') send('clip.update', { clipId: clip.id, ...trim.change })
      return
    }
    const move = judgeMove(next, track)
    if (move.kind === 'update') send('clip.update', { clipId: clip.id, startMs: move.startMs })
    if (move.kind === 'reorder') {
      send('clip.reorder', { variantId: clip.variantId, clipIds: move.clipIds })
    }
  }

  const press = (part: Part) => (event: PointerEvent<HTMLElement>) => {
    const width = laneWidth(event.currentTarget)
    const at = (dx: number) => edits[part](stepsOf(dx, width, durationMs))
    startDrag(event, {
      move: (dx) => setDraft(at(dx)),
      done: (dx) => {
        setDraft(null)
        commit(part, at(dx))
      },
    })
  }

  const key = (part: Part) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (part === 'move' && (event.key === 'Delete' || event.key === 'Backspace')) {
      event.preventDefault()
      send('clip.remove', { clipId: clip.id })
      return
    }
    const by = event.shiftKey ? FAR_MS : STEP_MS
    const delta = { ArrowLeft: -by, ArrowRight: by }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    commit(part, edits[part](delta))
  }

  function handle(part: 'start' | 'end', name: string, valueMs: number) {
    return (
      <span
        role="slider"
        tabIndex={0}
        aria-label={`${name} of ${label}`}
        aria-valuemin={0}
        aria-valuemax={MAX_TRACK_MS}
        aria-valuenow={valueMs}
        aria-valuetext={formatTime(valueMs)}
        className={`${styles.handle} ${styles[part]}`}
        onPointerDown={press(part)}
        onKeyDown={key(part)}
        onFocus={props.onSelect}
      />
    )
  }

  const left = share(shown.startMs, durationMs)
  const width = share(shown.outMs - shown.inMs, durationMs)
  return (
    <>
      <div
        data-clip
        className={`${styles.block} ${kind === 'video' ? styles.video : ''}`}
        data-selected={props.selected || undefined}
        data-dragging={draft ? true : undefined}
        style={{ left: `${left}%`, width: `${width}%` }}
      >
        {handle('start', 'Start', shown.startMs)}
        <button
          type="button"
          className={styles.body}
          aria-pressed={props.selected}
          onPointerDown={press('move')}
          onKeyDown={key('move')}
          onFocus={props.onSelect}
        >
          {label}
        </button>
        {handle('end', 'End', clipEnd(shown))}
      </div>
      {props.selected && (
        <ClipActions
          projectId={props.projectId}
          clip={clip}
          label={label}
          kind={kind}
          end={`${Math.min(100, left + width)}%`}
          onResult={props.onResult}
        />
      )}
    </>
  )
}
