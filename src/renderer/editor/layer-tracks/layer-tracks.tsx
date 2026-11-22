// P7-19 (spec/phases/phase-07-slices-2.md): one timeline row per layer but the background,
// the top layer first as in the layer list. Each row shows the layer's timing bar, and a text
// layer's row its entrance and exit blocks; bars and blocks move and resize. A refused change
// shows its own sentence under the rows, as an alert, until the next change is taken.
import { useState } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import { LayerTrackRow } from './layer-track-row'
import { useLayerSend } from './use-layer-send'
import styles from './layer-tracks.module.css'

export type LayerTracksProps = {
  projectId: string
  variant: VariantSummary
  layers: LayerRow[]
  playback: PlaybackStore
}

export function LayerTracks({ projectId, variant, layers, playback }: LayerTracksProps) {
  const [error, setError] = useState<string | null>(null)
  const send = useLayerSend(projectId, setError)
  const rows = layers.filter((l) => l.type !== 'background').sort((a, b) => b.z - a.z)
  return (
    <>
      <ul className={styles.tracks} aria-label="Layer tracks">
        {rows.map((layer) => (
          <LayerTrackRow
            key={layer.id}
            layer={layer}
            durationMs={variant.durationMs}
            playback={playback}
            send={send}
          />
        ))}
      </ul>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  )
}
