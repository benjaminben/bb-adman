// ED-3: which buttons the picture's icon bar holds, in order, and why each is off. The
// patches are the ones the word buttons sent before: source null, crop null, and the
// background's fill and fit geometry (./background-fit), so each is one undo step as before.
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { fillCanvas, fitInside, type Size } from './background-fit'
import type { BarButton } from './picture-bar'

export type BarInput = {
  layer: LayerRow
  missing: boolean
  canvas: Size | null
  shape: Size | null
  canCutOut: boolean
  onChoose: () => void
  onCrop?: () => void
  onCutOut: () => void
  send: (patch: LayerPatch) => void
}

const LOCKED = 'Lock is on'

export function barButtons(input: BarInput): { main: BarButton[]; fit: BarButton[] } {
  const { layer, canvas, shape, missing, send } = input
  const off = (why: string | null) => (layer.locked ? LOCKED : why)
  const button = (icon: BarButton['icon'], name: string, why: string | null, onClick: () => void) =>
    ({ icon, name, off: off(why), onClick }) satisfies BarButton
  const hasPicture = layer.source !== null

  const main = !hasPicture
    ? []
    : [
        button('image', 'Choose picture…', null, input.onChoose),
        button('crop', 'Crop…', missing ? 'The file is missing' : input.onCrop ? null : '', () =>
          input.onCrop?.(),
        ),
        ...(layer.geometry.crop
          ? [button('reset', 'Reset crop', null, () => send({ geometry: { crop: null } }))]
          : []),
        ...(input.canCutOut
          ? [button('scissors', 'Cut out the subject…', null, input.onCutOut)]
          : []),
        button('trash', 'Remove picture', null, () => send({ source: null })),
      ]

  const fitWhy = !hasPicture
    ? 'Choose a picture first'
    : shape === null && missing
      ? 'The file is missing'
      : canvas === null || shape === null
        ? ''
        : null
  const fit =
    layer.type !== 'background'
      ? []
      : [
          button('fill', 'Fill the canvas', canvas === null ? '' : null, () => {
            if (canvas) send({ geometry: fillCanvas(canvas) })
          }),
          button('fit', 'Fit inside', fitWhy, () => {
            if (canvas && shape) send({ geometry: fitInside(canvas, shape) })
          }),
        ]
  return { main, fit }
}
