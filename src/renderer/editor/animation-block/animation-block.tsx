// P7-19 (spec/phases/phase-07-slices-2.md): a text layer's entrance or exit block, inside its
// timing bar, named "Entrance of {layer}" or "Exit of {layer}". It moves and resizes like the
// bar, kept inside the layer's timing; the row sends layer.update { animation } with this
// block only. Its preset's name shows when the pointer rests on it.
import type { Span } from '@/renderer/editor/timeline-math/timeline-math'
import {
  SpanBlock,
  blockSpan,
  boundsOf,
  toBlock,
  type BlockKind,
} from '@/renderer/editor/timing-bar'
import type { PlaybackStore } from '@/renderer/stores/playback-store'
import type { AnimationBlock as Block } from '@/shared/schemas/layer'
import styles from './animation-block.module.css'

export const PRESET_NAMES: Record<Block['preset'], string> = {
  none: 'None',
  fade: 'Fade',
  'fade-up': 'Fade up',
  slide: 'Slide',
  'stagger-words': 'Words one by one',
}

const KIND_NAMES: Record<BlockKind, string> = { entrance: 'Entrance', exit: 'Exit' }

export type AnimationBlockProps = {
  kind: BlockKind
  layerName: string
  block: Block
  layerSpan: Span // the layer's timing: the block stays inside it
  durationMs: number
  playback: PlaybackStore
  onCommit: (next: Block) => void
}

export function AnimationBlock(props: AnimationBlockProps) {
  const { kind, block } = props
  return (
    <SpanBlock
      label={`${KIND_NAMES[kind]} of ${props.layerName}`}
      title={PRESET_NAMES[block.preset]}
      span={blockSpan(block)}
      bounds={boundsOf(props.layerSpan)}
      durationMs={props.durationMs}
      playback={props.playback}
      className={`${styles.block} ${styles[kind]}`}
      handleClassName={styles.handle}
      bodyClassName={styles.body}
      onCommit={(next) => props.onCommit(toBlock(block.preset, next))}
    />
  )
}
