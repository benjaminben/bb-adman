// P7-18 stub (spec/phases/phase-07-slices-2.md): one timeline row per layer but the background,
// the top layer first as in the layer list, its name only. P7-19 draws the timing bars and the
// animation blocks in the lanes.
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import styles from './layer-tracks.module.css'

export type LayerTracksProps = {
  projectId: string
  variant: VariantSummary
  layers: LayerRow[]
  playback: PlaybackStore
}

export function LayerTracks({ layers }: LayerTracksProps) {
  const rows = layers.filter((l) => l.type !== 'background').sort((a, b) => b.z - a.z)
  return (
    <ul className={styles.tracks} aria-label="Layer tracks">
      {rows.map((layer) => (
        <li key={layer.id} className={styles.row}>
          <span className={styles.name}>{layer.name}</span>
          <div className={styles.lane} />
        </li>
      ))}
    </ul>
  )
}
