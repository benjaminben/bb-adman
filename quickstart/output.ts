// Where the quickstart writes: one folder per language, then per size, holding the finished ad,
// each layer drawn alone, and the layout as numbers. Folder names are cleaned, so a brief
// cannot name a place outside the output folder.
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Variant } from './layers'
import { sceneVariant } from './run'
import type { Studio } from './studio'

export type WrittenAd = {
  language: string
  size: string
  folder: string
  // The names of the text layers whose words do not fit their box.
  overflowing: string[]
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

// One ad: final.png, each layer alone on a see-through canvas of the ad's size, layout.json.
export async function writeAd(
  studio: Studio,
  campaign: string,
  variant: Variant,
): Promise<WrittenAd> {
  const folder = adFolder(campaign, variant)
  await mkdir(join(folder, 'layers'), { recursive: true })
  const scene = sceneVariant(variant.size, variant.language)
  const final = await studio.draw(scene, variant.layers, 'full')
  await writeFile(join(folder, 'final.png'), final.png)
  for (const layer of byZ(variant.layers)) {
    const mode = layer.type === 'background' ? 'full' : 'overlay-only'
    const alone = await studio.draw(scene, [layer], mode)
    await writeFile(join(folder, 'layers', layerFile(layer)), alone.png)
  }
  await writeFile(join(folder, 'layout.json'), `${JSON.stringify(layoutOf(variant), null, 2)}\n`)
  const overflowing = variant.layers.filter((l) => final.overflow[l.id]).map((l) => l.name)
  return { language: variant.language, size: variant.size.label, folder, overflowing }
}
