// LK-3, spec/scene.md "Background colour and shade" and "Boxes": the scene reference cases of a
// background colour, a shade and a picture past the canvas edge. Kept apart from scene-cases.ts,
// which imports them, so that file stays under 300 lines.
import type { LayerSpec, SceneCase } from './scene-cases'

const box = (x: number, y: number, width: number, height: number, rotation = 0) => ({
  x,
  y,
  width,
  height,
  rotation,
  crop: null,
})

const image = (assetId: string, geometry: object, style: object = {}): LayerSpec => ({
  type: 'image',
  values: { source: { assetId }, geometry, style: { opacity: 1, ...style } },
})

const BLUE = '#2850DC'
const YELLOW = '#F0C828'

export const LOOK_CASES: SceneCase[] = [
  {
    name: 'background-colour-no-picture',
    title: 'a background layer with a colour and no picture is a flat colour',
    background: () => ({ style: { fillColor: BLUE } }),
  },
  {
    name: 'background-colour-under-transparent-picture',
    title: 'a background colour shows through the transparent part of its picture',
    background: (a) => ({ source: { assetId: a.hole }, style: { fillColor: YELLOW } }),
  },
  {
    name: 'shade-bottom-on-photo',
    title: 'a black shade from the bottom over a background picture',
    background: (a) => ({
      source: { assetId: a.bands },
      style: { shade: { color: '#000000', from: 'bottom', strength: 0.8, reach: 0.6 } },
    }),
  },
  {
    name: 'shade-all-on-image-layer',
    title: 'a shade over a whole image layer turned 15 degrees turns and is cut with its box',
    background: (a) => ({ source: { assetId: a.white } }),
    layers: (a) => [
      image(a.bands, box(100, 100, 200, 200, 15), {
        shade: { color: BLUE, from: 'all', strength: 0.5, reach: 0.6 },
      }),
    ],
  },
  {
    name: 'image-past-the-edge',
    title: 'an image layer half outside the canvas is cut off at the edge',
    layers: (a) => [image(a.bands, box(250, 100, 300, 200))],
  },
]
