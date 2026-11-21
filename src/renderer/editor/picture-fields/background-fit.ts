// spec/editor.md, "Properties panel", Picture (background only): "Fill the canvas" is the whole
// canvas; "Fit inside" is the largest box of the picture's shape inside the canvas, centred.
// Both turn rotation to 0 and drop the crop. Pixels are whole, as the number fields take them.
import type { Geometry } from '@/shared/schemas/layer'

export type Size = { width: number; height: number }

export function fillCanvas(canvas: Size): Geometry {
  return { x: 0, y: 0, width: canvas.width, height: canvas.height, rotation: 0, crop: null }
}

export function fitInside(canvas: Size, picture: Size): Geometry {
  const scale = Math.min(canvas.width / picture.width, canvas.height / picture.height)
  const width = Math.max(1, Math.round(picture.width * scale))
  const height = Math.max(1, Math.round(picture.height * scale))
  const x = Math.round((canvas.width - width) / 2)
  const y = Math.round((canvas.height - height) / 2)
  return { x, y, width, height, rotation: 0, crop: null }
}
