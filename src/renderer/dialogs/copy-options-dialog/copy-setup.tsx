// DLG-4b: the copy options dialog's run setup, drawn in its body with the run dialog's own
// parts (provider, count, cost line and the foot with Cancel and the action). "new" sends
// generation.copyOptions with the provider and count shown; "retry" shows the failed run's
// provider and count and sends job.retry. Each sends only from its action click.
import { useEffect, useRef } from 'react'
import { RunSetup } from '@/renderer/dialogs/run-dialog'
import { MAX_COPY_OPTIONS } from '@/shared/config/copy-options'
import { copyJobRequest } from '@/shared/schemas/jobs/copy-options'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { Result } from '@/shared/schemas/result'
import styles from './copy-options-dialog.module.css'

export type SetupKind = 'new' | 'retry'

const DEFAULT_COUNT = 4

const requestCount = (row: JobRow) => {
  const parsed = copyJobRequest.safeParse(row.request)
  return parsed.success ? parsed.data.count : DEFAULT_COUNT
}

type Props = {
  kind: SetupKind
  projectId: string
  layer: LayerRow
  failed: JobRow | null
  busy: boolean
  setBusy: (busy: boolean) => void
  setDescribed: (ids: string | undefined) => void
  send: (name: string, input: unknown) => Promise<Result<unknown>>
  // With nothing to go back to, the quiet button closes the dialog and is named "Close".
  closes: boolean
  onCancel: () => void
}

export function CopySetup(props: Props) {
  const { projectId, layer, failed } = props
  const box = useRef<HTMLDivElement>(null)
  // The setup replaces the button that opened it, so focus moves into it, not to the page.
  useEffect(() => {
    if (box.current?.contains(document.activeElement)) return
    if (document.activeElement === document.body) box.current?.focus()
  }, [])
  const shared = {
    projectId,
    job: 'text' as const,
    busy: props.busy,
    setBusy: props.setBusy,
    setDescribed: props.setDescribed,
    cancelLabel: props.closes ? 'Close' : 'Cancel',
    onCancel: props.onCancel,
  }
  return (
    <div ref={box} tabIndex={-1} className={styles.setup}>
      {props.kind === 'retry' && failed ? (
        <RunSetup
          {...shared}
          confirmLabel="Retry"
          retry={{ provider: failed.provider ?? '' }}
          count={{ label: 'Options', value: requestCount(failed), min: 1, max: MAX_COPY_OPTIONS }}
          onConfirm={() => props.send('job.retry', { projectId, jobId: failed.id })}
        />
      ) : (
        <RunSetup
          {...shared}
          confirmLabel="Generate"
          count={{ label: 'Options', value: DEFAULT_COUNT, min: 1, max: MAX_COPY_OPTIONS }}
          onConfirm={(provider, count) =>
            props.send('generation.copyOptions', {
              projectId,
              variantId: layer.variantId,
              layerId: layer.id,
              count,
              provider,
            })
          }
        />
      )}
    </div>
  )
}
