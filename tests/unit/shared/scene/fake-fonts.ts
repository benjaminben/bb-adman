// jsdom has no Font Loading API and no img.decode. Import this file before the Scene
// so its module-load font registration finds them.
export type FakeFace = { family: string; source: string; descriptors: FontFaceDescriptors }

export const faces: FakeFace[] = []
export const fontSet = new Set<FakeFace>()

class FakeFontFace {
  family: string
  source: string
  descriptors: FontFaceDescriptors
  constructor(family: string, source: string, descriptors: FontFaceDescriptors) {
    this.family = family
    this.source = source
    this.descriptors = descriptors
    faces.push(this)
  }
  load(): Promise<this> {
    return Promise.resolve(this)
  }
}

Object.assign(globalThis, { FontFace: FakeFontFace })
Object.defineProperty(document, 'fonts', { value: fontSet, configurable: true })
HTMLImageElement.prototype.decode = () => Promise.resolve()
