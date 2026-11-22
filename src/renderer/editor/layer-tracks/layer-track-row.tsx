// P7-19: one layer's row: its name under the layer list's width, and on its lane the timing
// bar and, for a text layer, the entrance and exit blocks that have a preset. Each change is
// one layer.update; a change that leaves everything where it was sends nothing.
import { AnimationBlock } from '@/renderer/editor/animation-block'
import type { Span } from '@/renderer/editor/timeline-math/timeline-math'
import {
  BLOCK_KINDS,
  TimingBar,
  timingPatch,
  timingSpan,
  type SpanPart,
} from '@/renderer/editor/timing-bar'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import type { AnimationBlock as Block } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { LayerSend } from './use-layer-send'
import styles from './layer-tracks.module.css'

type Props = { layer: LayerRow; durationMs: number; playback: PlaybackStore; send: LayerSend }

const sameBlock = (a: Block, b: Block) => a.startMs === b.startMs && a.durationMs === b.durationMs

export function LayerTrackRow({ layer, durationMs, playback, send }: Props) {
  const span = timingSpan(layer.timing, durationMs)

  function commitTiming(next: Span, part: SpanPart) {
    const patch = timingPatch(layer, next, durationMs, part === 'move')
    if (patch) send(layer.id, patch)
  }

  const blocks = layer.type === 'text' ? BLOCK_KINDS : []
  return (
    <li className={styles.row}>
      <span className={styles.name}>{layer.name}</span>
      <div className={styles.lane} data-layer-lane>
        <TimingBar
          layerName={layer.name}
          span={span}
          durationMs={durationMs}
          playback={playback}
          onCommit={commitTiming}
        />
        {blocks.map((kind) => {
          const block = layer.animation[kind]
          if (block.preset === 'none') return null
          return (
            <AnimationBlock
              key={kind}
              kind={kind}
              layerName={layer.name}
              block={block}
              layerSpan={span}
              durationMs={durationMs}
              playback={playback}
              onCommit={(next) => {
                if (!sameBlock(next, block)) send(layer.id, { animation: { [kind]: next } })
              }}
            />
          )
        })}
      </div>
    </li>
  )
}
