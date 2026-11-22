// R3-3: one text of the primary language in the Translations tab's source block. The post's
// thumbnail and "{size} · {layer}" as in the other blocks, then the text in a field named
// "{language} {title} · {size} · {layer}". Enter or leaving the field saves an edited text
// (Shift+Enter adds a line); Escape puts the old words back. A refusal shows as one line under
// the row. Every text from the row is drawn as React text only.
import { useState, type KeyboardEvent } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { SourceRow as Row } from '@/shared/schemas/queries/translation'
import { postLine, rowLine } from './translation-words'
import styles from './translation-panel.module.css'

export type SourceRowProps = {
  projectId: string
  row: Row
  rev: number | undefined // the variant's revision for its thumbnail; none when not listed
  language: string // the language's name in words
  message: string | null
  onSave: (text: string) => void
}

export function SourceRow(props: SourceRowProps) {
  const { row } = props
  const [draft, setDraft] = useState(row.text)
  const leave = () => {
    if (draft !== row.text) props.onSave(draft)
  }
  const keys = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(row.text)
    }
  }
  return (
    <li className={styles.row}>
      <span className={styles.post} title={row.title}>
        <span className={styles.thumb} aria-hidden="true">
          {props.rev !== undefined && (
            <VariantThumbnail
              projectId={props.projectId}
              variantId={row.variantId}
              rev={props.rev}
              alt=""
            />
          )}
        </span>
        <span className={styles.postLine}>{postLine(row)}</span>
      </span>
      <textarea
        className={`${styles.text} ${styles.spans}`}
        aria-label={`${props.language} ${rowLine(row)}`}
        value={draft}
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={keys}
        onBlur={leave}
      />
      {props.message !== null && (
        <p role="alert" className={`${layout.notice} ${layout.warn} ${styles.refusal}`}>
          {props.message}
        </p>
      )}
    </li>
  )
}
