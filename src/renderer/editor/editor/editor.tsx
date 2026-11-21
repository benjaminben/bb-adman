// spec/editor.md, "The editor screen" [FR-090 to FR-098]: one variant, laid out as the top bar,
// the banner, then the layer list, the canvas and the properties panel. One variant store per
// editor. One layer is selected at a time (A-28); a selected layer that goes away is dropped.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useApi, useApp } from '@/renderer/app/app-context'
import { CanvasView } from '@/renderer/editor/canvas-view'
import { EditorBanner } from '@/renderer/editor/editor-banner'
import { LayerList } from '@/renderer/editor/layer-list'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { TopBar } from '@/renderer/editor/top-bar'
import { EditorKeyRoot } from '@/renderer/editor/use-editor-key'
import type { Zoom } from '@/renderer/editor/zoom'
import { createVariantStore, type VariantStoreState } from '@/renderer/stores/variant-store'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { useHistory } from './use-history'
import { useOverflowReport } from './use-overflow-report'
import styles from './editor.module.css'

type Props = { projectId: string; variantId: string }

function sceneAssets(
  projectId: string,
  { assets, versions }: Pick<VariantStoreState, 'assets' | 'versions'>,
): Record<string, SceneAsset> {
  const out: Record<string, SceneAsset> = {}
  for (const a of Object.values(assets)) {
    if (a.kind !== 'image' && a.kind !== 'font') continue
    const { missing, width, height } = a
    const version = versions[a.id] ?? 0
    out[a.id] = { url: assetUrl(projectId, a.id), kind: a.kind, missing, width, height, version }
  }
  return out
}

// The draft's moving values merged into its layer: what the Scene draws.
function drawn(layers: Record<string, LayerRow>, draft: VariantStoreState['draft']): LayerRow[] {
  return Object.values(layers).map((l) =>
    draft && draft.layerId === l.id ? { ...l, geometry: { ...l.geometry, ...draft.geometry } } : l,
  )
}

export function Editor({ projectId, variantId }: Props) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [store] = useState(() => createVariantStore(api, projectId, variantId))
  const state = useStore(store)
  const history = useHistory(projectId, variantId)
  const onSettled = useOverflowReport(projectId, store)
  const root = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoom, setZoom] = useState<Zoom>('fit')

  useEffect(() => {
    const stop = store.getState().subscribe()
    void store.getState().load()
    return stop
  }, [store])

  const { layers, assets, versions, draft, variant } = state
  const scene = useMemo(() => drawn(layers, draft), [layers, draft])
  const forScene = useMemo(
    () => sceneAssets(projectId, { assets, versions }),
    [projectId, assets, versions],
  )
  const forRows = useMemo(
    () =>
      Object.fromEntries(
        Object.values(assets).map((a) => [a.id, { ...a, version: versions[a.id] ?? 0 }]),
      ),
    [assets, versions],
  )
  const selected = selectedId ? (layers[selectedId] ?? null) : null
  const overflowCount = Object.values(layers).filter((l) => l.type === 'text' && l.overflow).length
  const missingFile = Object.values(assets).some((a) => a.missing)

  async function rename(title: string): Promise<boolean> {
    const result = await command('variant.update', { projectId, variantId, title })
    return result.ok
  }

  return (
    <EditorKeyRoot.Provider value={root}>
      <div ref={root} className={styles.editor}>
        {variant === null ? (
          <p className={styles.loading}>Loading the variant…</p>
        ) : (
          <>
            <TopBar
              variant={variant}
              canUndo={history.canUndo}
              canRedo={history.canRedo}
              onUndo={history.undo}
              onRedo={history.redo}
              onRename={rename}
            />
            <EditorBanner missingFile={missingFile} overflowCount={overflowCount} />
            <div className={styles.body}>
              <LayerList
                projectId={projectId}
                variantId={variantId}
                layers={scene}
                assets={forRows}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
              />
              <CanvasView
                projectId={projectId}
                store={store}
                variant={variant}
                layers={scene}
                assets={forScene}
                zoom={zoom}
                onZoom={setZoom}
                selectedId={selected?.id ?? null}
                onSelect={setSelectedId}
                onSettled={onSettled}
              />
              <PropertiesPanel
                projectId={projectId}
                campaignId={state.campaignId}
                layer={selected}
                layers={Object.values(layers)}
                assets={forRows}
                canvas={variant}
              />
            </div>
          </>
        )}
      </div>
    </EditorKeyRoot.Provider>
  )
}
