// P7-19 (spec/phases/phase-07-slices-2.md): a layer's timing bar on its lane, named "Timing of
// {layer}". A null end is drawn to the variant's end. Its body moves it, its ends resize it,
// and the row sends one layer.update when a drag ends or a key steps it.
import type { Span } from '@/renderer/editor/timeline-math/timeline-math'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import { SpanBlock, type SpanPart } from './span-block'
import styles from './timing-bar.module.css'

export type TimingBarProps = {
  layerName: string
  span: Span
  durationMs: number
  playback: PlaybackStore
  onCommit: (next: Span, part: SpanPart) => void
}

export function TimingBar({ layerName, span, durationMs, playback, onCommit }: TimingBarProps) {
  return (
    <SpanBlock
      label={`Timing of ${layerName}`}
      span={span}
      bounds={{ lowMs: 0, highMs: durationMs }}
      durationMs={durationMs}
      playback={playback}
      className={styles.bar}
      handleClassName={styles.handle}
      bodyClassName={styles.body}
      onCommit={onCommit}
    />
  )
}
