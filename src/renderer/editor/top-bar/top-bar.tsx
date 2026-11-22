// spec/editor.md, "Top bar", as ED-5 (spec/phases/design-wave-screens-a.md) draws it on one
// line: the title as a button named "Rename {title}" (a click or F2 opens the title field), the
// Master mark, a size chip, the Format choice, then icon buttons that keep their names: "Place
// text with AI…" (P4-16; disabled with its hint as title and description when no visible text
// layer has copy, and while its run for the variant is going), the "Layout…" slot (LK-6), Undo
// and Redo for the variant's own list [FR-095]. Mod+Z and Mod+Shift+Z press Undo and Redo.
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { FormatFields } from '@/renderer/editor/format-fields'
import { NO_TEXT_HINT } from '@/renderer/editor/layout-run'
import { useEditorKey } from '@/renderer/editor/use-editor-key'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import { TitleField } from './title-field'
import styles from './top-bar.module.css'

export type TopBarProps = {
  projectId: string
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

type ToolProps = {
  name: string
  icon: IconName
  disabled: boolean
  onClick: () => void
  hint?: { id: string; words: string }
}

function Tool({ name, icon, disabled, onClick, hint }: ToolProps) {
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={name}
      title={hint?.words ?? name}
      aria-describedby={hint?.id}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} />
    </button>
  )
}

export function TopBar(props: TopBarProps) {
  const { variant } = props
  const [renaming, setRenaming] = useState(false)
  const titleButton = useRef<HTMLButtonElement>(null)
  const hintId = useId()
  useEditorKey('undo', props.onUndo, props.canUndo)
  useEditorKey('redo', props.onRedo, props.canRedo)

  async function done(title: string | null) {
    if (title && title !== variant.title && !(await props.onRename(title))) return
    setRenaming(false)
    requestAnimationFrame(() => titleButton.current?.focus())
  }

  function onTitleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'F2') return
    event.preventDefault()
    setRenaming(true)
  }

  const hint = props.canPlaceText ? undefined : { id: hintId, words: NO_TEXT_HINT }
  return (
    <header className={styles.bar}>
      <div className={styles.name}>
        {renaming ? (
          <TitleField title={variant.title} onDone={(title) => void done(title)} />
        ) : (
          <h3 className={styles.title}>
            <button
              ref={titleButton}
              type="button"
              className={`${layout.quiet} ${styles.titleButton}`}
              aria-label={`Rename ${variant.title}`}
              onClick={() => setRenaming(true)}
              onKeyDown={onTitleKey}
            >
              <span className={styles.titleWords}>{variant.title}</span>
              <span className={styles.pencil}>
                <Icon name="pencil" size="small" />
              </span>
            </button>
          </h3>
        )}
        {variant.isMaster && <StatusMark tone="accent" icon="star" label="Master" tip="Master" />}
        <span className={layout.chip} title={`${variant.sizeLabel} · ${variant.language}`}>
          {variant.width} × {variant.height}
        </span>
      </div>
      <FormatFields projectId={props.projectId} variant={variant} />
      <div className={styles.actions}>
        <Tool
          name="Place text with AI…"
          icon="sparkle"
          disabled={!props.canPlaceText || props.placing === true}
          onClick={props.onPlaceText}
          hint={hint}
        />
        {hint && (
          <span id={hint.id} className={styles.hidden}>
            {hint.words}
          </span>
        )}
        {props.layout}
        <Tool name="Undo" icon="undo" disabled={!props.canUndo} onClick={props.onUndo} />
        <Tool name="Redo" icon="redo" disabled={!props.canRedo} onClick={props.onRedo} />
      </div>
    </header>
  )
}
