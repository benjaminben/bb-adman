// spec/editor.md, "Layer list": one row. A small whole picture of an image or background layer
// (or a text mark), the name, and the marks: "Empty", "Does not fit", "File not found", and
// "Stays at the bottom" for the background. Clicking the row selects its layer; double-clicking
// the name or F2 renames it; the row's buttons hide, lock and delete. The list owns the drag.
import { Fragment, useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { Icon, type IconName } from '@/renderer/ui/icon'
import { NameField } from './name-field'
import { RowActions, type RowActionsProps } from './row-actions'
import { Thumb } from './thumb'
import styles from './layer-row.module.css'

export type RowAsset = { missing: boolean; kind: string; version: number }

export type DropAt = 'above' | 'below'

// What the list gives a row for dragging: whether it may be dragged, where a drop would land
// (drawn as a line), and the drag handlers for the row's box.
export type RowDrag = {
  draggable: boolean
  dropAt: DropAt | null
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragOver: (event: DragEvent<HTMLElement>) => void
  onDragLeave: () => void
  onDrop: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
}

export type LayerRowProps = {
  projectId: string
  layer: Layer
  assets: Readonly<Record<string, RowAsset>>
  selected: boolean
  onSelect: (layerId: string) => void
  onToggle: RowActionsProps['onToggle']
  onRename: (name: string) => void
  onDelete: () => void
  drag: RowDrag
}

function named(layer: Layer): string[] {
  const font = 'fontAssetId' in layer.style ? layer.style.fontAssetId : null
  return [layer.source?.assetId, font].filter((id): id is string => typeof id === 'string')
}

export function rowMarks(layer: Layer, assets: LayerRowProps['assets']): string[] {
  const marks: string[] = []
  if (layer.type === 'image' && layer.source === null) marks.push('Empty')
  if (layer.type === 'text' && layer.overflow) marks.push('Does not fit')
  if (named(layer).some((id) => assets[id]?.missing)) marks.push('File not found')
  if (layer.type === 'background') marks.push('Stays at the bottom')
  return marks
}

// The type icon beside the name (spec/app-style.md "Editor", "Layer rows"); decorative.
const TYPE_ICON: Record<Layer['type'], IconName> = {
  background: 'layers',
  image: 'image',
  text: 'text',
}

function Marks(props: { marks: string[] }) {
  if (props.marks.length === 0) return null
  return (
    <span className={styles.marks}>
      {props.marks.map((mark) => (
        <Fragment key={mark}>
          {' '}
          <span className={styles.mark}>{mark}</span>
        </Fragment>
      ))}
    </span>
  )
}

export function LayerRow(props: LayerRowProps) {
  const { layer, drag } = props
  const [renaming, setRenaming] = useState(false)
  const [pointed, setPointed] = useState(false)
  const [focused, setFocused] = useState(false)
  const rowButton = useRef<HTMLButtonElement>(null)
  const wasRenaming = useRef(false)
  useEffect(() => {
    if (wasRenaming.current && !renaming) rowButton.current?.focus()
    wasRenaming.current = renaming
  }, [renaming])

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'F2') return
    event.preventDefault()
    setRenaming(true)
  }

  function renamed(name: string | null) {
    setRenaming(false)
    if (name) props.onRename(name)
  }

  const thumb = <Thumb projectId={props.projectId} layer={layer} assets={props.assets} />
  return (
    <div
      data-layer-id={layer.id}
      data-drop={drag.dropAt ?? undefined}
      className={layer.visible ? styles.box : `${styles.box} ${styles.hiddenLayer}`}
      draggable={drag.draggable && !renaming}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragLeave={drag.onDragLeave}
      onDrop={drag.onDrop}
      onDragEnd={drag.onDragEnd}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => setFocused(event.currentTarget.contains(event.relatedTarget))}
    >
      {renaming ? (
        <span className={styles.row}>
          {thumb}
          <NameField name={layer.name} onDone={renamed} />
        </span>
      ) : (
        <button
          ref={rowButton}
          type="button"
          data-layer-row={layer.id}
          className={props.selected ? `${styles.row} ${styles.selected}` : styles.row}
          aria-pressed={props.selected}
          onClick={() => props.onSelect(layer.id)}
          onKeyDown={onKeyDown}
        >
          {thumb}
          <span className={styles.type}>
            <Icon name={TYPE_ICON[layer.type]} size="small" />
          </span>
          <span className={styles.text}>
            <span className={styles.name} onDoubleClick={() => setRenaming(true)}>
              {layer.name}
            </span>
            <Marks marks={rowMarks(layer, props.assets)} />
          </span>
        </button>
      )}
      <RowActions
        layer={layer}
        active={props.selected || pointed || focused}
        onToggle={props.onToggle}
        onDelete={props.onDelete}
      />
    </div>
  )
}
