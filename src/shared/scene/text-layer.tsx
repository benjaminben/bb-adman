import type { CSSProperties, Ref } from 'react'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import { textCss } from '@/shared/scene/text-style'

// spec/scene.md "Text layers": the copy as text content, never as HTML. Text that does not
// fit is drawn as it is, past its box [FR-098].
type Props = { layer: LayerRow; style: TextStyle; box: CSSProperties; boxRef: Ref<HTMLDivElement> }

export function TextLayer({ layer, style, box, boxRef }: Props) {
  return (
    <div data-layer-id={layer.id} ref={boxRef} style={{ ...box, ...textCss(style) }}>
      {layer.copy ?? ''}
    </div>
  )
}
