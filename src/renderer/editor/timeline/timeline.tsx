// P7-18 (spec/phases/phase-07-slices-2.md): a video variant's timeline along the editor's foot:
// the transport bar, then the ruler, one row per layer, the background row, and the playhead
// over the lanes. Each row keeps its name under the layer list's width, so the lanes line up.
import { useStore } from 'zustand'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { ClipTrack } from '@/renderer/editor/clip-track'
import { LayerTracks } from '@/renderer/editor/layer-tracks'
import { Playhead } from '@/renderer/editor/playhead'
import { TimeRuler } from '@/renderer/editor/time-ruler'
import { TransportBar } from '@/renderer/editor/transport-bar'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import type { VariantStore } from '@/renderer/stores/variant-store'
import styles from './timeline.module.css'

type Props = {
  projectId: string
  variant: VariantSummary
  layers: LayerRow[]
  store: VariantStore
  playback: PlaybackStore
}

export function Timeline({ projectId, variant, layers, store, playback }: Props) {
  const { timeMs, playing, durationMs, toggle, scrub } = useStore(playback)
  return (
    <section className={styles.timeline} aria-label="Timeline">
      <TransportBar
        projectId={projectId}
        variant={variant}
        playing={playing}
        timeMs={timeMs}
        onToggle={toggle}
      />
      <div className={styles.scroll}>
        <div className={styles.tracks}>
          <div className={styles.rulerRow}>
            <span />
            <TimeRuler timeMs={timeMs} durationMs={durationMs} onScrub={scrub} />
          </div>
          <LayerTracks
            projectId={projectId}
            variant={variant}
            layers={layers}
            playback={playback}
          />
          <ClipTrack projectId={projectId} variant={variant} store={store} />
          <div className={styles.lanes}>
            <Playhead timeMs={timeMs} durationMs={durationMs} />
          </div>
        </div>
      </div>
    </section>
  )
}
