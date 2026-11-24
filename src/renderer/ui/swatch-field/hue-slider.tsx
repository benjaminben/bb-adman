// The picker's hue slider (spec/app-style-parts.md "Swatch field", D-109): 0 to 360 across a
// fixed rainbow. A drag or the arrow keys (1, with Shift 10) change the draft; the release and
// Enter save it.
import type { KeyboardEvent } from 'react'
import type { Hsb } from './colour-maths'
import { useDrag } from './use-drag'
import styles from './colour-picker.module.css'

type Props = { draft: Hsb; onDraft: (hsb: Hsb) => void; onSave: () => void }

const SIGNS: Record<string, 1 | -1> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }

export function HueSlider({ draft, onDraft, onSave }: Props) {
  const drag = useDrag((x) => onDraft({ ...draft, h: x * 360 }), onSave)
  const h = Math.round(draft.h)

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      onSave()
      return
    }
    const sign = SIGNS[event.key]
    if (!sign) return
    event.preventDefault()
    const step = sign * (event.shiftKey ? 10 : 1)
    onDraft({ ...draft, h: Math.min(360, Math.max(0, h + step)) })
  }

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Hue"
      aria-orientation="horizontal"
      aria-valuemin={0}
      aria-valuemax={360}
      aria-valuenow={h}
      className={styles.hue}
      onKeyDown={onKeyDown}
      {...drag}
    >
      <span className={styles.thumb} style={{ left: `${(draft.h / 360) * 100}%` }} />
    </div>
  )
}
