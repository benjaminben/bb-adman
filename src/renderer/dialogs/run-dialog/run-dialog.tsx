// The run confirmation dialog (spec/screens-ai.md, "The run confirmation dialog"; FR-064,
// FR-067, FR-230, FR-256): every AI run the user starts in Phase 4 goes through it. It chooses
// the provider and the count; the caller sends the command from `onConfirm` and returns the
// reply. From the click until that reply, Confirm and Cancel are disabled and the dialog
// cannot close; a refusal shows inside it (A-50). Nothing is sent before the click.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { useComfyInfo } from '@/renderer/screens/campaign/use-comfy-info'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { PaidCount } from '@/renderer/ui/paid-count'
import type { Result } from '@/shared/schemas/result'
import { ProviderChoice, runChoices, startChoice } from './provider-choice'
import { runSummary, type RunJob } from './run-summary'
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
  campaignId?: string
  // A retry: the provider (and the count) are the failed run's, shown, not chosen.
  retry?: { provider: string }
  onConfirm: (provider: string, count: number | null) => Promise<Result<unknown>>
  onCancel: () => void
}

const NONE: never[] = []

function countIn(text: string, count: RunCount): number | null {
  const n = Number(text)
  return text !== '' && Number.isInteger(n) && n >= count.min && n <= count.max ? n : null
}

function RunBody(props: RunDialogProps & { busy: boolean; setBusy: (busy: boolean) => void }) {
  const { job, count, retry, busy } = props
  const app = useApp((s) => s.app)
  const info = useComfyInfo()
  const referenceCount = props.referenceCount ?? 0
  const choices = runChoices(job, app?.providers ?? NONE, info, referenceCount)
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
  const workflow = chosen?.workflow
  const comfy = workflow && { address: info?.address ?? null, label: workflow.label }

  async function send() {
    if (chosenId === null) return
    props.setBusy(true)
    setRefusal(null)
    const reply = await props.onConfirm(chosenId, n)
    props.setBusy(false)
    if (!reply.ok) setRefusal(reply.error.message)
  }

  return (
    <div className={styles.body}>
      {retry ? (
        <p>Provider: {provider.label}</p>
      ) : (
        <ProviderChoice choices={choices} value={chosenId} onChange={setPicked} disabled={busy} />
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
      {ready ? (
        <p>{runSummary({ job, provider, count: n ?? count?.value, referenceCount, comfy })}</p>
      ) : (
        <p>No provider can do this yet.</p>
      )}
      {props.campaignId !== undefined && (
        <PaidCount projectId={props.projectId} campaignId={props.campaignId} />
      )}
      {refusal !== null && <p role="alert">{refusal}</p>}
      <div className={styles.actions}>
        <button type="button" disabled={busy} onClick={props.onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={busy || !ready || (count !== undefined && n === null)}
          onClick={() => void send()}
        >
          {props.confirmLabel}
        </button>
      </div>
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
