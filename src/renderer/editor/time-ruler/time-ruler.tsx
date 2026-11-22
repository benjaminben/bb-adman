// P7-18 (spec/phases/phase-07-slices-2.md): the timeline's ruler, with seconds marks. A press
// scrubs to the time under it and a drag keeps scrubbing until the release. It is a slider
// named "Time", so the arrows move it 100 ms (1 s with Shift) and Home and End go to the ends;
// it handles those keys itself, so they do not also nudge a layer.
import { useEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react'
import { formatTime } from '@/renderer/stores/playback-store'
import { markLabel, markTimes } from './ruler-marks'
import styles from './time-ruler.module.css'

type Props = { timeMs: number; durationMs: number; onScrub: (timeMs: number) => void }

const STEP_MS = 100
const FAR_MS = 1000

export function TimeRuler({ timeMs, durationMs, onScrub }: Props) {
  const ruler = useRef<HTMLDivElement>(null)
  const endDrag = useRef<(() => void) | null>(null)
  useEffect(() => () => endDrag.current?.(), [])

  function timeAt(clientX: number): number {
    const rect = ruler.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) return 0
    const share = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1)
    return share * durationMs
  }

  function press(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    event.preventDefault()
    event.currentTarget.focus()
    endDrag.current?.()
    onScrub(timeAt(event.clientX))
    const move = (e: globalThis.PointerEvent) => onScrub(timeAt(e.clientX))
    const up = () => endDrag.current?.()
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    endDrag.current = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      endDrag.current = null
    }
  }

  function key(event: KeyboardEvent<HTMLDivElement>) {
    const by = event.shiftKey ? FAR_MS : STEP_MS
    const to: Record<string, number> = {
      ArrowLeft: timeMs - by,
      ArrowRight: timeMs + by,
      Home: 0,
      End: durationMs,
    }
    if (!(event.key in to) || event.metaKey || event.ctrlKey || event.altKey) return
    event.preventDefault()
    onScrub(to[event.key]!)
  }

  return (
    <div
      ref={ruler}
      className={styles.ruler}
      role="slider"
      tabIndex={0}
      aria-label="Time"
      aria-valuemin={0}
      aria-valuemax={durationMs}
      aria-valuenow={timeMs}
      aria-valuetext={formatTime(timeMs)}
      onPointerDown={press}
      onKeyDown={key}
    >
      {markTimes(durationMs).map((ms) => (
        <span
          key={ms}
          className={styles.mark}
          data-mark
          style={{ left: `${durationMs > 0 ? (ms / durationMs) * 100 : 0}%` }}
        >
          {markLabel(ms)}
        </span>
      ))}
    </div>
  )
}
