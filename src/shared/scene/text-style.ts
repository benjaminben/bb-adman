import type { CSSProperties } from 'react'
import type { TextStyle } from '@/shared/schemas/layer'
import { textLookOf } from '@/shared/config/look'
import { fontFamilyOf } from '@/shared/scene/font-faces'
import { rgbCss } from '@/shared/scene/colour-css'

// spec/scene.md "Text layers": exactly these properties and no others, so the editor and the
// render window lay text out alike. The box's place and size come from its geometry. The
// colour goes through rgbCss (LK-1); one that fails is left out, so the text inherits its colour.
export function textCss(style: TextStyle): CSSProperties {
  const color = rgbCss(style.color)
  return {
    fontFamily: fontFamilyOf(style.fontAssetId),
    fontSize: `${style.fontSize}px`,
    fontWeight: style.fontWeight,
    fontStyle: 'normal',
    fontSynthesis: 'none',
    ...(color === null ? {} : { color }),
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
    // "Text boxes" (LK-2): capitals are drawn only; the copy is stored as typed.
    textTransform: textLookOf(style).allCaps === true ? 'uppercase' : 'none',
  }
}
