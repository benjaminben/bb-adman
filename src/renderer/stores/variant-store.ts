// spec/editor.md, "The variant store": one store per open variant. Loads variant.get and keeps
// it current from project.changed and asset.changedOnDisk. The window applies nothing before the
// main process confirms it, apart from the draft: the moving values of one layer during a drag.
import { createStore, type StoreApi } from 'zustand/vanilla'
import type { AdmanApi } from '@/shared/schemas/api'
import type { ProjectChangedPayload } from '@/shared/schemas/events'
import type { Geometry } from '@/shared/schemas/layer'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import { AssetRow } from '@/shared/schemas/rows/asset'
import { LayerRow } from '@/shared/schemas/rows/layer'
import { VariantRow } from '@/shared/schemas/rows/variant'

export type HeldAsset = AssetRow & { missing: boolean }
export type Draft = { layerId: string; geometry: Partial<Geometry> }

export type VariantStoreState = {
  variant: VariantSummary | null
  campaignId: string | null
  layers: Record<string, LayerRow>
  assets: Record<string, HeldAsset>
  versions: Record<string, number> // per asset; goes up when its file changed on disk
  draft: Draft | null
  load(): Promise<void>
  subscribe(): () => void
  setDraft(layerId: string, geometry: Partial<Geometry>): void
  dropDraft(): void
}

export type VariantStore = StoreApi<VariantStoreState>

const byId = <T extends { id: string }>(rows: T[]): Record<string, T> =>
  Object.fromEntries(rows.map((row) => [row.id, row]))

function namedAssets(layer: LayerRow): string[] {
  const font = 'fontAssetId' in layer.style ? layer.style.fontAssetId : null
  return [layer.source?.assetId, font].filter((id): id is string => typeof id === 'string')
}

function parsed<T>(schema: { safeParse(v: unknown): { success: boolean; data?: T } }) {
  return (rows: unknown[] | undefined): T[] =>
    (rows ?? []).flatMap((row) => {
      const result = schema.safeParse(row)
      return result.success && result.data ? [result.data] : []
    })
}
const variantRows = parsed<VariantRow>(VariantRow)
const layerRows = parsed<LayerRow>(LayerRow)
const assetRows = parsed<AssetRow>(AssetRow)

export function createVariantStore(
  api: AdmanApi,
  projectId: string,
  variantId: string,
): VariantStore {
  // Counts events that touched this variant, so a reply that an event overtook is dropped.
  let touches = 0

  return createStore<VariantStoreState>((set, get) => {
    function take(data: VariantGet) {
      const held = get().versions
      set({
        variant: data.variant,
        campaignId: data.campaignId,
        layers: byId(data.layers),
        assets: byId(data.assets),
        versions: Object.fromEntries(data.assets.map((a) => [a.id, held[a.id] ?? 0])),
      })
    }

    async function load(): Promise<void> {
      for (;;) {
        const started = touches
        const result = await api.query('variant.get', { projectId, variantId })
        if (started !== touches) continue
        if (result.ok && result.data) take(result.data as VariantGet)
        return
      }
    }

    function applyChanged(event: ProjectChangedPayload) {
      if (event.projectId !== projectId) return
      const s = get()
      const variantRow = variantRows(event.changed.variant).find((v) => v.id === variantId)
      const layers = layerRows(event.changed.layer).filter((l) => l.variantId === variantId)
      const removed = (event.removed.layer ?? []).filter((id) => id in s.layers)
      const assets = assetRows(event.changed.asset).filter((a) => a.id in s.assets)
      if (!variantRow && layers.length === 0 && removed.length === 0 && assets.length === 0) return
      touches += 1
      const nextLayers = { ...s.layers, ...byId(layers) }
      for (const id of removed) delete nextLayers[id]
      const nextAssets = { ...s.assets }
      for (const a of assets) nextAssets[a.id] = { ...a, missing: s.assets[a.id]?.missing ?? false }
      set({
        variant: variantRow && s.variant ? { ...s.variant, ...variantRow } : s.variant,
        layers: nextLayers,
        assets: nextAssets,
      })
      if (layers.some((l) => namedAssets(l).some((id) => !(id in nextAssets)))) void load()
    }

    function applyChangedOnDisk(event: { projectId: string; assetIds: string[] }) {
      if (event.projectId !== projectId) return
      const versions = { ...get().versions }
      const held = event.assetIds.filter((id) => id in versions)
      if (held.length === 0) return
      for (const id of held) versions[id] = (versions[id] ?? 0) + 1
      set({ versions })
    }

    return {
      variant: null,
      campaignId: null,
      layers: {},
      assets: {},
      versions: {},
      draft: null,
      load,
      subscribe() {
        const off = [
          api.on('project.changed', applyChanged),
          api.on('asset.changedOnDisk', applyChangedOnDisk),
        ]
        return () => off.forEach((stop) => stop())
      },
      setDraft: (layerId, geometry) => set({ draft: { layerId, geometry } }),
      dropDraft: () => set({ draft: null }),
    }
  })
}
