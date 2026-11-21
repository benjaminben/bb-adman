// CoreDeps.exportPictures (spec/phases/phase-08.md "Drawing at full size"). `decode` is
// Electron's nativeImage.createFromBuffer and `fromBitmap` its createFromBitmap; both are passed
// in so this file needs no Electron to be tested (the png-converter.ts model).
// Stub (P8-1): each member throws until P8-4 replaces the body.
import type { ExportPictures } from './types'

type Size = { width: number; height: number }

// The parts of a nativeImage the encoder may use.
export type EncoderImage = {
  isEmpty(): boolean
  getSize(): Size
  toBitmap(): Buffer
  toPNG(): Buffer
  toJPEG(quality: number): Buffer
}

const notBuilt = (): never => {
  throw new Error('The export picture encoder is not built yet.')
}

export function createExportPictures(
  _decode: (bytes: Buffer) => EncoderImage,
  _fromBitmap: (data: Buffer, size: Size) => EncoderImage,
): ExportPictures {
  return { toJpeg: notBuilt, stitch: notBuilt, shrink: notBuilt }
}
