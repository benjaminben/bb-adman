import type { CSSProperties, ReactNode, Ref } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import { textBoxCss } from '@/shared/scene/text-box-css'
import { textCss } from '@/shared/scene/text-style'
import { presetState, type VariantSize } from '@/shared/scene/presets'
import { activeBlock, type ActiveBlock } from '@/shared/scene/timing'
import { WordSpans } from '@/shared/scene/word-spans'

// spec/scene.md "Text layers" and "Text boxes": two elements, the box (geometry, fill, outline,
// padding, vertical place) and the text inside it. The copy is text content, never HTML. Text
// that does not fit is drawn as it is, past its box [FR-098]. With a time (a video variant,
// phase-07.md "Presets") the box is moved with a translate and faded, or for stagger-words
// each word is, so the layout and the overflow measure do not change.
type Props = {
  layer: LayerRow
  style: TextStyle
  box: CSSProperties
  boxRef: Ref<HTMLDivElement>
  textRef: Ref<HTMLDivElement>
  timeMs: number | null // null: drawn at its full state (an image variant)
  variantSize: VariantSize
}

const STILL: ActiveBlock = { preset: 'none', phase: 'entrance', progress: 1 }

export function TextLayer({ layer, style, box, boxRef, textRef, timeMs, variantSize }: Props) {
  const copy = layer.copy ?? ''
  const { preset, phase, progress } = timeMs === null ? STILL : activeBlock(layer.animation, timeMs)
  const stateOf = (i: number, n: number) => presetState(preset, phase, progress, i, n, variantSize)
  let moved: CSSProperties = {}
  let content: ReactNode = copy
  if (preset === 'stagger-words') {
    content = <WordSpans text={copy} stateOf={stateOf} />
  } else if (preset !== 'none') {
    const { opacity, dx, dy } = stateOf(0, 1)
    moved = { opacity, transform: `translate(${dx}px, ${dy}px) ${box.transform ?? ''}`.trim() }
  }
  return (
    <div data-layer-id={layer.id} ref={boxRef} style={{ ...box, ...textBoxCss(style), ...moved }}>
      <div ref={textRef} style={{ ...textCss(style), flex: 'none' }}>
        {content}
      </div>
    </div>
  )
}
