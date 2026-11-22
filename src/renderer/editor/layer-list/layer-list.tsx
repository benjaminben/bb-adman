// spec/editor.md, "Layer list" [FR-090, FR-092]: one head line, the heading with the icon buttons
// "Add text layer" and "Add picture layer" (ED-1a), then the rows from the highest z down, the
// background last. A click selects a row's layer; Up and Down move between rows while the list
// has the focus. Drag a row to reorder, press Mod+] and Mod+[, or use a row's More menu; Delete
// and Backspace delete the selected layer (not the background, not a locked layer). Every action
// is one command, so one undo entry. The panel is compact (spec/app-style-parts.md, "Density").
import { useContext, useEffect, useId, useMemo, useRef, type KeyboardEvent } from 'react'
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { LayerRow, type RowAsset } from '@/renderer/editor/layer-row'
import { EditorKeyRoot, useEditorKey } from '@/renderer/editor/use-editor-key'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { focusCopyField } from './focus-copy-field'
import { stackOrder, stepped, topFirst } from './stack-order'
import { useLayerActions } from './use-layer-actions'
import { useRowDrag } from './use-row-drag'
import styles from './layer-list.module.css'

export type LayerListProps = {
  projectId: string
  variantId: string
  layers: Layer[]
  assets: Readonly<Record<string, RowAsset>>
  selectedId: string | null
  onSelect: (layerId: string) => void
}

const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 }

function AddButton(props: { name: string; icon: IconName; onClick: () => void }) {
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={props.name}
      title={props.name}
      onClick={props.onClick}
    >
      <Icon name={props.icon} size="small" />
    </button>
  )
}

export function LayerList(props: LayerListProps) {
  const { layers, selectedId, onSelect } = props
  const headingId = useId()
  const list = useRef<HTMLUListElement>(null)
  const root = useContext(EditorKeyRoot)
  const rows = useMemo(() => topFirst(layers), [layers])
  const order = useMemo(() => stackOrder(layers), [layers])
  const actions = useLayerActions(props.projectId, props.variantId, order)
  const dragFor = useRowDrag(order, actions.reorder)
  // A new text layer whose Copy field takes the focus once the properties panel shows it.
  const copyFor = useRef<string | null>(null)
  const selected = layers.find((l) => l.id === selectedId)

  useEffect(() => {
    if (!selected || copyFor.current !== selected.id) return
    if (focusCopyField(root?.current)) copyFor.current = null
  }, [selected, root])

  const step = (by: 1 | -1) => () => {
    if (selected) actions.reorder(stepped(order, selected.id, by))
  }
  useEditorKey('bringForward', step(1))
  useEditorKey('sendBackward', step(-1))
  useEditorKey('deleteLayer', () => {
    if (selected) actions.remove(selected)
  })

  async function add(type: 'text' | 'image') {
    const id = await actions.create(type)
    if (!id) return
    copyFor.current = type === 'text' ? id : null
    onSelect(id)
  }

  function menuFor(layer: Layer) {
    const at = order.indexOf(layer.id)
    return {
      atFront: at === order.length - 1,
      atBack: at === 0,
      onDuplicate: () => actions.duplicate(layer),
      onForward: () => actions.forward(layer.id),
      onBackward: () => actions.backward(layer.id),
      onDelete: () => actions.remove(layer),
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const step = STEP[event.key]
    const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
    // A key the row's More menu already handled moves in the menu, not between rows.
    if (step === undefined || !plain || rows.length === 0 || event.defaultPrevented) return
    event.preventDefault()
    const focused = (event.target as HTMLElement).closest('[data-layer-id]')
    const from = rows.findIndex((l) => l.id === focused?.getAttribute('data-layer-id'))
    const next = rows[Math.min(rows.length - 1, Math.max(0, from + step))]
    if (!next) return
    onSelect(next.id)
    list.current?.querySelector<HTMLElement>(`[data-layer-row="${CSS.escape(next.id)}"]`)?.focus()
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId} data-density="compact">
      <div className={styles.head}>
        <h3 id={headingId} className={styles.heading}>
          Layers
        </h3>
        <AddButton name="Add text layer" icon="text" onClick={() => void add('text')} />
        <AddButton name="Add picture layer" icon="image" onClick={() => void add('image')} />
      </div>
      {/* The arrows act on the buttons inside; the list itself takes no focus. */}
      <ul ref={list} aria-label="Layers" className={styles.list} onKeyDown={onKeyDown}>
        {rows.map((layer) => (
          <li key={layer.id}>
            <LayerRow
              projectId={props.projectId}
              layer={layer}
              assets={props.assets}
              selected={layer.id === selectedId}
              onSelect={onSelect}
              onToggle={(patch) => actions.update(layer.id, patch)}
              onRename={(name) => actions.update(layer.id, { name })}
              menu={layer.type === 'background' ? undefined : menuFor(layer)}
              drag={dragFor(layer.id, layer.type === 'background')}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
