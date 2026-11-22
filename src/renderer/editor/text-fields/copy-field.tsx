// spec/editor.md, "Properties panel", "Text": "Copy", a text area that saves on leaving it or with
// Mod+Enter (the saveCopy shortcut, which works inside fields). Enter adds a line.
// ED-2: the first thing in the panel, with no title shown (its name stays "Copy"); `action`
// ("Suggest copy…") sits in the field's top right corner.
import { useId, useState, type ReactNode } from 'react'
import { useDraft } from '@/renderer/editor/number-field'
import { useEditorKey } from '@/renderer/editor/use-editor-key'
import layout from '@/renderer/ui/layout.module.css'
import styles from './text-fields.module.css'

type Props = {
  copy: string
  disabled: boolean
  action?: ReactNode
  onCommit: (copy: string) => Promise<string | null>
}

export function CopyField(props: Props) {
  const id = useId()
  const [focused, setFocused] = useState(false)
  const draft = useDraft(props.copy, props.onCommit)
  useEditorKey('saveCopy', () => void draft.save(), focused)
  const withAction = props.action !== undefined && props.action !== null

  return (
    <div className={styles.field}>
      <label className={styles.hidden} htmlFor={id}>
        Copy
      </label>
      <div className={styles.copyBox}>
        {withAction && <span className={styles.corner}>{props.action}</span>}
        <textarea
          id={id}
          className={`${layout.reading} ${styles.copy} ${withAction ? styles.roomy : ''}`}
          rows={3}
          aria-describedby={draft.error ? `${id}-error` : undefined}
          disabled={props.disabled}
          value={draft.text}
          onChange={(event) => draft.setText(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            void draft.save()
          }}
        />
      </div>
      {draft.error && (
        <p id={`${id}-error`} className={styles.error}>
          {draft.error}
        </p>
      )}
    </div>
  )
}
