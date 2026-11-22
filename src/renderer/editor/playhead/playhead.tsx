// P7-18 (spec/phases/phase-07-slices-2.md): the line at the playback time across the ruler and
// the tracks. Its parent is the lanes' box; the line stands at the time's share of its width.
// Decorative: the ruler's slider gives the time to assistive technology.
import styles from './playhead.module.css'

type Props = { timeMs: number; durationMs: number }

export function Playhead({ timeMs, durationMs }: Props) {
  const share = durationMs > 0 ? Math.min(timeMs / durationMs, 1) : 0
  return (
    <div
      className={styles.playhead}
      data-playhead
      aria-hidden="true"
      style={{ left: `${share * 100}%` }}
    />
  )
}
