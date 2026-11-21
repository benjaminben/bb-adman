// spec/editor-commands.md, "layer.create": the starting values of a layer the user adds. A
// picture layer starts as any other image slot of the default layout and a text layer as
// any other copy slot, so the boxes and styles come from config/default-layout.ts through
// buildMasterLayers, the one owner of that rule. Pure; fresh values on every call.
import { buildMasterLayers } from '@/shared/templates/master-layers'
import type { NewLayer, Template } from '@/shared/templates/types'

export type NewLayerValues = Omit<NewLayer, 'key' | 'z'>

// A slot ID no layout names, so the "any other slot" rows of the default layout apply.
const ADDED = 'added'
const TEXT = 'Your text'

const templateFor = (type: 'image' | 'text'): Template => ({
  id: ADDED,
  name: ADDED,
  slots: [{ id: ADDED, type: type === 'text' ? 'copy' : 'image' }],
})

export function newLayerValues(
  type: 'image' | 'text',
  size: { width: number; height: number },
  count: number,
): NewLayerValues {
  const fill = type === 'text' ? { text: TEXT } : { assetId: ADDED }
  const label = `${size.width}x${size.height}`
  const built = buildMasterLayers(templateFor(type), { label, ...size }, { [ADDED]: fill })[1]
  if (!built) throw new Error('newLayerValues: the default layout made no layer')
  const name = type === 'text' ? `Text ${count + 1}` : `Picture ${count + 1}`
  return {
    type: built.type,
    slot: null,
    name,
    copy: built.copy,
    style: built.style,
    geometry: built.geometry,
    source: null,
    visible: built.visible,
    locked: built.locked,
    linked: built.linked,
    overrides: built.overrides,
    timing: built.timing,
    animation: built.animation,
    revs: built.revs,
    syncedRevs: built.syncedRevs,
    translationStatus: built.translationStatus,
    translationSource: built.translationSource,
    overflow: built.overflow,
  }
}
