// A stand-in for Electron's nativeImage: a grid of colour numbers, one per pixel, with the
// crop, resize and toPNG the fitter uses. Its "PNG" is width, height, then one byte a pixel.
export type Grid = number[][]

type Rect = { x: number; y: number; width: number; height: number }

export type FakeImage = {
  grid: Grid
  isEmpty(): boolean
  getSize(): { width: number; height: number }
  crop(rect: Rect): FakeImage
  resize(options: { width: number; height: number; quality: 'best' }): FakeImage
  toPNG(): Buffer
}

export type Calls = { decode: number; crops: Rect[]; resizes: Array<Record<string, unknown>> }

export function fakeImage(grid: Grid, calls: Calls): FakeImage {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  return {
    grid,
    isEmpty: () => width === 0 || height === 0,
    getSize: () => ({ width, height }),
    crop(rect) {
      calls.crops.push(rect)
      const rows = grid.slice(rect.y, rect.y + rect.height)
      return fakeImage(
        rows.map((row) => row.slice(rect.x, rect.x + rect.width)),
        calls,
      )
    },
    resize(options) {
      calls.resizes.push(options)
      const rows = Array.from({ length: options.height }, (_, y) =>
        Array.from({ length: options.width }, (_, x) => {
          const sy = Math.floor((y * height) / options.height)
          const sx = Math.floor((x * width) / options.width)
          return grid[sy]?.[sx] ?? 0
        }),
      )
      return fakeImage(rows, calls)
    },
    toPNG: () =>
      Buffer.from([width >> 8, width & 0xff, height >> 8, height & 0xff, ...grid.flat()]),
  }
}

// A decoder that gives the grid for any bytes and counts its calls.
export function gridDecoder(grid: Grid) {
  const calls: Calls = { decode: 0, crops: [], resizes: [] }
  const decode = (_buffer: Buffer) => {
    calls.decode += 1
    return fakeImage(grid, calls)
  }
  return { calls, decode }
}

// Rows of colour bands: each band is [colour, number of rows]. Every row is `width` wide.
export function bands(width: number, rows: Array<[number, number]>): Grid {
  return rows.flatMap(([colour, count]) =>
    Array.from({ length: count }, () => Array.from({ length: width }, () => colour)),
  )
}

// Columns of colour bands, the wide counterpart of `bands`.
export function columns(height: number, cols: Array<[number, number]>): Grid {
  const row = cols.flatMap(([colour, count]) => Array.from({ length: count }, () => colour))
  return Array.from({ length: height }, () => [...row])
}

// Reads the fake PNG back: its size and the grid.
export function readFake(png: Uint8Array): { width: number; height: number; grid: Grid } {
  const [w1 = 0, w2 = 0, h1 = 0, h2 = 0] = png
  const width = (w1 << 8) | w2
  const height = (h1 << 8) | h2
  const pixels = [...png.slice(4)]
  const grid = Array.from({ length: height }, (_, y) => pixels.slice(y * width, (y + 1) * width))
  return { width, height, grid }
}

// A PNG head: signature, IHDR length and type, width and height (big-endian).
export function pngHead(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24)
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0)
  bytes.set([0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 8)
  const view = new DataView(bytes.buffer)
  view.setUint32(16, width)
  view.setUint32(20, height)
  return bytes
}

// A JPEG start: the start marker, then a frame header (FFC0) with height and width.
export function jpegHead(width: number, height: number): Uint8Array {
  return new Uint8Array([
    ...[0xff, 0xd8],
    ...[0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff],
    ...[0x01, 0x01, 0x11, 0x00],
  ])
}
