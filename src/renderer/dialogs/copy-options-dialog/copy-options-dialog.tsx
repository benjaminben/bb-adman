// The copy options dialog (spec/screens-ai.md, "Copy options") [REQ: FR-045]: the layer's
// newest succeeded options and "Make new options…", which goes through the run dialog to
// generation.copyOptions. The job is attached to this dialog, so closing it while the job
// runs (its Close button, Escape or the frame's close) shows the close warning.
import { useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import { attachedStoreFor, dialogJobs } from '@/renderer/stores/attached-store'
import { useCloseWarning } from '@/renderer/ui/close-warning'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { RunFailure } from '@/renderer/ui/run-failure'
import { MAX_COPY_OPTIONS } from '@/shared/config/copy-options'
import { copyJobRequest } from '@/shared/schemas/jobs/copy-options'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { Result } from '@/shared/schemas/result'
import { OptionList } from './option-list'
import { useCopyRun } from './use-copy-run'
import styles from './copy-options-dialog.module.css'

export type CopyOptionsDialogProps = {
  open: boolean
  projectId: string
  layer: LayerRow
  onClose: () => void
}

const DEFAULT_COUNT = 4

const requestCount = (row: JobRow) => {
  const parsed = copyJobRequest.safeParse(row.request)
  return parsed.success ? parsed.data.count : DEFAULT_COUNT
}

export function CopyOptionsDialog(props: CopyOptionsDialogProps) {
  const { projectId, layer } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const { current, follow } = useCopyRun(projectId, layer.id)
  const [asking, setAsking] = useState<'new' | 'retry' | null>(null)
  const { ask, warning } = useCloseWarning('dialog')
  const dialog = `copy-options:${layer.id}`
  const failed = current.state === 'failed' ? current.row : null

  async function send(name: string, input: unknown): Promise<Result<unknown>> {
    const reply = await command(name, input)
    const jobId = follow(reply)
    if (jobId !== null) {
      attachedStoreFor(api).getState().register(jobId, { projectId, dialog })
      setAsking(null)
    }
    return reply
  }

  const close = () => ask((s) => dialogJobs(s, dialog), props.onClose)
  const provider = failed && providers.find((p) => p.id === failed.provider)

  return (
    <DialogFrame open={props.open} onClose={close} title={`Copy options for ${layer.name}`}>
      <div className={styles.body}>
        {current.state === 'running' && (
          <div className={styles.running}>
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
              provider={provider ?? undefined}
              providerLabel={provider?.label ?? failed.provider ?? ''}
            />
            <button type="button" onClick={() => setAsking('retry')}>
              Try again
            </button>
          </div>
        )}
        {current.state === 'options' && (
          <OptionList
            projectId={projectId}
            layerId={layer.id}
            row={current.row}
            onUsed={props.onClose}
          />
        )}
        {current.state === 'none' && <p className={styles.muted}>No options yet.</p>}
        <div className={styles.actions}>
          <button type="button" onClick={close}>
            Close
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={current.state === 'running'}
            onClick={() => setAsking('new')}
          >
            Make new options…
          </button>
        </div>
      </div>
      <RunDialog
        open={asking === 'new'}
        projectId={projectId}
        job="text"
        title="Suggest copy"
        confirmLabel="Suggest copy"
        count={{ label: 'Options', value: DEFAULT_COUNT, min: 1, max: MAX_COPY_OPTIONS }}
        onConfirm={(provider, count) =>
          send('generation.copyOptions', {
            projectId,
            variantId: layer.variantId,
            layerId: layer.id,
            count,
            provider,
          })
        }
        onCancel={() => setAsking(null)}
      />
      {failed && (
        <RunDialog
          open={asking === 'retry'}
          projectId={projectId}
          job="text"
          title="Try again"
          confirmLabel="Try again"
          retry={{ provider: failed.provider ?? '' }}
          count={{ label: 'Options', value: requestCount(failed), min: 1, max: MAX_COPY_OPTIONS }}
          onConfirm={() => send('job.retry', { projectId, jobId: failed.id })}
          onCancel={() => setAsking(null)}
        />
      )}
      {warning}
    </DialogFrame>
  )
}
