// spec/editor.md, "Properties panel", "Text": "Copy", a text area that saves on leaving it or with
// Mod+Enter (the saveCopy shortcut, which works inside fields). Enter adds a line.
// P4-17: `action` ("Suggest copy…") sits beside the label.
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

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>
          Copy
        </label>
        {props.action}
      </div>
      <textarea
        id={id}
        className={`${layout.reading} ${styles.copy}`}
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
      {draft.error && (
        <p id={`${id}-error`} className={styles.error}>
          {draft.error}
        </p>
      )}
    </div>
  )
}
