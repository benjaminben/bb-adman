import type { CSSProperties } from 'react'
import type { TextStyle } from '@/shared/schemas/layer'
import { fontFamilyOf } from '@/shared/scene/font-faces'

// spec/scene.md "Text layers": exactly these properties and no others, so the editor and the
// render window lay text out alike. The box's place and size come from its geometry.
export function textCss(style: TextStyle): CSSProperties {
  return {
    fontFamily: fontFamilyOf(style.fontAssetId),
    fontSize: `${style.fontSize}px`,
    fontWeight: style.fontWeight,
    fontStyle: 'normal',
    fontSynthesis: 'none',
    color: style.color,
    textAlign: style.align,
    lineHeight: style.lineHeight,
    letterSpacing: `${style.letterSpacing}em`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'normal',
    wordBreak: 'normal',
    hyphens: 'manual',
    fontKerning: 'normal',
    overflow: 'visible',
    padding: 0,
    margin: 0,
    boxSizing: 'border-box',
  }
}
