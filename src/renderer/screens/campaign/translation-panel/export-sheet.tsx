// "Export translation sheet…" (spec/phases/phase-06.md, design additions 4 and 8): the main
// process's save dialog (dialog.pickSaveFile, purpose translation-sheet), then
// translation.exportSheet, then "Saved {file name}." The command writes only the path that
// dialog last returned (P6-7b), so the path goes from the dialog's reply straight into the
// command: it is never kept, built or drawn here. Only the reply's file name is shown.
import { useState } from 'react'
import { pickPath, useApi } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import type { TranslationExportSheetReply } from '@/shared/schemas/commands/translation'

type Outcome = { kind: 'saved'; fileName: string } | { kind: 'refused'; message: string }

export function ExportSheet(props: { projectId: string; campaignId: string }) {
  const api = useApi()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  async function exportSheet() {
    setBusy(true)
    setOutcome(null)
    const filePath = await pickPath(api, 'dialog.pickSaveFile')
    if (filePath === null) return setBusy(false)
    const { projectId, campaignId } = props
    const reply = await api.command('translation.exportSheet', { projectId, campaignId, filePath })
    setBusy(false)
    if (!reply.ok) return setOutcome({ kind: 'refused', message: reply.error.message })
    const { fileName } = reply.data as TranslationExportSheetReply
    setOutcome({ kind: 'saved', fileName })
  }

  return (
    <div className={layout.row}>
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        disabled={busy}
        onClick={() => void exportSheet()}
      >
        Export translation sheet…
      </button>
      {outcome?.kind === 'saved' && (
        <span role="status" className={layout.muted}>{`Saved ${outcome.fileName}.`}</span>
      )}
      {outcome?.kind === 'refused' && (
        <span role="alert" className={`${layout.notice} ${layout.warn}`}>
          {outcome.message}
        </span>
      )}
    </div>
  )
}
