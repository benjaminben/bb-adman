// "Translate {language} again…" (spec/phases/phase-06.md, design addition 8; A-156, A-157):
// the run dialog (job text, title and confirm "Translate"). translation.propose is sent only from
// the dialog's confirm, with the provider chosen there; nothing is sent before. It goes through
// the app store's command, so NEEDS_KEY opens the key dialog and sends again once a key is
// saved. The started jobs are registered under the campaign for the tab's close warning.
// A failed job's "Retry" opens the same dialog with that job's direction and language.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { RunDialog } from '@/renderer/dialogs/run-dialog'
import { attachedStoreFor } from '@/renderer/stores/attached-store'
import layout from '@/renderer/ui/layout.module.css'
import type { TranslationProposeReply } from '@/shared/schemas/commands/translation'
import { languageName } from './translation-words'

// What to translate: the group's posts, or one direction in one language.
export type ProposeTarget = { variantIds: string[] } | { directionId: string; language: string }

export type ProposeDialogProps = {
  projectId: string
  campaignId: string
  target: ProposeTarget
  onClose: () => void
}

export function ProposeDialog(props: ProposeDialogProps) {
  const api = useApi()
  const command = useApp((s) => s.command)
  const { projectId, campaignId } = props

  async function confirm(provider: string) {
    const reply = await command('translation.propose', { projectId, provider, ...props.target })
    if (reply.ok) {
      const store = attachedStoreFor(api).getState()
      for (const jobId of (reply.data as TranslationProposeReply).jobIds)
        store.register(jobId, { projectId, campaignId })
      props.onClose()
    } else if (reply.error.code === 'NEEDS_KEY') props.onClose()
    return reply
  }

  return (
    <RunDialog
      open
      projectId={projectId}
      campaignId={campaignId}
      job="text"
      title="Translate"
      confirmLabel="Translate"
      onConfirm={(provider) => confirm(provider)}
      onCancel={props.onClose}
    />
  )
}

export function TranslateAgain(props: {
  projectId: string
  campaignId: string
  language: string
  variantIds: string[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        disabled={props.variantIds.length === 0}
        onClick={() => setOpen(true)}
      >
        {`Translate ${languageName(props.language)} again…`}
      </button>
      {open && (
        <ProposeDialog
          projectId={props.projectId}
          campaignId={props.campaignId}
          target={{ variantIds: props.variantIds }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
