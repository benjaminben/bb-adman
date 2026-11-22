// The import dialog (spec/screens-campaign.md, "The import dialog"; FR-050, FR-052 to FR-054,
// FR-246). It shows the files' base names and the choices; "Import" sends asset.import with
// the paths it was given, and nothing is sent before it. Opened by the import buttons and by a
// drop, each with its own instance. Every close resets it for the next open. R2C-7
// (spec/phases/round-2-campaign.md, design addition 5): "New subject…" makes the subject first
// (send-import.ts), and inside the project's Assets scope, with the panel closed, the result
// offers "Show in assets". DLG-3b: the `form` kind; the names are a strip of icon tiles
// (file-strip.tsx); the result lines are a status; a refusal is a DialogAlert.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { useAssetsPanel } from '@/renderer/screens/assets/assets-scope'
import { DialogAlert } from '@/renderer/ui/dialog-alert'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { ImportChoices, START_CHOICES, type Choices } from './import-choices'
import { FileStrip } from './file-strip'
import { importTitle } from './import-text'
import { importProblem, sendImport } from './send-import'
import styles from './import-dialog.module.css'

export type ImportDialogProps = {
  projectId: string
  open: boolean
  paths: string[]
  folder: boolean
  subjects: SubjectRow[]
  onClose: () => void
}

export function ImportDialog(props: ImportDialogProps) {
  const command = useApp((s) => s.command)
  const api = useApi()
  const [choices, setChoices] = useState<Choices>(START_CHOICES)
  const [importing, setImporting] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [result, setResult] = useState<string[] | null>(null)
  const panel = useAssetsPanel()
  const offerPanel = panel !== null && panel.projectId === props.projectId && !panel.open

  function close() {
    setChoices(START_CHOICES)
    setRefusal(null)
    setProblem(null)
    setResult(null)
    props.onClose()
  }

  // The dialog gives the focus back to its opener once it has closed, on a later turn; the
  // panel opens after that, so it keeps the focus and later hands it back to that opener.
  function showInAssets() {
    close()
    setTimeout(() => {
      setTimeout(() => {
        const active = document.activeElement
        panel?.show(active instanceof HTMLElement && active !== document.body ? active : null)
      }, 0)
    }, 0)
  }

  async function send() {
    const found = importProblem(choices)
    setProblem(found)
    setRefusal(null)
    if (found !== null) return
    setImporting(true)
    const to = { projectId: props.projectId, paths: props.paths, choices, subjects: props.subjects }
    const outcome = await sendImport(api, command, to)
    setImporting(false)
    if (outcome.kind === 'refused') setRefusal(outcome.message)
    else setResult(outcome.lines)
  }

  // The key keeps React from reusing Cancel as Done, so Done is new and takes focus.
  const footer =
    result !== null ? (
      <>
        {offerPanel && (
          <button key="assets" type="button" onClick={showInAssets}>
            Show in assets
          </button>
        )}
        <button key="done" type="button" className={layout.primary} autoFocus onClick={close}>
          Done
        </button>
      </>
    ) : (
      <>
        <button type="button" disabled={importing} onClick={close}>
          Cancel
        </button>
        <button
          type="button"
          className={layout.primary}
          disabled={importing}
          onClick={() => void send()}
        >
          Import
        </button>
      </>
    )

  return (
    <DialogFrame
      open={props.open}
      onClose={close}
      title={importTitle(props.paths, props.folder)}
      kind="form"
      closable={!importing}
      footer={footer}
    >
      <FileStrip paths={props.paths} folder={props.folder} />
      {result !== null ? (
        <div role="status">
          <ul className={styles.result} aria-label="Import result">
            {result.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          <ImportChoices
            choices={choices}
            subjects={props.subjects}
            disabled={importing}
            problem={problem !== null}
            onChange={(next) => {
              setChoices(next)
              setProblem(null)
            }}
          />
          {(problem ?? refusal) !== null && (
            <DialogAlert tone="danger">{problem ?? refusal}</DialogAlert>
          )}
          {importing && (
            <p role="status" className={styles.busy}>
              <BusySpinner />
              Importing…
            </p>
          )}
        </>
      )}
    </DialogFrame>
  )
}
