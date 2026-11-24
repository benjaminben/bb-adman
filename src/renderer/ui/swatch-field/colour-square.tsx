// The picker's square (spec/app-style-parts.md "Swatch field", D-109): saturation across,
// brightness up. A drag or the arrow keys (1%, with Shift 10%) change the draft; the release
// and Enter save it. The square's colour is the draft's hue at full strength, computed here as
// an exact #RRGGBB, never text a user typed.
import type { KeyboardEvent } from 'react'
import { hsbToHex, type Hsb } from './colour-maths'
import { useDrag } from './use-drag'
import styles from './colour-picker.module.css'

type Props = { draft: Hsb; onDraft: (hsb: Hsb) => void; onSave: () => void }

const MOVES: Record<string, ['s' | 'b', 1 | -1]> = {
  ArrowRight: ['s', 1],
  ArrowLeft: ['s', -1],
  ArrowUp: ['b', 1],
  ArrowDown: ['b', -1],
}

const hold = (n: number) => Math.min(100, Math.max(0, n))

export function ColourSquare({ draft, onDraft, onSave }: Props) {
  const drag = useDrag((x, y) => onDraft({ h: draft.h, s: x * 100, b: (1 - y) * 100 }), onSave)
  const s = Math.round(draft.s)
  const b = Math.round(draft.b)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSave()
      return
    }
    const move = MOVES[event.key]
    if (!move) return
    event.preventDefault()
    const [axis, sign] = move
    const step = sign * (event.shiftKey ? 10 : 1)
    const next = { ...draft, s, b }
    onDraft({ ...next, [axis]: hold(next[axis] + step) })
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Saturation and brightness"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={s}
      aria-valuetext={`Saturation ${s}%, brightness ${b}%`}
      className={styles.square}
      style={{ backgroundColor: hsbToHex({ h: draft.h, s: 100, b: 100 }) }}
      onKeyDown={onKeyDown}
      {...drag}
    >
      <span className={styles.thumb} style={{ left: `${draft.s}%`, top: `${100 - draft.b}%` }} />
    </div>
  )
}
