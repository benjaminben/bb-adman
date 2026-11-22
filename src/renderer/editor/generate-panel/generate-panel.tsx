// "Generate" (spec/phases/round-2-editor.md D4, R2E-4): the properties panel's group for image
// and background layers, between "Shade" and "Position and size". It holds the line about
// videos for this layer, "Start from", the generate fields with the start picture they send
// first, then the earlier options (P4-18). Pictures only: the run goes through the run dialog
// and its confirm as before. Disabled parts follow the layer's lock.
import { useCallback, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { useApi } from '@/renderer/app/app-context'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { draftKey, draftOf, generateDrafts } from '@/renderer/stores/generate-drafts'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import layout from '@/renderer/ui/layout.module.css'
import { shaped } from './same-shape-list'
import { StartFrom } from './start-from'
import styles from './generate-panel.module.css'

export type GeneratePanelProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow
  // The variant's layers, so the first draft knows whether the ad already holds words (R2E-1).
  layers?: LayerRow[]
  // The post's format; a video post has its own lines.
  format?: 'image' | 'video'
}

function videoLine(type: LayerRow['type'], format: 'image' | 'video'): string | null {
  if (format === 'video') {
    return type === 'background'
      ? 'On a video post, the clips on the timeline show over this picture.'
      : 'Videos are made on the background layer.'
  }
  return type === 'background' ? 'To make a video, set Format to Video in the top bar first.' : null
}

// The project's images, read once and again after an import.
function useImages(projectId: string) {
  const api = useApi()
  const [images, setImages] = useState<AssetList | null>(null)
  const read = useCallback(async () => {
    const got = await api.query('asset.list', { projectId, kind: 'image' })
    const rows = got.ok ? ((got.data as AssetList | null) ?? []) : []
    setImages(rows)
    return rows
  }, [api, projectId])
  useEffect(() => {
    void read()
  }, [read])
  return { images, read }
}

export function GeneratePanel(props: GeneratePanelProps) {
  const { projectId, layer } = props
  const key = draftKey(projectId, layer.id)
  const draft = draftOf(useStore(generateDrafts, (s) => s.drafts[key]))
  const { images, read } = useImages(projectId)
  const own = layer.source?.assetId ?? null
  const layerPicture = images?.some((a) => a.id === own && !a.missing) ? own : null
  const chosen = draft?.startAssetId ?? null
  const fits = images !== null && shaped(images, { box: layer.geometry, ownId: own })
  const shapePicture = fits && fits.some((a) => a.id === chosen) ? chosen : null
  const start =
    draft?.start === 'layer' ? layerPicture : draft?.start === 'shape' ? shapePicture : undefined
  const line = videoLine(layer.type, props.format ?? 'image')

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Generate</legend>
      {line !== null && <p className={layout.muted}>{line}</p>}
      <StartFrom
        projectId={projectId}
        layer={layer}
        draft={draft}
        layerPicture={layerPicture}
        images={images}
        read={read}
        onChange={(patch) => generateDrafts.getState().change(key, patch)}
      />
      <GenerateFields
        projectId={projectId}
        campaignId={props.campaignId}
        layer={layer}
        {...(props.layers ? { layers: props.layers } : {})}
        {...(start === undefined ? {} : { start })}
      />
      <EarlierOptions projectId={projectId} layer={layer} />
    </fieldset>
  )
}
