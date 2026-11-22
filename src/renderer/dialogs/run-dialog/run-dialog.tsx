// The run confirmation dialog (spec/screens-ai.md, "The run confirmation dialog"; FR-064,
// FR-067, FR-230, FR-256): every AI run the user starts in Phase 4 goes through it. It chooses
// the provider and the count; the caller sends the command from `onConfirm` and returns the
// reply. From the click until that reply, Confirm and Cancel are disabled and the dialog
// cannot close; a refusal shows inside it (A-50). Nothing is sent before the click. The
// starting choice depends on comfy.getInfo, so until it answers nothing can be chosen or sent.
// R2E-8 (round-2-editor.md D4): a video names the length and pictures the chosen provider will
// be sent (video-lengths.ts) and hands those same numbers to `onConfirm`.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import {
  clipBounds,
  videoPictures,
  videoSeconds,
} from '@/renderer/editor/generate-panel/video-lengths'
import { useComfyInfoState } from '@/renderer/screens/campaign/use-comfy-info'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { PaidCount } from '@/renderer/ui/paid-count'
import type { VideoStartKind } from '@/shared/config/video-offers'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import { ProviderChoice, runChoices, startChoice } from './provider-choice'
import { lengthLine, runSummary, type RunJob, type VideoSent } from './run-summary'
import styles from './run-dialog.module.css'

export type RunCount = { label: string; value: number; min: number; max: number }

export type RunDialogProps = {
  open: boolean
  projectId: string
  job: RunJob
  title: string
  confirmLabel: string
  count?: RunCount
  referenceCount?: number
  // P6-18: a text run's paid requests, when it sends more than one.
  requests?: number
  campaignId?: string
  // A retry: the provider (and the count) are the failed run's, shown, not chosen.
  retry?: { provider: string }
  // A video run: its start and the seconds typed. `referenceCount` is the pictures chosen.
  video?: { start: VideoStartKind; seconds: number }
  onConfirm: (provider: string, count: number | null, video?: VideoSent) => Promise<Result<unknown>>
  onCancel: () => void
}

const NONE: never[] = []

function countIn(text: string, count: RunCount): number | null {
  const n = Number(text)
  return text !== '' && Number.isInteger(n) && n >= count.min && n <= count.max ? n : null
}

// What a video sends with the chosen provider.
function videoSent(
  video: RunDialogProps['video'],
  info: ComfyInfo | null,
  providerId: string | null,
  chosen: number,
): VideoSent | undefined {
  if (!video || providerId === null) return undefined
  return {
    seconds: videoSeconds(info, providerId, video.start, video.seconds),
    pictures: videoPictures(providerId, video.start, chosen),
  }
}

function RunBody(props: RunDialogProps & { busy: boolean; setBusy: (busy: boolean) => void }) {
  const { job, count, retry, busy } = props
  const app = useApp((s) => s.app)
  const { info, loaded } = useComfyInfoState()
  const settled = retry !== undefined || loaded
  const referenceCount = props.referenceCount ?? 0
  const choices = runChoices(job, app?.providers ?? NONE, info, referenceCount, props.video?.start)
  const preferred = job === 'cutout' ? undefined : app?.settings.defaultProviders[job]
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState(String(count?.value ?? ''))
  const [refusal, setRefusal] = useState<string | null>(null)

  const chosenId = retry?.provider ?? picked ?? startChoice(choices, preferred)
  const chosen = choices.find((c) => c.provider.id === chosenId)
  // A retried run whose provider is not known is treated as paid (spec/screens.md).
  const provider = chosen?.provider ?? { id: chosenId ?? '', label: chosenId ?? '', local: false }
  const n = count === undefined ? null : retry ? count.value : countIn(typed, count)
  const ready = chosenId !== null && (retry !== undefined || chosen?.enabled === true)
  const locked = busy || !settled
  const workflow = chosen?.workflow
  const comfy = workflow && { address: info?.address ?? null, label: workflow.label }
  const video = videoSent(props.video, info, chosenId, referenceCount)
  const changed = props.video && video && video.seconds !== props.video.seconds

  async function send() {
    if (chosenId === null) return
    props.setBusy(true)
    setRefusal(null)
    const reply = await (video ? props.onConfirm(chosenId, n, video) : props.onConfirm(chosenId, n))
    props.setBusy(false)
    // A licence question has its own dialog; cancelling it is not a failure to show here.
    const asked = !reply.ok && reply.error.details?.reason === 'licence_not_confirmed'
    if (!reply.ok && !asked) setRefusal(reply.error.message)
  }

  return (
    <div className={styles.body}>
      {retry ? (
        <p>Provider: {provider.label}</p>
      ) : (
        <ProviderChoice
          choices={choices}
          value={settled ? chosenId : null}
          onChange={setPicked}
          disabled={locked}
        />
      )}
      {count && retry && <p>{`${count.label}: ${count.value}`}</p>}
      {count && !retry && (
        <label className={styles.count}>
          {count.label}
          <input
            type="number"
            min={count.min}
            max={count.max}
            step={1}
            value={typed}
            disabled={busy}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
      )}
      {settled && ready && (
        <p className={provider.id === 'comfyui' ? styles.comfy : styles.summary}>
          {runSummary({
            job,
            provider,
            count: n ?? count?.value,
            referenceCount,
            comfy,
            requests: props.requests,
            video,
          })}
        </p>
      )}
      {settled && ready && changed && props.video && (
        <p className={styles.summary}>
          {lengthLine(
            provider.label,
            clipBounds(info, provider.id, props.video.start),
            video.seconds,
          )}
        </p>
      )}
      {settled && !ready && <p>No provider can do this yet.</p>}
      {props.campaignId !== undefined && (
        <PaidCount projectId={props.projectId} campaignId={props.campaignId} />
      )}
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          <Icon name="alert" size="small" />
          {refusal}
        </p>
      )}
      <DialogFoot className={styles.foot}>
        <button type="button" disabled={busy} onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={layout.primary}
          disabled={locked || !ready || (count !== undefined && n === null)}
          onClick={() => void send()}
        >
          {props.confirmLabel}
        </button>
      </DialogFoot>
    </div>
  )
}

export function RunDialog(props: RunDialogProps) {
  const [busy, setBusy] = useState(false)
  return (
    <DialogFrame open={props.open} onClose={props.onCancel} title={props.title} closable={!busy}>
      <RunBody {...props} busy={busy} setBusy={setBusy} />
    </DialogFrame>
  )
}
