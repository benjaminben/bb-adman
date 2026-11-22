// The run confirmation dialog (spec/screens-ai.md, "The run confirmation dialog"; FR-064,
// FR-067, FR-230, FR-256): every AI run the user starts goes through it. It chooses the
// provider and the count; the caller sends the command from `onConfirm` and returns the reply.
// DLG-4a (choice C-15): the action button is the one click that pays. The cost line is the
// body's last thing, directly above the foot, and in the dialog's accessible description;
// nothing is sent before the click. From the click until the reply both buttons are disabled
// and the dialog cannot close; a refusal shows inside it (A-50). The starting choice depends
// on comfy.getInfo, so until it answers nothing can be chosen or sent. R2E-8: a video names
// the length and pictures the chosen provider will be sent and hands those numbers on.
import { useId, useLayoutEffect, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import {
  clipBounds,
  videoPictures,
  videoSeconds,
} from '@/renderer/editor/generate-panel/video-lengths'
import { useComfyInfoState } from '@/renderer/screens/campaign/use-comfy-info'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { PaidCount } from '@/renderer/ui/paid-count'
import type { VideoStartKind } from '@/shared/config/video-offers'
import { providerModelWords } from '@/shared/providers/model-words'
import type { ComfyInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import { CostLines, describedIds } from './cost-lines'
import { ProviderChoice, runChoices, startChoice } from './provider-choice'
import { lengthLine, runCost, type RunJob, type VideoSent } from './run-summary'
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

// DLG-4b: the run setup alone (provider, count, cost line and the foot with the action), for a
// dialog that draws it inside its own body (copy options) instead of opening a dialog in a
// dialog. Its holder keeps `busy` (no close while waiting) and lists `setDescribed`'s ids in its
// own `describedBy`. `cancelLabel` names the quiet button ("Close" where it closes the holder).
export type RunSetupProps = Omit<RunDialogProps, 'open' | 'title'> & {
  cancelLabel?: string
  busy: boolean
  setBusy: (busy: boolean) => void
  setDescribed: (ids: string | undefined) => void
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

export function RunSetup(props: RunSetupProps) {
  const { job, count, retry, busy, setDescribed } = props
  const app = useApp((s) => s.app)
  const show = useApp((s) => s.show)
  const { info, loaded } = useComfyInfoState()
  const settled = retry !== undefined || loaded
  const referenceCount = props.referenceCount ?? 0
  const choices = runChoices(job, app?.providers ?? NONE, info, referenceCount, props.video?.start)
  const preferred = job === 'cutout' ? undefined : app?.settings.defaultProviders[job]
  const [picked, setPicked] = useState<string | null>(null)
  const [typed, setTyped] = useState(String(count?.value ?? ''))
  const [refusal, setRefusal] = useState<string | null>(null)
  const lengthId = useId()
  const costId = useId()

  const chosenId = retry?.provider ?? picked ?? startChoice(choices, preferred)
  const chosen = choices.find((c) => c.provider.id === chosenId)
  // A retried run whose provider is not known is treated as paid (spec/screens.md).
  const provider = chosen?.provider ?? {
    id: chosenId ?? '',
    label: chosenId || 'an unknown provider',
    local: false,
  }
  const n = count === undefined ? null : retry ? count.value : countIn(typed, count)
  const ready = chosenId !== null && (retry !== undefined || chosen?.enabled === true)
  const locked = busy || !settled
  const workflow = chosen?.workflow
  const comfy = workflow && { address: info?.address ?? null, label: workflow.label }
  const video = videoSent(props.video, info, chosenId, referenceCount)
  const shown = settled && ready
  const { requests } = props
  const model = chosen?.model ?? null
  const name = providerModelWords(provider.label, model)
  const sent = { job, provider, count: n ?? count?.value, referenceCount, comfy, requests, video }
  const cost = shown ? runCost({ ...sent, model }) : null
  const changed = shown && props.video && video && video.seconds !== props.video.seconds
  const bounds = props.video && clipBounds(info, provider.id, props.video.start)
  const length = changed && bounds ? lengthLine(name, bounds, video.seconds) : null
  const described = describedIds([
    [lengthId, length !== null],
    [costId, cost !== null],
  ])
  useLayoutEffect(() => setDescribed(described), [described, setDescribed])

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

  function openSettings() {
    props.onCancel()
    show({ kind: 'settings' })
  }

  return (
    <div className={styles.body}>
      {refusal !== null && <DialogAlert tone="danger">{refusal}</DialogAlert>}
      {settled && !ready && !busy && (
        <DialogAlert tone="warn" action={{ label: 'Settings', onClick: openSettings }}>
          No provider can do this yet.
        </DialogAlert>
      )}
      {retry ? (
        <p>Provider: {name}</p>
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
        <label className={`${layout.field} ${layout.inline} ${styles.count}`}>
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
      {props.campaignId !== undefined && (
        <PaidCount projectId={props.projectId} campaignId={props.campaignId} />
      )}
      <CostLines
        length={length}
        lengthId={lengthId}
        cost={cost}
        costId={costId}
        comfy={provider.id === 'comfyui'}
      />
      <DialogFoot className={styles.foot}>
        <button type="button" className={layout.quiet} disabled={busy} onClick={props.onCancel}>
          {props.cancelLabel ?? 'Cancel'}
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
  const [described, setDescribed] = useState<string | undefined>(undefined)
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onCancel}
      title={props.title}
      kind="run"
      describedBy={described}
      closable={!busy}
    >
      <RunSetup {...props} busy={busy} setBusy={setBusy} setDescribed={setDescribed} />
    </DialogFrame>
  )
}
