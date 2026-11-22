// The Generate panel's video fields (spec/phases/round-2-editor.md D4): the reference pictures
// for that start, "Prompt" (the layer's draft, shared with pictures), "Clip length (seconds)"
// and "Generate…", which opens the run dialog for a video. Only that dialog's own Generate
// sends generation.startVideo, with the provider, the length and the pictures the dialog named
// (video-lengths.ts) and this layer, so the clip takes the still's place (D5).
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import type { VideoSent } from '@/renderer/dialogs/run-dialog/run-summary'
import { RunStatus } from '@/renderer/editor/generate-fields/run-status'
import { useFirstDraft } from '@/renderer/editor/generate-fields/use-first-draft'
import { VideoPictureChoice } from '@/renderer/screens/campaign/video-picture-choice'
import { draftOf, generateDrafts, type GenerateStart } from '@/renderer/stores/generate-drafts'
import type { JobStarted } from '@/shared/schemas/commands/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Result } from '@/shared/schemas/result'
import layout from '@/renderer/ui/layout.module.css'
import { cardStartFields } from './card-starts'
import { VIDEO_START } from './start-from'
import { LENGTH_PROBLEM, typedSeconds } from './video-length'
import styles from './generate-panel.module.css'

export type VideoFieldsProps = {
  projectId: string
  campaignId: string | null
  layer: LayerRow
  layers?: LayerRow[]
  start: GenerateStart
  // The picture "This layer's picture" or "Another picture of the same shape…" sends; null
  // when there is none.
  picture: string | null
  // The pictures "Reference pictures" may take.
  most: number
}

const NOT_SENT: Result<unknown> = {
  ok: false,
  error: { code: 'INVALID_INPUT', message: 'Check the values.' },
}

export function VideoFields(props: VideoFieldsProps) {
  const { projectId, layer, start } = props
  const command = useApp((s) => s.command)
  const first = useFirstDraft(projectId, props.campaignId, layer, props.layers)
  const { key, subjectId } = first
  const draft = draftOf(first.draft)
  const [open, setOpen] = useState(false)
  const promptId = useId()
  const change = generateDrafts.getState().change
  const kind = VIDEO_START[start]
  const chosen = (draft?.videoPictureIds ?? []).slice(0, props.most)
  const pictures = start === 'references' ? chosen : props.picture === null ? [] : [props.picture]
  const seconds = typedSeconds(draft?.seconds ?? '')
  const disabled = layer.locked || draft === undefined
  const needsPicture = start !== 'prompt' && pictures.length === 0
  const ready = seconds !== null && !needsPicture && (draft?.prompt ?? '').trim() !== ''

  async function confirm(provider: string, _count: number | null, sent?: VideoSent) {
    if (sent === undefined || draft === undefined) return NOT_SENT
    const reply = await command('generation.startVideo', {
      projectId,
      variantId: layer.variantId,
      prompt: draft.prompt,
      durationMs: sent.seconds * 1000,
      provider,
      ...cardStartFields(kind, pictures, kind === 'background' ? 0 : sent.pictures),
      layerId: layer.id,
    })
    const jobId = reply.ok ? (reply.data as Partial<JobStarted> | null)?.jobId : undefined
    if (typeof jobId === 'string') {
      change(key, { run: { jobId, count: 1, kind: 'video' } })
      setOpen(false)
    }
    return reply
  }

  return (
    <div className={styles.fields}>
      {start === 'references' && draft && (
        <VideoPictureChoice
          projectId={projectId}
          subjectId={subjectId}
          chosen={chosen}
          most={props.most}
          onChoose={(videoPictureIds) => change(key, { videoPictureIds })}
        />
      )}
      <label htmlFor={promptId} className={layout.label}>
        Prompt
      </label>
      <textarea
        id={promptId}
        className={`${styles.prompt} ${layout.reading}`}
        rows={5}
        value={draft?.prompt ?? ''}
        disabled={disabled}
        onChange={(e) => change(key, { prompt: e.target.value, promptTyped: true })}
      />
      <label className={`${layout.label} ${styles.length}`}>
        Clip length (seconds)
        <input
          type="number"
          min={1}
          step={1}
          value={draft?.seconds ?? ''}
          disabled={disabled}
          onChange={(e) => change(key, { seconds: e.target.value })}
        />
      </label>
      {draft && seconds === null && <p className={layout.muted}>{LENGTH_PROBLEM}</p>}
      <div className={layout.row}>
        <button type="button" disabled={disabled || !ready} onClick={() => setOpen(true)}>
          Generate…
        </button>
      </div>
      {draft?.run?.kind === 'video' && (
        <RunStatus projectId={projectId} layerId={layer.id} run={draft.run} />
      )}
      <RunDialog
        open={open}
        projectId={projectId}
        job="video"
        title="Make a video"
        confirmLabel="Generate"
        video={{ start: kind, seconds: seconds ?? 1 }}
        referenceCount={pictures.length}
        {...(props.campaignId === null ? {} : { campaignId: props.campaignId })}
        onConfirm={confirm}
        onCancel={() => setOpen(false)}
      />
    </div>
  )
}
