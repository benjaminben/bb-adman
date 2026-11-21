import type { CSSProperties, Ref } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import { textBoxCss } from '@/shared/scene/text-box-css'
import { textCss } from '@/shared/scene/text-style'

// spec/scene.md "Text layers" and "Text boxes": two elements, the box (geometry, fill, outline,
// padding, vertical place) and the text inside it. The copy is text content, never HTML. Text
// that does not fit is drawn as it is, past its box [FR-098].
type Props = {
  layer: LayerRow
  style: TextStyle
  box: CSSProperties
  boxRef: Ref<HTMLDivElement>
  textRef: Ref<HTMLDivElement>
}

export function TextLayer({ layer, style, box, boxRef, textRef }: Props) {
  return (
    <div data-layer-id={layer.id} ref={boxRef} style={{ ...box, ...textBoxCss(style) }}>
      <div ref={textRef} style={{ ...textCss(style), flex: 'none' }}>
        {layer.copy ?? ''}
      </div>
    </div>
  )
}
