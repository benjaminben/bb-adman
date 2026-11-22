// P7-19: a span of time on a layer's lane, placed by its time: the timing bar and the
// animation blocks are both one. Its body moves it by a drag or the arrows (100 ms, 1 s with
// Shift); its two ends resize it the same way. A drag snaps to 100 ms and to the playhead and
// is sent once, when it ends. A key pressed on it acts on it only: the arrows and Delete do
// not also reach the layer's own shortcuts.
import { useState, type KeyboardEvent, type PointerEvent } from 'react'
import { useDrag } from '@/renderer/editor/clip-block/use-drag'
import {
  SNAP_PX,
  moveSpan,
  pxToMs,
  resizeEnd,
  resizeStart,
  type Bounds,
  type Snap,
  type Span,
} from '@/renderer/editor/timeline-math/timeline-math'
import { formatTime, type PlaybackStore } from '@/renderer/stores/playback-store'

export type SpanPart = 'move' | 'start' | 'end'

export type SpanBlockProps = {
  label: string
  span: Span
  bounds: Bounds
  durationMs: number // the variant's length: the lane's width
  playback: PlaybackStore
  className?: string
  handleClassName?: string
  bodyClassName?: string
  title?: string
  onCommit: (next: Span, part: SpanPart) => void
  // The drag in hand, while it moves; null when it ends.
  onDraft?: (draft: Span | null, part: SpanPart) => void
}

const STEP_MS = 100
const FAR_MS = 1000
const KEPT_KEYS = new Set(['ArrowUp', 'ArrowDown', 'Delete', 'Backspace'])

const EDIT = { move: moveSpan, start: resizeStart, end: resizeEnd }

function laneWidth(from: Element): number {
  return from.closest('[data-layer-lane]')?.getBoundingClientRect().width ?? 0
}

const share = (ms: number, durationMs: number) => (durationMs > 0 ? (ms / durationMs) * 100 : 0)

export function SpanBlock(props: SpanBlockProps) {
  const { label, span, bounds, durationMs } = props
  const [draft, setDraft] = useState<Span | null>(null)
  const startDrag = useDrag()
  const shown = draft ?? span

  const press = (part: SpanPart) => (event: PointerEvent<HTMLElement>) => {
    const width = laneWidth(event.currentTarget)
    const snap: Snap = {
      playheadMs: props.playback.getState().timeMs,
      nearMs: pxToMs(SNAP_PX, width, durationMs),
    }
    const at = (dx: number) => EDIT[part](span, pxToMs(dx, width, durationMs), bounds, snap)
    const show = (next: Span | null) => {
      setDraft(next)
      props.onDraft?.(next, part)
    }
    startDrag(event, {
      move: (dx) => show(at(dx)),
      done: (dx) => {
        show(null)
        if (dx !== 0) props.onCommit(at(dx), part)
      },
    })
  }

  const key = (part: SpanPart) => (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (KEPT_KEYS.has(event.key)) {
      event.preventDefault()
      return
    }
    const by = event.shiftKey ? FAR_MS : STEP_MS
    const delta = { ArrowLeft: -by, ArrowRight: by }[event.key]
    if (delta === undefined) return
    event.preventDefault()
    props.onCommit(EDIT[part](span, delta, bounds), part)
  }

  function handle(part: 'start' | 'end', name: string, valueMs: number) {
    return (
      <span
        role="slider"
        tabIndex={0}
        aria-label={`${name} of ${label}`}
        aria-valuemin={0}
        aria-valuemax={durationMs}
        aria-valuenow={valueMs}
        aria-valuetext={formatTime(valueMs)}
        className={props.handleClassName}
        onPointerDown={press(part)}
        onKeyDown={key(part)}
      />
    )
  }

  return (
    <div
      className={props.className}
      data-dragging={draft ? true : undefined}
      title={props.title}
      style={{
        left: `${share(shown.startMs, durationMs)}%`,
        width: `${share(shown.endMs - shown.startMs, durationMs)}%`,
      }}
    >
      {handle('start', 'Start', shown.startMs)}
      <button
        type="button"
        aria-label={label}
        className={props.bodyClassName}
        onPointerDown={press('move')}
        onKeyDown={key('move')}
      />
      {handle('end', 'End', shown.endMs)}
    </div>
  )
}
