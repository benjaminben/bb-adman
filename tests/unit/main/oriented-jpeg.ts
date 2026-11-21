// A JPEG start with an Exif orientation tag: the start marker, an APP1 "Exif" segment holding
// a big-endian TIFF block with one entry (orientation, SHORT, 1, tag), then a frame header
// (FFC0) with the stored height and width. Enough for the header checks and the tag reader.
export function orientedJpegHead(width: number, height: number, tag: number): Uint8Array {
  const tiff = [0x4d, 0x4d, 0, 42, 0, 0, 0, 8, 0, 1, 0x01, 0x12, 0, 3, 0, 0, 0, 1, 0, tag, 0, 0]
  const body = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff, 0, 0, 0, 0]
  const length = body.length + 2
  return new Uint8Array([
    ...[0xff, 0xd8],
    ...[0xff, 0xe1, length >> 8, length & 0xff, ...body],
    ...[0xff, 0xc0, 0x00, 0x0b, 0x08, height >> 8, height & 0xff, width >> 8, width & 0xff],
    ...[0x01, 0x01, 0x11, 0x00],
  ])
}

// A stand-in for a decoded nativeImage that also has its bitmap: a grid of one-byte colours,
// four equal bytes a pixel. Its "PNG" is width, height, then one byte a pixel.
export type BitmapImage = {
  grid: number[][]
  isEmpty(): boolean
  getSize(): { width: number; height: number }
  toBitmap(): Buffer
  toPNG(): Buffer
}

export function bitmapImage(grid: number[][]): BitmapImage {
  const height = grid.length
  const width = grid[0]?.length ?? 0
  return {
    grid,
    isEmpty: () => width === 0 || height === 0,
    getSize: () => ({ width, height }),
    toBitmap: () => Buffer.from(grid.flat().flatMap((c) => [c, c, c, c])),
    toPNG: () =>
      Buffer.from([width >> 8, width & 0xff, height >> 8, height & 0xff, ...grid.flat()]),
  }
}

// The grid a bitmap of four bytes a pixel holds, read from each pixel's first byte.
export function gridOf(data: Buffer, size: { width: number; height: number }): number[][] {
  return Array.from({ length: size.height }, (_, y) =>
    Array.from({ length: size.width }, (_, x) => data[(y * size.width + x) * 4] ?? 0),
  )
}
