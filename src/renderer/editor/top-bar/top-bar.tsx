// spec/editor.md, "Top bar": the title with Rename, the Master mark, the size line, and Undo
// and Redo for the variant's own list [FR-095]. Mod+Z and Mod+Shift+Z press the same buttons.
// P4-16 (spec/screens-ai.md, "Place text with AI"): "Place text with AI…", disabled with its
// hint when no visible text layer has copy, and disabled while its run for the variant is going.
// LK-6 ("Layout…"): a slot after it for the layout button.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { NO_TEXT_HINT } from '@/renderer/editor/layout-run'
import { useEditorKey } from '@/renderer/editor/use-editor-key'
import styles from './top-bar.module.css'

export type TopBarProps = {
  variant: VariantSummary
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  // Resolves true when the new title was saved.
  onRename: (title: string) => Promise<boolean>
  canPlaceText: boolean
  onPlaceText: () => void
  placing?: boolean
  layout?: ReactNode
}

export function sizeLine(v: VariantSummary): string {
  return `${v.sizeLabel} · ${v.width} × ${v.height} px · ${v.language} · ${v.format}`
}

function TitleField(props: { title: string; onDone: (title: string | null) => void }) {
  const field = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(props.title)
  useEffect(() => field.current?.focus(), [])
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      props.onDone(null)
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      props.onDone(value.trim())
    }
  }
  return (
    <input
      ref={field}
      className={styles.field}
      aria-label="Variant title"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={onKeyDown}
    />
  )
}

export function TopBar(props: TopBarProps) {
  const { variant } = props
  const [renaming, setRenaming] = useState(false)
  const renameButton = useRef<HTMLButtonElement>(null)
  const hintId = useId()
  useEditorKey('undo', props.onUndo, props.canUndo)
  useEditorKey('redo', props.onRedo, props.canRedo)

  async function done(title: string | null) {
    if (title && title !== variant.title && !(await props.onRename(title))) return
    setRenaming(false)
    requestAnimationFrame(() => renameButton.current?.focus())
  }

  return (
    <header className={styles.bar}>
      <div className={styles.name}>
        {renaming ? (
          <TitleField title={variant.title} onDone={(title) => void done(title)} />
        ) : (
          <>
            <h3 className={styles.title}>{variant.title}</h3>
            <button ref={renameButton} type="button" onClick={() => setRenaming(true)}>
              Rename
            </button>
          </>
        )}
        {variant.isMaster && <span className={styles.mark}>Master</span>}
      </div>
      <p className={styles.line}>{sizeLine(variant)}</p>
      <div className={styles.actions}>
        <button
          type="button"
          disabled={!props.canPlaceText || props.placing}
          aria-describedby={props.canPlaceText ? undefined : hintId}
          onClick={props.onPlaceText}
        >
          Place text with AI…
        </button>
        {!props.canPlaceText && (
          <span id={hintId} className={styles.hint}>
            {NO_TEXT_HINT}
          </span>
        )}
        {props.layout}
        <button type="button" disabled={!props.canUndo} onClick={props.onUndo}>
          Undo
        </button>
        <button type="button" disabled={!props.canRedo} onClick={props.onRedo}>
          Redo
        </button>
      </div>
    </header>
  )
}
