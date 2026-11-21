// The look defaults (LK-1; spec/data-model-campaign.md "Look fields"). The style schemas hold
// no .default(), so these functions are the one owner of the defaults: absent means the
// default here, and every default draws as before (A-71).
import type { ImageStyle, Shade, TextStyle } from '@/shared/schemas/layer'

export type TextLook = Required<TextStyle>
export type PictureLook = Required<ImageStyle>

export const TEXT_LOOK_DEFAULTS = {
  verticalAlign: 'top',
  allCaps: false,
  boxColor: null,
  boxOutlineColor: null,
  boxOutlineWidth: 0,
  boxRadius: 0,
  boxPadding: 0,
} as const satisfies Partial<TextLook>

export const PICTURE_LOOK_DEFAULTS = {
  fillColor: null,
  shade: null,
} as const satisfies Partial<PictureLook>

// The shade the panel sends when a side is chosen and there was none (spec/editor.md "Shade");
// the values of the default starter layout's shade (spec/starter-layouts.md).
export const NEW_SHADE: Shade = { color: '#000000', from: 'bottom', strength: 0.7, reach: 0.6 }

export function textLookOf(style: TextStyle): TextLook {
  return { ...TEXT_LOOK_DEFAULTS, ...style } as TextLook
}

export function pictureLookOf(style: ImageStyle): PictureLook {
  return { ...PICTURE_LOOK_DEFAULTS, ...style } as PictureLook
}
