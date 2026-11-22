// spec/editor.md, "Layer list": one row, drawn as the shared ObjectRow (ED-1a, choice C-3). A
// small whole picture of an image or background layer (or a text mark) and the type icon, the
// name, the marks (icons; their words end the row's name), the eye and the lock, and the More
// menu (not on the background). Clicking the row selects its layer; double-clicking it or F2
// renames it. The draggable box around the ObjectRow is the list's; the list owns the drag.
import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { Icon, type IconName } from '@/renderer/ui/icon'
import { ObjectRow } from '@/renderer/ui/object-row'
import { NameField } from './name-field'
import { RowActions, type RowActionsProps } from './row-actions'
import { RowMarks, rowMarks } from './row-marks'
import { RowMenu, type RowMenuProps } from './row-menu'
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
  // The More menu's state and actions; left out for the background, which has no menu.
  menu?: Omit<RowMenuProps, 'layer'>
  drag: RowDrag
}

// The type icon beside the thumbnail (spec/app-style.md "Editor", "Layer rows"); decorative.
const TYPE_ICON: Record<Layer['type'], IconName> = {
  background: 'layers',
  image: 'image',
  text: 'text',
}

const MAIN = '[data-layer-row]'

export function LayerRow(props: LayerRowProps) {
  const { layer, drag } = props
  const [renaming, setRenaming] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const wasRenaming = useRef(false)
  useEffect(() => {
    if (wasRenaming.current && !renaming) box.current?.querySelector<HTMLElement>(MAIN)?.focus()
    wasRenaming.current = renaming
  }, [renaming])

  // F2 on the row's main button renames; the ObjectRow's own Enter stays a select.
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'F2' || !(event.target as Element).matches(MAIN)) return
    event.preventDefault()
    setRenaming(true)
  }

  // A double-click on the row renames; one on the eye, the lock or the menu does not.
  function onDoubleClick(event: MouseEvent<HTMLDivElement>) {
    const control = (event.target as Element).closest('button, input, [role="menu"]')
    if (control === null || control.matches(MAIN)) setRenaming(true)
  }

  function renamed(name: string | null) {
    setRenaming(false)
    if (name) props.onRename(name)
  }

  const marks = rowMarks(layer, props.assets)
  // The list finds a row's main button by data-layer-row (arrow keys, focus after renaming).
  const mainProps = { 'aria-pressed': props.selected, 'data-layer-row': layer.id }
  const thumb = (
    <span className={styles.thumb}>
      <Thumb projectId={props.projectId} layer={layer} assets={props.assets} />
      <Icon name={TYPE_ICON[layer.type]} size="small" />
    </span>
  )
  return (
    <div
      ref={box}
      data-layer-id={layer.id}
      data-drop={drag.dropAt ?? undefined}
      className={styles.box}
      draggable={drag.draggable && !renaming}
      onDragStart={drag.onDragStart}
      onDragOver={drag.onDragOver}
      onDragLeave={drag.onDragLeave}
      onDrop={drag.onDrop}
      onDragEnd={drag.onDragEnd}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
    >
      <ObjectRow
        label={[layer.name, ...marks].join(' ')}
        thumb={thumb}
        name={renaming ? <NameField name={layer.name} onDone={renamed} /> : layer.name}
        marks={marks.length > 0 ? <RowMarks marks={marks} /> : undefined}
        stateActions={<RowActions layer={layer} onToggle={props.onToggle} />}
        more={props.menu && <RowMenu layer={layer} {...props.menu} />}
        selected={props.selected}
        muted={!layer.visible}
        onSelect={() => props.onSelect(layer.id)}
        mainProps={mainProps}
      />
    </div>
  )
}
