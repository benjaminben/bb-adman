// One language of the translation panel (spec/phases/phase-06.md, design addition 8): heading
// "{language} · {a} of {n} approved", "Approve all {language}" and the rows. Edits send
// translation.set; "Approve" and "Approve all" send translation.approve with each row's copy
// counter as read (P6-4b). After every reply the rows are read again, so a refusal such as
// "A text changed after you read it." is followed by the newest text. A refusal's own message
// shows on its row, or under the heading for "Approve all". Beside it "Translate {language}
// again…" with the group's posts, and under the heading the language's newest jobs (P6-13).
// Each row is told the primary language's name, the language of its source text (R2C-4).
import { useId, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import type {
  TranslationJobState,
  TranslationRow as Row,
} from '@/shared/schemas/queries/translation'
import type { Result } from '@/shared/schemas/result'
import layout from '@/renderer/ui/layout.module.css'
import { JobLine } from './job-line'
import { TranslateAgain } from './translate-again'
import { TranslationRow } from './translation-row'
import {
  type ApproveLayer,
  approvalOf,
  groupHeading,
  languageName,
  requestCount,
} from './translation-words'
import styles from './translation-panel.module.css'

export type LanguageGroupProps = {
  projectId: string
  campaignId: string
  language: string
  primaryLanguage: string // the source texts' language code
  rows: Row[]
  jobs: TranslationJobState[]
  reload: () => void
}

type Messages = { group: string | null; rows: Record<string, string> }

export function LanguageGroup(props: LanguageGroupProps) {
  const api = useApi()
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Messages>({ group: null, rows: {} })
  const name = languageName(props.language)
  const sourceName = languageName(props.primaryLanguage)
  const proposed = approvalOf(props.rows)
  const variantIds = [...new Set(props.rows.map((row) => row.variantId))]

  // `layerId` names the row a refusal belongs on; null puts it under the heading.
  const send = async (layerId: string | null, call: () => Promise<Result<unknown>>) => {
    setBusy(true)
    setMessages({ group: null, rows: {} })
    const reply = await call()
    setBusy(false)
    if (!reply.ok) {
      const message = reply.error.message
      setMessages(
        layerId === null
          ? { group: message, rows: {} }
          : { group: null, rows: { [layerId]: message } },
      )
    }
    props.reload()
  }
  const approve = (layerId: string | null, layers: ApproveLayer[]) =>
    void send(layerId, () =>
      api.command('translation.approve', { projectId: props.projectId, layers }),
    )
  const save = (layerId: string, text: string, applyToSameLanguage: boolean) =>
    void send(layerId, () =>
      api.command('translation.set', {
        projectId: props.projectId,
        layerId,
        text,
        applyToSameLanguage,
      }),
    )

  return (
    <section className={styles.group} aria-labelledby={`${id}-heading`}>
      <div className={layout.row}>
        <h3 id={`${id}-heading`} className={styles.heading}>
          {groupHeading(props.language, props.rows)}
        </h3>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small}`}
          disabled={busy || proposed.length === 0}
          onClick={() => approve(null, proposed)}
        >
          {`Approve all ${name}`}
        </button>
        <TranslateAgain
          projectId={props.projectId}
          campaignId={props.campaignId}
          language={props.language}
          variantIds={variantIds}
          requests={requestCount(props.rows)}
        />
      </div>
      {props.jobs.map((job) => (
        <JobLine
          key={job.jobId}
          projectId={props.projectId}
          campaignId={props.campaignId}
          job={job}
        />
      ))}
      {messages.group !== null && (
        <p role="alert" className={`${layout.notice} ${layout.warn}`}>
          {messages.group}
        </p>
      )}
      <ul className={layout.list} aria-label={`${name} translations`}>
        {props.rows.map((row) => (
          <TranslationRow
            key={`${row.layerId}:${row.copyRev}`}
            row={row}
            language={name}
            sourceLanguage={sourceName}
            message={messages.rows[row.layerId] ?? null}
            busy={busy}
            onSave={(text, apply) => save(row.layerId, text, apply)}
            onApprove={() => approve(row.layerId, [{ layerId: row.layerId, copyRev: row.copyRev }])}
          />
        ))}
      </ul>
    </section>
  )
}
