// P7-18 stub (spec/phases/phase-07-slices-2.md): the background row of the timeline, its name
// only. P7-20 draws the clips in its lane, read from the variant store.
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { VariantStore } from '@/renderer/stores/variant-store'
import styles from './clip-track.module.css'

export type ClipTrackProps = { projectId: string; variant: VariantSummary; store: VariantStore }

export function ClipTrack(_props: ClipTrackProps) {
  return (
    <div className={styles.row}>
      <span className={styles.name}>Background</span>
      <div className={styles.lane} />
    </div>
  )
}
