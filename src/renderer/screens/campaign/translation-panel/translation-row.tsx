// One translation (spec/phases/phase-06.md, design addition 8; CAMP-5): one line of the
// language's table. The post's thumbnail and "{size} · {layer}" (its title in the tooltip); the
// source text, read only; the field, named "{language} {title} · {size} · {layer}" and described
// by the source text; the link toggle "Use for every {language} post with this text box"; the
// status mark ("Proposed" approves the row) and the source icon. Leaving an edited field sends
// the text with the toggle's choice. The mark is the stored status as read, never a local guess.
// A refusal shows as one line under the row. Every text from the row is drawn as React text only.
import { useId, useState } from 'react'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { TranslationRow as Row } from '@/shared/schemas/queries/translation'
import { RowMark, SourceIcon } from './row-mark'
import { postLine, rowLine, sourceLine } from './translation-words'
import styles from './translation-panel.module.css'

export type TranslationRowProps = {
  projectId: string
  row: Row
  rev: number | undefined // the variant's revision for its thumbnail; none when not listed
  language: string // the language's name in words
  message: string | null
  busy: boolean
  onSave: (text: string, applyToSameLanguage: boolean) => void
  onApprove: () => void
}

export function TranslationRow(props: TranslationRowProps) {
  const { row } = props
  const id = useId()
  const [draft, setDraft] = useState(row.text)
  const [apply, setApply] = useState(false)
  const link = `Use for every ${props.language} post with this text box`
  const leave = () => {
    if (draft !== row.text) props.onSave(draft, apply)
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
      <p id={`${id}-source`} className={styles.sourceText}>
        {sourceLine(row.sourceText)}
      </p>
      <textarea
        className={styles.text}
        aria-label={`${props.language} ${rowLine(row)}`}
        aria-describedby={`${id}-source`}
        value={draft}
        rows={2}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={leave}
      />
      <span className={styles.controls}>
        <button
          type="button"
          className={layout.iconButton}
          aria-pressed={apply}
          aria-label={link}
          title={link}
          onClick={() => setApply(!apply)}
        >
          <Icon name="link" />
        </button>
        <RowMark
          status={row.status}
          disabled={props.busy || draft !== row.text}
          onApprove={props.onApprove}
        />
        <SourceIcon source={row.source} />
      </span>
      {props.message !== null && (
        <p role="alert" className={`${layout.notice} ${layout.warn} ${styles.refusal}`}>
          {props.message}
        </p>
      )}
    </li>
  )
}
