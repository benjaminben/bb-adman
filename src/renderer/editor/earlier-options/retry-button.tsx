// "Retry" on a failed earlier run (spec/screens-ai.md, "Earlier options"; FR-069): a paid
// provider goes through the run dialog with `retry` and the count job.retry will ask for; a
// local one sends job.retry at once. An unknown provider is treated as paid. ED-4b: drawn as an
// icon button named "Retry".
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { referenceCount, retryCount } from './run-words'

export type RetryButtonProps = {
  projectId: string
  row: JobRow
  provider: ProviderInfo | undefined
  disabled: boolean
}

export function RetryButton(props: RetryButtonProps) {
  const { projectId, row } = props
  const command = useApp((s) => s.command)
  const [asking, setAsking] = useState(false)
  const [sending, setSending] = useState(false)
  const count = retryCount(row)

  function send() {
    return command('job.retry', { projectId, jobId: row.id })
  }

  async function now() {
    setSending(true)
    try {
      await send()
    } finally {
      setSending(false)
    }
  }

  async function confirm() {
    const reply = await send()
    if (reply.ok) setAsking(false)
    return reply
  }

  return (
    <>
      <button
        type="button"
        className={layout.iconButton}
        aria-label="Retry"
        title="Retry"
        disabled={props.disabled || sending}
        onClick={() => (props.provider?.local === true ? void now() : setAsking(true))}
      >
        <Icon name="sync" />
      </button>
      <RunDialog
        open={asking}
        projectId={projectId}
        job={row.kind === 'cutout' ? 'cutout' : 'image'}
        title="Retry the run"
        confirmLabel="Retry"
        retry={{ provider: row.provider ?? '' }}
        referenceCount={referenceCount(row)}
        {...(count === null
          ? {}
          : { count: { label: 'Pictures', value: count, min: 1, max: MAX_IMAGES_PER_RUN } })}
        {...(row.campaignId === null ? {} : { campaignId: row.campaignId })}
        onConfirm={confirm}
        onCancel={() => setAsking(false)}
      />
    </>
  )
}
