// One translation (spec/phases/phase-06.md, design addition 8): "{title} · {size} · {layer}",
// then side by side the source text under "{primary} (source)" and the text field under
// "{language}" (R2C-4), the mark and its source, and "Approve" on a proposed row. The field is
// named "{language} {row line}" and described by the source text.
// Leaving an edited field sends the text, with the tick's choice. The mark is the stored status
// as read, never a local guess. Every text from the row is drawn as React text only.
import { useId, useState } from 'react'
import type { TranslationRow as Row } from '@/shared/schemas/queries/translation'
import layout from '@/renderer/ui/layout.module.css'
import { markWords, rowLine, sourceLabel, sourceLine } from './translation-words'
import styles from './translation-panel.module.css'

export type TranslationRowProps = {
  row: Row
  language: string // the language's name in words
  sourceLanguage: string // the primary language's name in words
  message: string | null
  busy: boolean
  onSave: (text: string, applyToSameLanguage: boolean) => void
  onApprove: () => void
}

const MARK_KIND = { missing: layout.warn, proposed: layout.info, approved: layout.ok }

export function TranslationRow(props: TranslationRowProps) {
  const { row } = props
  const id = useId()
  const [draft, setDraft] = useState(row.text)
  const [apply, setApply] = useState(false)
  const words = markWords(row.status, row.source)
  const kind = MARK_KIND[row.status ?? 'missing']
  const leave = () => {
    if (draft !== row.text) props.onSave(draft, apply)
  }
  return (
    <li className={styles.row}>
      <p id={`${id}-line`} className={layout.label}>
        {rowLine(row)}
      </p>
      <div className={styles.pair}>
        <div className={styles.side}>
          <span className={`${layout.muted} ${styles.label}`}>
            {sourceLabel(props.sourceLanguage)}
          </span>
          <p id={`${id}-source`} className={styles.sourceText}>
            {sourceLine(row.sourceText)}
          </p>
        </div>
        <div className={styles.side}>
          <span id={`${id}-lang`} className={`${layout.muted} ${styles.label}`}>
            {props.language}
          </span>
          <textarea
            className={styles.text}
            aria-labelledby={`${id}-lang ${id}-line`}
            aria-describedby={`${id}-source`}
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={leave}
          />
        </div>
      </div>
      <div className={`${layout.row} ${styles.controls}`}>
        <span className={`${layout.badge} ${kind}`}>{words.mark}</span>
        {words.from !== null && (
          <span className={`${layout.muted} ${styles.source}`}>{words.from}</span>
        )}
        <label className={styles.tick}>
          <input type="checkbox" checked={apply} onChange={(e) => setApply(e.target.checked)} />
          {`Use for every ${props.language} post with this text box`}
        </label>
        {row.status === 'proposed' && (
          <button
            type="button"
            className={`${layout.quiet} ${layout.small} ${styles.approve}`}
            disabled={props.busy || draft !== row.text}
            onClick={props.onApprove}
          >
            Approve
          </button>
        )}
      </div>
      {props.message !== null && (
        <p role="alert" className={`${layout.notice} ${layout.warn}`}>
          {props.message}
        </p>
      )}
    </li>
  )
}
