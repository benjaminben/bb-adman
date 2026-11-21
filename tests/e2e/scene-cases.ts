// spec/testing.md "Reference pictures", Phase 3 cases: the test pictures, made from fixed
// pixel values, and one row per case. Every case is a 400 by 400 variant drawn at 400.
import { LOOK_CASES } from './scene-cases-look'

export const SIDE = 400

type Rgba = [number, number, number, number]
const RED: Rgba = [220, 40, 40, 255]
const GREEN: Rgba = [40, 180, 60, 255]
const BLUE: Rgba = [40, 80, 220, 255]
const YELLOW: Rgba = [240, 200, 40, 255]
const WHITE: Rgba = [255, 255, 255, 255]
const MAGENTA: Rgba = [200, 40, 200, 255]
const CLEAR: Rgba = [0, 0, 0, 0]

export type Picture = { width: number; height: number; bgra: number[] }

function picture(width: number, height: number, at: (x: number, y: number) => Rgba): Picture {
  const bgra: number[] = []
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = at(x, y)
      bgra.push(b, g, r, a)
    }
  }
  return { width, height, bgra }
}

const solid = (colour: Rgba) => picture(8, 8, () => colour)
const BAND_COLOURS = [RED, GREEN, BLUE, YELLOW] as const

export const PICTURES = {
  // 200 by 100: a white stripe along the top, then red, green, blue and yellow bands.
  bands: picture(200, 100, (x, y) => (y < 10 ? WHITE : BAND_COLOURS[Math.floor(x / 50)]!)),
  // 100 by 100 white with a transparent 50 by 50 hole in the middle.
  hole: picture(100, 100, (x, y) => (x >= 25 && x < 75 && y >= 25 && y < 75 ? CLEAR : WHITE)),
  red: solid(RED),
  green: solid(GREEN),
  blue: solid(BLUE),
  white: solid(WHITE),
  magenta: solid(MAGENTA),
}
export type PictureName = keyof typeof PICTURES
export type CaseAssets = Record<PictureName | 'font', string>

export type LayerSpec = { type: 'image' | 'text'; values: Record<string, unknown> }
export type SceneCase = {
  name: string
  title: string
  language?: string
  mode?: 'overlay-only'
  fixme?: string
  background?: (a: CaseAssets) => Record<string, unknown>
  layers?: (a: CaseAssets) => LayerSpec[]
}

const box = (x: number, y: number, width: number, height: number, rotation = 0) => ({
  x,
  y,
  width,
  height,
  rotation,
  crop: null,
})

const image = (assetId: string | null, geometry: object, opacity = 1): LayerSpec => ({
  type: 'image',
  values: { source: assetId ? { assetId } : null, geometry, style: { opacity } },
})

const TEXT_STYLE = {
  fontAssetId: null,
  fontSize: 28,
  fontWeight: 400,
  color: '#FFFFFF',
  align: 'left',
  lineHeight: 1.2,
  letterSpacing: 0,
}

const text = (copy: string, geometry: object, style: object = {}): LayerSpec => ({
  type: 'text',
  values: { copy, geometry, style: { ...TEXT_STYLE, ...style } },
})

const weightsAndAlign = ([400, 700] as const).flatMap((fontWeight, w) =>
  (['left', 'center', 'right'] as const).map((align, a) =>
    text(`Sale ${fontWeight} ${align}`, box(20, 20 + (w * 3 + a) * 62, 360, 40), {
      fontWeight,
      align,
    }),
  ),
)

export const CASES: SceneCase[] = [
  {
    name: 'background-cover',
    title: 'a background picture with no crop covers the canvas',
    background: (a) => ({ source: { assetId: a.bands } }),
  },
  {
    name: 'background-crop',
    title: 'a background picture with a crop shows the cropped region',
    background: (a) => ({
      source: { assetId: a.bands },
      geometry: { crop: { x: 0, y: 0, width: 100, height: 100 } },
    }),
  },
  {
    name: 'image-contain',
    title: 'an image layer that is not square is contained in its box',
    layers: (a) => [image(a.bands, box(40, 40, 320, 320))],
  },
  {
    name: 'image-opacity',
    title: 'an image layer at 50 % opacity beside one at full opacity',
    background: (a) => ({ source: { assetId: a.white } }),
    layers: (a) => [
      image(a.red, box(40, 140, 150, 120)),
      image(a.red, box(210, 140, 150, 120), 0.5),
    ],
  },
  {
    name: 'rotated-layer',
    title: 'a layer turned 30 degrees about its centre',
    layers: (a) => [image(a.red, box(100, 100, 200, 200, 30))],
  },
  {
    name: 'hidden-layer',
    title: 'a hidden layer between two visible ones draws nothing',
    layers: (a) => [
      image(a.red, box(60, 60, 200, 200)),
      {
        type: 'image',
        values: { ...image(a.green, box(100, 100, 200, 200)).values, visible: false },
      },
      image(a.blue, box(140, 140, 200, 200)),
    ],
  },
  {
    name: 'empty-picture-layer',
    title: 'an empty picture layer draws nothing',
    background: (a) => ({ source: { assetId: a.magenta } }),
    layers: () => [image(null, box(100, 100, 200, 200))],
  },
  {
    name: 'text-weights-align',
    title: 'text in the default font at weights 400 and 700, aligned left, centre and right',
    layers: () => weightsAndAlign,
  },
  {
    name: 'letter-spacing',
    title: 'text with letter spacing -0.1, 0 and 0.3 em [FR-249]',
    layers: () =>
      [-0.1, 0, 0.3].map((letterSpacing, i) =>
        text('Summer sale', box(20, 60 + i * 100, 360, 60), { fontSize: 40, letterSpacing }),
      ),
  },
  {
    name: 'imported-font',
    title: 'text in an imported font',
    layers: (a) => [
      text('Imported font', box(20, 160, 360, 80), {
        fontAssetId: a.font,
        fontSize: 44,
        fontWeight: 700,
        align: 'center',
      }),
    ],
  },
  {
    name: 'text-overflow',
    title: 'text that overflows its box is drawn past it',
    layers: (a) => [
      // A crop makes the blue square cover the text's box, so the box can be seen.
      image(a.blue, { ...box(50, 50, 200, 60), crop: { x: 0, y: 0, width: 8, height: 8 } }),
      text('This headline is far too long for its box', box(50, 50, 200, 60), { fontSize: 32 }),
    ],
  },
  {
    name: 'cjk-ja',
    title: 'Japanese text with lang ja in the system fallback font',
    language: 'ja',
    layers: () => [text('夏のセール、今だけ半額です。', box(20, 40, 360, 240), { fontSize: 40 })],
  },
  {
    name: 'transparent-hole',
    title: 'a picture with a transparent hole over a coloured background shows the colour [FR-245]',
    background: (a) => ({ source: { assetId: a.magenta } }),
    layers: (a) => [image(a.hole, box(100, 100, 200, 200))],
  },
  // LK-2, spec/scene.md "Text boxes".
  {
    name: 'text-box-button',
    title: 'a text box with an outline and a radius, text in the middle, centred',
    layers: () => [
      text('Shop now', box(80, 160, 240, 80), {
        fontSize: 32,
        align: 'center',
        verticalAlign: 'middle',
        boxOutlineColor: '#F0C828',
        boxOutlineWidth: 4,
        boxRadius: 40,
      }),
    ],
  },
  {
    name: 'text-box-label',
    title: 'a filled text box with a radius and padding, text at the bottom left',
    layers: () => [
      text('New season', box(40, 200, 260, 160), {
        color: '#111111',
        verticalAlign: 'bottom',
        boxColor: '#F0C828',
        boxRadius: 16,
        boxPadding: 20,
      }),
    ],
  },
  {
    name: 'text-all-caps',
    title: 'the same copy drawn as typed and in all capitals',
    layers: () =>
      [false, true].map((allCaps, i) =>
        text('Summer sale', box(20, 100 + i * 120, 360, 60), { fontSize: 40, allCaps }),
      ),
  },
  {
    name: 'text-box-overflow-bottom',
    title: 'bottom-aligned text that does not fit is drawn past the top of its filled box',
    layers: () => [
      text('This headline is far too long for its box', box(50, 250, 200, 60), {
        fontSize: 32,
        verticalAlign: 'bottom',
        boxColor: '#2850DC',
      }),
    ],
  },
  // LK-3, spec/scene.md "Background colour and shade".
  ...LOOK_CASES,
  {
    name: 'overlay-only',
    title: 'overlay-only mode is transparent where only the background was',
    mode: 'overlay-only',
    background: (a) => ({ source: { assetId: a.bands } }),
    layers: () => [
      text('Over video', box(20, 160, 360, 80), {
        fontSize: 48,
        align: 'center',
        color: '#F0C828',
      }),
    ],
  },
]
