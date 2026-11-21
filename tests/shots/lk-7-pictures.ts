// LK-7: the made-up pictures the three looks use, drawn here as plain shapes and gradients
// (never taken from the reference ads). Each is drawn as four bytes a pixel (blue, green, red,
// alpha) and turned into a PNG by Electron's nativeImage, as lk-5 and lk-6 do.
import type { ElectronApplication } from '@playwright/test'
import fs from 'node:fs'

type Rgba = [number, number, number, number]
type Paint = (x: number, y: number) => Rgba

const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
const mix = (a: number, b: number, t: number) => a + (b - a) * t

async function writePng(
  app: ElectronApplication,
  file: string,
  width: number,
  height: number,
  paint: Paint,
): Promise<void> {
  const bytes = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y)
      const i = (y * width + x) * 4
      bytes[i] = clamp(b)
      bytes[i + 1] = clamp(g)
      bytes[i + 2] = clamp(r)
      bytes[i + 3] = clamp(a)
    }
  }
  const png = await app.evaluate(
    ({ nativeImage }, given) =>
      nativeImage
        .createFromBitmap(Buffer.from(given.data, 'base64'), {
          width: given.width,
          height: given.height,
        })
        .toPNG()
        .toString('base64'),
    { data: bytes.toString('base64'), width, height },
  )
  fs.writeFileSync(file, Buffer.from(png, 'base64'))
}

// A dim room: dark blue-grey walls, pale upright posts and shelves, and a warm round shape
// low on the right standing in for a person. 540 by 960.
export function drawRoom(app: ElectronApplication, file: string): Promise<void> {
  return writePng(app, file, 540, 960, (x, y) => {
    const post = x % 180 < 16
    const shelf = y % 150 < 10 && y < 640
    const dx = (x - 360) / 150
    const dy = (y - 600) / 230
    if (dx * dx + dy * dy < 1) return [205, 170, 160, 255]
    if (post || shelf) return [150, 140, 130, 255]
    const t = y / 960
    return [mix(45, 25, t), mix(52, 30, t), mix(70, 40, t), 255]
  })
}

// A forest seen from below: a pale glow in the middle, green all round, and brown trunks
// running in to the middle, one wide trunk from the bottom. 540 by 960.
export function drawForest(app: ElectronApplication, file: string): Promise<void> {
  return writePng(app, file, 540, 960, (x, y) => {
    const dx = x - 270
    const dy = y - 420
    const far = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 420)
    const angle = Math.atan2(dy, dx)
    const trunk = Math.abs(Math.sin(angle * 5)) < 0.12 + 0.1 * far && far > 0.15
    const wide = y > 420 && Math.abs(dx) < 30 + (y - 420) * 0.45
    if (wide) return [mix(95, 60, far), mix(70, 42, far), mix(45, 28, far), 255]
    if (trunk) return [mix(150, 110, far), mix(110, 80, far), mix(70, 50, far), 255]
    if (far < 0.12) return [250, 245, 220, 255]
    return [mix(170, 40, far), mix(220, 120, far), mix(90, 30, far), 255]
  })
}

// A product on a see-through ground: a dark rounded frame (a phone) with a green card across
// it. 700 by 900; the corners and the inside of the frame are transparent.
export function drawProduct(app: ElectronApplication, file: string): Promise<void> {
  return writePng(app, file, 700, 900, (x, y) => {
    const card = x > 40 && x < 560 && y > 330 && y < 650
    const inFrame = x > 200 && y > 60
    const rim = inFrame && (x < 236 || y < 96)
    if (rim) return [30, 30, 34, 255]
    if (card) return [110, 230, 135, 255]
    if (inFrame) return [242, 242, 245, 255]
    return [0, 0, 0, 0]
  })
}

// A round badge in one colour with a white ring, on a see-through ground. 200 by 200.
export function drawBadge(
  app: ElectronApplication,
  file: string,
  colour: [number, number, number],
): Promise<void> {
  return writePng(app, file, 200, 200, (x, y) => {
    const d = Math.sqrt((x - 100) ** 2 + (y - 100) ** 2)
    if (d > 96) return [0, 0, 0, 0]
    if (d > 84 || (d > 50 && d < 60)) return [255, 255, 255, 255]
    return [...colour, 255]
  })
}
