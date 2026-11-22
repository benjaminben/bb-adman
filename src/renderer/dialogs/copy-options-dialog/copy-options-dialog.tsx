// The copy options dialog (spec/screens-ai.md, "Copy options") [REQ: FR-045]: the layer's
// newest succeeded options as tiles, "Use" for the chosen one, and "New options" (named "Make
// new options…"). DLG-4b (choice C-15): the run setup (provider, count, cost line) is drawn in
// this dialog's own body, never in a dialog inside it: at once when there are no options yet,
// and after "New options" or a failed run's "Retry". Its action ("Generate", "Retry") is the one
// click that sends generation.copyOptions or job.retry; the cost line is last above the foot and
// in this dialog's description. Opening, "New options" and choosing an option send nothing. The
// job is attached to this dialog, so closing it while the job runs shows the close warning.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { useRunName } from '@/renderer/ui/run-name'
import { attachedStoreFor, dialogJobs } from '@/renderer/stores/attached-store'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { RunFailure } from '@/renderer/ui/run-failure'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Result } from '@/shared/schemas/result'
import { CopySetup, type SetupKind } from './copy-setup'
import { OptionTiles, optionsOf, useApplyCopy } from './option-list'
import { useCopyRun } from './use-copy-run'
import styles from './copy-options-dialog.module.css'

export type CopyOptionsDialogProps = {
  open: boolean
  projectId: string
  layer: LayerRow
  onClose: () => void
}

export function CopyOptionsDialog(props: CopyOptionsDialogProps) {
  const { projectId, layer } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const { current, follow, loaded } = useCopyRun(projectId, layer.id)
  const [asked, setAsked] = useState<SetupKind | null>(null)
  const [busy, setBusy] = useState(false)
  const [described, setDescribed] = useState<string | undefined>(undefined)
  const [chosen, setChosen] = useState<{ row: string; index: number } | null>(null)
  const { ask, warning } = useCloseWarning('dialog')
  const applied = useApplyCopy(projectId, layer.id, props.onClose)
  const dialog = `copy-options:${layer.id}`
  const failed = current.state === 'failed' ? current.row : null
  const shown = current.state === 'options' ? current.row : null
  const options = shown ? optionsOf(shown) : []
  const index = shown && chosen?.row === shown.id ? chosen.index : null
  const first = loaded && current.state === 'none' ? 'new' : null
  const setup =
    current.state === 'running' ? null : ((asked === 'retry' && !failed ? null : asked) ?? first)

  async function send(name: string, input: unknown): Promise<Result<unknown>> {
    const reply = await command(name, input)
    const jobId = follow(reply)
    if (jobId !== null) {
      attachedStoreFor(api).getState().register(jobId, { projectId, dialog })
      setAsked(null)
    }
    return reply
  }

  const close = () => ask((s) => dialogJobs(s, dialog), props.onClose)
  const { provider, words: failedName } = useRunName(failed ?? null, '')

  const foot = (
    <>
      <button
        type="button"
        className={`${layout.secondary} ${styles.newOptions}`}
        aria-label="Make new options…"
        disabled={current.state === 'running'}
        onClick={() => setAsked('new')}
      >
        New options
      </button>
      <button type="button" className={layout.quiet} onClick={close}>
        Close
      </button>
      {shown && (
        <button
          type="button"
          className={layout.primary}
          disabled={index === null || applied.busy}
          title={index === null ? 'Choose an option first' : undefined}
          onClick={() => index !== null && void applied.apply(options[index] ?? '')}
        >
          Use
        </button>
      )}
    </>
  )

  return (
    <DialogFrame
      open={props.open}
      onClose={close}
      title={`Copy options for ${layer.name}`}
      kind="run"
      describedBy={setup ? described : undefined}
      closable={!busy}
      footer={setup ? undefined : foot}
    >
      <div className={styles.body}>
        {applied.refusal !== null && <DialogAlert tone="danger">{applied.refusal}</DialogAlert>}
        {current.state === 'running' && (
          <div className={styles.running}>
            <BusySpinner />
            <p role="status">Writing options…</p>
            <button
              type="button"
              onClick={() => void api.command('job.cancel', { projectId, jobId: current.jobId })}
            >
              Stop
            </button>
          </div>
        )}
        {failed && (
          <div className={styles.failed}>
            <RunFailure
              row={failed}
              projectId={projectId}
              provider={provider}
              providerLabel={failedName}
            />
            {setup !== 'retry' && (
              <button type="button" onClick={() => setAsked('retry')}>
                Retry
              </button>
            )}
          </div>
        )}
        {shown && setup === null && (
          <OptionTiles
            options={options}
            chosen={index}
            disabled={applied.busy}
            onChoose={(i) => setChosen({ row: shown.id, index: i })}
          />
        )}
        {setup !== null && (
          <CopySetup
            key={setup}
            kind={setup}
            projectId={projectId}
            layer={layer}
            failed={failed}
            busy={busy}
            setBusy={setBusy}
            setDescribed={setDescribed}
            send={send}
            closes={current.state === 'none'}
            onCancel={() => (current.state === 'none' ? close() : setAsked(null))}
          />
        )}
      </div>
      {warning}
    </DialogFrame>
  )
}
