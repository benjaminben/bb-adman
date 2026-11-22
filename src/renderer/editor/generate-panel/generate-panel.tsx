// "Generate" (spec/phases/round-2-editor.md D4, R2E-4): the properties panel's group for image
// and background layers, between "Shade" and "Position and size". It holds the line about
// videos for this layer, "Start from", the generate fields with the start picture they send
// first, then the earlier options (P4-18). Pictures only: the run goes through the run dialog
// and its confirm as before. Disabled parts follow the layer's lock. The draft's last picture
// run is drawn first in the earlier options, under "New pictures" (R2E-5, D6). R2E-8: on the
// background of a video post, "Make" switches to the video fields, chosen first when some
// available provider makes videos.
import { useCallback, useEffect, useState } from 'react'
import { useStore } from 'zustand'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import {
  draftKey,
  draftOf,
  generateDrafts,
  type GenerateKind,
} from '@/renderer/stores/generate-drafts'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import layout from '@/renderer/ui/layout.module.css'
import { anyStarts, mostReferences } from './card-starts'
import { MakeSwitch } from './make-switch'
import { shaped } from './same-shape-list'
import { shownStart, StartFrom, startChoices } from './start-from'
import { useComfyInfo } from './video-length'
import { VideoFields } from './video-fields'
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

function videoLine(
  type: LayerRow['type'],
  format: 'image' | 'video',
  kind: GenerateKind,
): string | null {
  if (format === 'video') {
    if (type !== 'background') return 'Videos are made on the background layer.'
    return kind === 'image'
      ? 'On a video post, the clips on the timeline show over this picture.'
      : null
  }
  return type === 'background' ? 'To make a video, set Format to Video in the top bar first.' : null
}

// The project's images, read once and again after an import or when the layer's picture is
// not among them.
function useImages(projectId: string) {
  const api = useApi()
  const [images, setImages] = useState<AssetList | null>(null)
  const list = useCallback(async () => {
    const got = await api.query('asset.list', { projectId, kind: 'image' })
    return got.ok ? ((got.data as AssetList | null) ?? []) : []
  }, [api, projectId])
  const read = useCallback(async () => {
    const rows = await list()
    setImages(rows)
    return rows
  }, [list])
  useEffect(() => {
    let live = true
    void list().then((rows) => {
      if (live) setImages(rows)
    })
    return () => {
      live = false
    }
  }, [list])
  return { images, read }
}

// The providers that can make a video now (available, with their keys saved), and the kind
// the layer shows.
function useKind(key: string, videoPost: boolean) {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const saved = useApp((s) => s.app?.secrets ?? EMPTY)
  const keyed = (names: readonly string[]) => names.every((n) => saved.some((s) => s.name === n))
  const ids = providers
    .filter((p) => p.available && p.jobs.includes('video') && keyed(p.secrets))
    .map((p) => p.id)
  const canVideo = videoPost && ids.length > 0
  // A kind not yet chosen (no draft, or one made on an image post) is "Video" here.
  const held = useStore(generateDrafts, (s) => s.drafts[key]?.kind ?? s.wanted[key])
  const made = useStore(generateDrafts, (s) => s.drafts[key] !== undefined)
  useEffect(() => {
    if (!canVideo) return
    const drafts = generateDrafts.getState()
    if (!made) drafts.wantKind(key, 'video')
    else if (drafts.drafts[key]?.kind === undefined) drafts.change(key, { kind: 'video' })
  }, [canVideo, key, made])
  const kind: GenerateKind = canVideo && (held ?? 'video') === 'video' ? 'video' : 'image'
  return { ids, kind }
}

export function GeneratePanel(props: GeneratePanelProps) {
  const { projectId, layer } = props
  const format = props.format ?? 'image'
  const key = draftKey(projectId, layer.id)
  const draft = draftOf(useStore(generateDrafts, (s) => s.drafts[key]))
  const videoPost = format === 'video' && layer.type === 'background'
  const { ids, kind } = useKind(key, videoPost)
  const info = useComfyInfo()
  const { images, read } = useImages(projectId)
  const own = layer.source?.assetId ?? null
  const layerPicture = images?.some((a) => a.id === own && !a.missing) ? own : null
  // A picture put on the layer after the read (a run's first picture, R2E-5): read again.
  const unknown = images !== null && own !== null && !images.some((a) => a.id === own)
  useEffect(() => {
    if (unknown) void read()
  }, [unknown, read])
  const chosen = draft?.startAssetId ?? null
  const fits = images !== null && shaped(images, { box: layer.geometry, ownId: own })
  const shapePicture = fits && fits.some((a) => a.id === chosen) ? chosen : null
  const choices = startChoices(kind, anyStarts(info, ids))
  const shown = shownStart(choices, draft?.start)
  const start = shown === 'layer' ? layerPicture : shown === 'shape' ? shapePicture : undefined
  const line = videoLine(layer.type, format, kind)
  const change = generateDrafts.getState().change
  const run = draft?.run
  const newJobId = run && run.kind !== 'video' ? run.jobId : undefined

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Generate</legend>
      {videoPost && (
        <MakeSwitch
          kind={kind}
          videoOff={ids.length === 0}
          disabled={layer.locked || draft === undefined}
          onChange={(next) => change(key, { kind: next })}
        />
      )}
      {line !== null && <p className={layout.muted}>{line}</p>}
      <StartFrom
        projectId={projectId}
        layer={layer}
        draft={draft}
        choices={choices}
        start={shown}
        layerPicture={layerPicture}
        images={images}
        read={read}
        onChange={(patch) => change(key, patch)}
      />
      {kind === 'video' ? (
        <VideoFields
          projectId={projectId}
          campaignId={props.campaignId}
          layer={layer}
          {...(props.layers ? { layers: props.layers } : {})}
          start={shown}
          picture={start ?? null}
          most={mostReferences(info, ids)}
        />
      ) : (
        <GenerateFields
          projectId={projectId}
          campaignId={props.campaignId}
          layer={layer}
          {...(props.layers ? { layers: props.layers } : {})}
          {...(start === undefined ? {} : { start })}
        />
      )}
      <EarlierOptions
        projectId={projectId}
        layer={layer}
        {...(newJobId === undefined ? {} : { newJobId })}
      />
    </fieldset>
  )
}
