// P7-18 (spec/phases/phase-07-slices-2.md): the timeline's bar: one button, "Play" or "Pause" by
// state, the time as m:ss.s / m:ss.s, and the mount for the sound choice (P7-21).
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { SoundFields } from '@/renderer/editor/sound-fields'
import { formatTime } from '@/renderer/stores/playback-store'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './transport-bar.module.css'

type Props = {
  projectId: string
  variant: VariantSummary
  playing: boolean
  timeMs: number
  onToggle: () => void
}

export function TransportBar({ projectId, variant, playing, timeMs, onToggle }: Props) {
  return (
    <div className={styles.bar}>
      <button type="button" className={`${layout.quiet} ${layout.small}`} onClick={onToggle}>
        <Icon name={playing ? 'pause' : 'play'} size="small" />
        {playing ? 'Pause' : 'Play'}
      </button>
      <span className={styles.time}>
        {formatTime(timeMs)} / {formatTime(variant.durationMs)}
      </span>
      <SoundFields projectId={projectId} variant={variant} />
    </div>
  )
}
