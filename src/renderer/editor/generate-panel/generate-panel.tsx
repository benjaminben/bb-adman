// "Generate" (spec/phases/round-2-editor.md D4, R2E-4; design wave ED-4a): the properties
// panel's Section for image and background layers. It holds "Make" (Picture or Video, with the
// reason when a video cannot be made here), "Start from" as tiles, the generate fields with the
// start picture they send first, then the earlier options (P4-18). The run goes through the run
// dialog, whose own button is the one send (C-15); nothing here sends a command. Disabled parts
// follow the layer's lock. The draft's last picture run is drawn first in the earlier options
// (R2E-5, D6). The Section's summary is "Running" while the draft's run goes. R2E-11 (D7):
// askPromptFocus puts the focus on a layer's "Prompt" once its panel shows it enabled.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { useApi } from '@/renderer/app/app-context'
import { EarlierOptions } from '@/renderer/editor/earlier-options'
import { GenerateFields } from '@/renderer/editor/generate-fields'
import { draftKey, draftOf, generateDrafts } from '@/renderer/stores/generate-drafts'
import { Section } from '@/renderer/ui/section'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { anyStarts, mostReferences } from './card-starts'
import { MakeSwitch } from './make-switch'
import { shaped } from './same-shape-list'
import { shownStart, StartFrom, startChoices } from './start-from'
import { useKind, useRunGoing, videoReason } from './use-kind'
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

// The layer whose "Prompt" should take the focus, until it does.
const promptFocus = createStore<{ key: string | null }>(() => ({ key: null }))
export const askPromptFocus = (key: string) => promptFocus.setState({ key })

function usePromptFocus(key: string) {
  const section = useRef<HTMLDivElement>(null)
  const asked = useStore(promptFocus, (s) => s.key === key)
  useEffect(() => {
    const prompt = asked ? section.current?.querySelector('textarea') : null
    if (!prompt || prompt.disabled) return
    prompt.focus()
    promptFocus.setState({ key: null })
  })
  return section
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

export function GeneratePanel(props: GeneratePanelProps) {
  const { projectId, layer } = props
  const format = props.format ?? 'image'
  const key = draftKey(projectId, layer.id)
  const draft = draftOf(useStore(generateDrafts, (s) => s.drafts[key]))
  const videoPost = format === 'video' && layer.type === 'background'
  const { ids, kind } = useKind(key, videoPost)
  const section = usePromptFocus(key)
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
  const reason = videoReason(layer.type, format, ids.length)
  const change = generateDrafts.getState().change
  const run = draft?.run
  const newJobId = run && run.kind !== 'video' ? run.jobId : undefined
  const going = useRunGoing(projectId, layer.id, run?.jobId ?? null)

  return (
    <Section
      id="props.generate"
      title="Generate"
      level={4}
      {...(going ? { summary: <StatusMark tone="running" label="Running" tip="Running" /> } : {})}
    >
      <div ref={section} className={styles.section}>
        <MakeSwitch
          kind={kind}
          videoReason={reason}
          videoPost={videoPost}
          disabled={layer.locked || draft === undefined}
          onChange={(next) => change(key, { kind: next })}
        />
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
      </div>
    </Section>
  )
}
