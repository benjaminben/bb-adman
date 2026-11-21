// spec/editor.md, "The editor screen" [FR-090 to FR-098]: one variant, laid out as the top bar,
// the banner, then the layer list, the canvas and the properties panel. One variant store per
// editor. One layer is selected at a time (A-28); a selected layer that goes away is dropped.
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { useApi, useApp } from '@/renderer/app/app-context'
import { CanvasView } from '@/renderer/editor/canvas-view'
import { EditorBanner } from '@/renderer/editor/editor-banner'
import { LayerList } from '@/renderer/editor/layer-list'
import { LayoutButton } from '@/renderer/editor/layout-button'
import { useLayoutRun } from '@/renderer/editor/layout-run'
import { PropertiesPanel } from '@/renderer/editor/properties-panel'
import { TopBar } from '@/renderer/editor/top-bar'
import { EditorKeyRoot } from '@/renderer/editor/use-editor-key'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import type { Zoom } from '@/renderer/editor/zoom'
import type { TabView } from '@/renderer/stores/nav-store'
import { createVariantStore, type VariantStoreState } from '@/renderer/stores/variant-store'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { useHistory } from './use-history'
import { useOverflowReport } from './use-overflow-report'
import styles from './editor.module.css'

// view and onView: the selected layer and zoom its variant tab keeps (spec/editor.md, "What
// each tab keeps"); the editor starts from view and reports each change.
type Props = {
  projectId: string
  variantId: string
  view?: TabView
  onView?: (change: Partial<TabView>) => void
}

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

export function Editor({ projectId, variantId, view, onView }: Props) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [store] = useState(() => createVariantStore(api, projectId, variantId))
  const state = useStore(store)
  const history = useHistory(projectId, variantId)
  const onSettled = useOverflowReport(projectId, store)
  const root = useRef<HTMLDivElement>(null)
  const [selectedId, setSelectedId] = useState<string | null>(view?.selectedLayerId ?? null)
  const [zoom, setZoom] = useState<Zoom>(view?.zoom ?? 'fit')
  const [cropId, setCropId] = useState<string | null>(null)
  useEffect(() => onView?.({ selectedLayerId: selectedId, zoom }), [onView, selectedId, zoom])

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
  const layoutRun = useLayoutRun(projectId, variantId, scene)

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
              canPlaceText={layoutRun.canPlace}
              onPlaceText={layoutRun.onPlace}
              placing={layoutRun.running}
              layout={
                <LayoutButton
                  projectId={projectId}
                  variant={variant}
                  layers={scene}
                  assets={forScene}
                />
              }
            />
            <EditorBanner
              missingFile={missingFile}
              overflowCount={overflowCount}
              layout={layoutRun.line}
            />
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
                cropId={cropId}
                onCrop={setCropId}
              />
              <PropertiesPanel
                projectId={projectId}
                campaignId={state.campaignId}
                layer={selected}
                layers={Object.values(layers)}
                assets={forRows}
                canvas={variant}
                onCrop={setCropId}
              />
            </div>
            <RunDialog
              {...layoutRun.dialog}
              projectId={projectId}
              job="layout"
              title="Place text with AI"
              confirmLabel="Place text"
              campaignId={state.campaignId ?? undefined}
            />
          </>
        )}
      </div>
    </EditorKeyRoot.Provider>
  )
}
