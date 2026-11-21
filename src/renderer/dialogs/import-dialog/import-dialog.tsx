// The import dialog (spec/screens-campaign.md, "The import dialog"; FR-050, FR-052 to FR-054,
// FR-246). It shows the files' base names and the choices; "Import" sends asset.import with
// the paths it was given, and nothing is sent before it. Opened by the import buttons and by a
// drop, each with its own instance. Every close resets it for the next open.
import { useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { BusySpinner, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { ImportChoices, START_CHOICES, type Choices } from './import-choices'
import {
  animationLines,
  importTitle,
  resultLines,
  shownNames,
  type ImportReply,
} from './import-text'
import { animatedNames } from './animated-names'
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
  const [result, setResult] = useState<string[] | null>(null)
  const { names, more } = shownNames(props.paths)

  function close() {
    setChoices(START_CHOICES)
    setRefusal(null)
    setResult(null)
    props.onClose()
  }

  async function send() {
    const { library, copy, subjectId } = choices
    setImporting(true)
    setRefusal(null)
    const reply = await command('asset.import', {
      projectId: props.projectId,
      paths: props.paths,
      library,
      copy,
      ...(subjectId !== '' && { subjectId }),
    })
    if (!reply.ok) {
      setImporting(false)
      setRefusal(reply.error.message)
      return
    }
    const data = reply.data as ImportReply
    const animated = data.animatedAssetIds ?? []
    const names = await animatedNames(api, props.projectId, animated)
    setImporting(false)
    setResult([...resultLines(data), ...animationLines(animated, names)])
  }

  // The key keeps React from reusing Cancel as Done, so Done is new and takes focus.
  const footer =
    result !== null ? (
      <button key="done" type="button" className={layout.primary} autoFocus onClick={close}>
        Done
      </button>
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
      closable={!importing}
      footer={footer}
    >
      <ul className={styles.names} aria-label="Files to import">
        {names.map((name, i) => (
          <li key={i}>{name}</li>
        ))}
      </ul>
      {more > 0 && <p className={styles.hint}>and {more} more</p>}
      {result !== null ? (
        <ul className={styles.result} aria-label="Import result">
          {result.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : (
        <>
          <ImportChoices
            choices={choices}
            subjects={props.subjects}
            disabled={importing}
            onChange={setChoices}
          />
          {refusal !== null && (
            <p role="alert" className={`${layout.notice} ${layout.danger}`}>
              {refusal}
            </p>
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
