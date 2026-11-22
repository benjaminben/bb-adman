// Translation in the sync review (spec/data-rules.md, "Sync"; P6-16): under a translated copy
// change, the proposed text when it has arrived, "Translating…" while the job runs, or the
// failure with "Retry" and a field to type the text by hand. Typing sends translation.set
// (status `proposed`, source `user`, never `approved`), so the text is no longer out of date.
// With no job started (a paid text provider) the Phase 5 line stays. Text is drawn as text.
// P6-18: with a paid provider "Retry" opens the paid confirm in its place (`ask`).
import { useId, useState } from 'react'
import { PaidConfirm } from '@/renderer/ui/paid-confirm'
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { SyncChange } from '@/shared/schemas/queries/sync'
import { type PaidAsk, SYNC_REQUESTS } from './translate-ask'
import type { LanguageRun } from './use-sync-translations'
import styles from './sync-review.module.css'

export const NO_TRANSLATION =
  'No translation yet. The text stays as it is and is marked as missing a translation.'

export type TranslationLineProps = {
  proposed: NonNullable<SyncChange['proposedTranslation']>
  run: LanguageRun | undefined
  disabled: boolean
  ask: PaidAsk | null // the language's open paid confirm, or null
  onRetry: () => void
  onType: (text: string) => Promise<string | null> // a refusal's message, or null
}

function ByHand(props: TranslationLineProps) {
  const id = useId()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  async function save() {
    setBusy(true)
    setRefusal(await props.onType(text))
    setBusy(false)
  }
  return (
    <div className={styles.byHand}>
      <label htmlFor={id}>Or type the translation</label>
      <div className={layout.row}>
        <input
          id={id}
          type="text"
          value={text}
          disabled={props.disabled || busy}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="button"
          disabled={props.disabled || busy || text.trim() === ''}
          onClick={() => void save()}
        >
          Use this text
        </button>
      </div>
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.warn}`}>
          {refusal}
        </p>
      )}
    </div>
  )
}

export function TranslationLine(props: TranslationLineProps) {
  const { proposed, run } = props
  if (proposed.status === 'proposed') {
    return <p className={styles.detail}>Proposed translation: {proposed.text}</p>
  }
  if (!run) return <p className={styles.detail}>{NO_TRANSLATION}</p>
  if (run.kind === 'running') {
    return (
      <p role="status" className={`${styles.detail} ${styles.reading}`}>
        <BusySpinner />
        Translating…
      </p>
    )
  }
  const sentence = run.kind === 'failed' && run.sentence !== null ? `: ${run.sentence}` : '.'
  return (
    <div className={styles.detail}>
      <div className={styles.failure}>
        <p role="alert">{`The translation did not finish${sentence}`}</p>
        {!props.ask && (
          <button
            type="button"
            className={layout.small}
            disabled={props.disabled}
            onClick={props.onRetry}
          >
            Retry
          </button>
        )}
      </div>
      {props.ask && (
        <PaidConfirm
          count={SYNC_REQUESTS}
          providerLabel={props.ask.label}
          onConfirm={props.ask.onConfirm}
          onCancel={props.ask.onCancel}
        />
      )}
      <ByHand {...props} />
    </div>
  )
}
