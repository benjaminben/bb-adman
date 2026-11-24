// Where the quickstart writes: in each ad set's folder, one folder per language, then per size,
// holding the finished ad, its picture as made, each layer drawn alone, and the layout as
// numbers. Folder names are cleaned, so a brief cannot name a place outside the output folder.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Variant } from './layers'
import { sceneVariant } from './run'
import type { Picture, Studio } from './studio'

export type WrittenAd = {
  folder: string
  // Whether each layer's words overflow their box, by layer ID, as the drawing page measured.
  overflow: Record<string, boolean>
}

// Plain letters and digits kept (an accent is dropped), anything else a dash.
export function safeName(text: string, fallback: string): string {
  const cleaned = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned === '' ? fallback : cleaned
}

export const campaignFolder = (root: string, campaignName: string) =>
  join(root, safeName(campaignName, 'campaign').toLowerCase())

export const adFolder = (campaign: string, variant: Variant) =>
  join(campaign, safeName(variant.language, 'language'), variant.size.label)

export const layerFile = (layer: LayerRow) => `${layer.z + 1}-${safeName(layer.key, 'layer')}.png`

const byZ = (layers: LayerRow[]) => [...layers].sort((a, b) => a.z - b.z)

// The layout as numbers: what a person would need to rebuild the ad from its layers.
export function layoutOf(variant: Variant) {
  const { language, size } = variant
  return {
    language,
    size,
    layers: byZ(variant.layers).map((layer) => ({
      file: `layers/${layerFile(layer)}`,
      key: layer.key,
      type: layer.type,
      text: layer.copy,
      translation: layer.translationSource,
      box: layer.geometry,
      style: layer.style,
    })),
  }
}

const PICTURE_ENDINGS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}

// The file of the picture as made: picture.png for a PNG, as the providers return it. A JPEG
// or WebP keeps its bytes as they are, so its file ends as its type does.
export const pictureFile = (mime: string) => `picture.${PICTURE_ENDINGS[mime] ?? 'png'}`

// One ad, in its set's folder: final.png, the picture it uses exactly as the provider returned
// it, each layer alone on a see-through canvas of the ad's size, and layout.json.
export async function writeAd(
  studio: Studio,
  setFolder: string,
  variant: Variant,
  picture: Picture,
): Promise<WrittenAd> {
  const folder = adFolder(setFolder, variant)
  await mkdir(join(folder, 'layers'), { recursive: true })
  const scene = sceneVariant(variant.size, variant.language)
  const final = await studio.draw(scene, variant.layers, 'full')
  await writeFile(join(folder, 'final.png'), final.png)
  await writeFile(join(folder, pictureFile(picture.mime)), picture.bytes)
  for (const layer of byZ(variant.layers)) {
    const mode = layer.type === 'background' ? 'full' : 'overlay-only'
    const alone = await studio.draw(scene, [layer], mode)
    await writeFile(join(folder, 'layers', layerFile(layer)), alone.png)
  }
  await writeFile(join(folder, 'layout.json'), `${JSON.stringify(layoutOf(variant), null, 2)}\n`)
  return { folder, overflow: final.overflow }
}
