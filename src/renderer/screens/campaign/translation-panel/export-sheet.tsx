// "Export translation sheet…" (spec/phases/phase-06.md, design additions 4 and 8; CAMP-5): an
// export icon button. The main process's save dialog (dialog.pickSaveFile, purpose
// translation-sheet), then translation.exportSheet, then a green "Saved" mark for a few seconds
// with the file's base name in its title. The command writes only the path that dialog last
// returned (P6-7b), so the path goes from the dialog's reply straight into the command: it is
// never kept, built or drawn here. Only the reply's file name is shown, cut to its base name.
import { useEffect, useState } from 'react'
import { pickPath, useApi } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { TranslationExportSheetReply } from '@/shared/schemas/commands/translation'
import styles from './translation-panel.module.css'

type Outcome = { kind: 'saved'; fileName: string } | { kind: 'refused'; message: string }

const NAME = 'Export translation sheet…'
const SAVED_FOR = 4000

const baseName = (fileName: string) => fileName.split(/[\\/]/).pop() ?? ''

export function ExportSheet(props: { projectId: string; campaignId: string }) {
  const api = useApi()
  const [busy, setBusy] = useState(false)
  const [outcome, setOutcome] = useState<Outcome | null>(null)

  useEffect(() => {
    if (outcome?.kind !== 'saved') return
    const timer = setTimeout(() => setOutcome(null), SAVED_FOR)
    return () => clearTimeout(timer)
  }, [outcome])

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
    setOutcome({ kind: 'saved', fileName: baseName(fileName) })
  }

  return (
    <>
      <span role="status">
        {outcome?.kind === 'saved' && (
          <StatusMark tone="ok" icon="check" label="Saved" tip={outcome.fileName} />
        )}
      </span>
      <button
        type="button"
        className={layout.iconButton}
        aria-label={NAME}
        title={NAME}
        disabled={busy}
        onClick={() => void exportSheet()}
      >
        <Icon name="export" />
      </button>
      {outcome?.kind === 'refused' && (
        <p role="alert" className={`${layout.notice} ${layout.warn} ${styles.wide}`}>
          {outcome.message}
        </p>
      )}
    </>
  )
}
