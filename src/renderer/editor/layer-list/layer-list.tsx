// spec/editor.md, "Layer list": the rows from the highest z down, the background last. A click
// selects a row's layer; Up and Down move between rows while the list has the focus. The add
// buttons, toggles, rename and reorder come with P3-12.
import { useId, useMemo, useRef, type KeyboardEvent } from 'react'
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { LayerRow, type RowAsset } from '@/renderer/editor/layer-row'
import styles from './layer-list.module.css'

export type LayerListProps = {
  projectId: string
  layers: Layer[]
  assets: Readonly<Record<string, RowAsset>>
  selectedId: string | null
  onSelect: (layerId: string) => void
}

export function topFirst(layers: Layer[]): Layer[] {
  const rank = (l: Layer) => (l.type === 'background' ? -Infinity : l.z)
  return [...layers].sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id))
}

const STEP: Record<string, number> = { ArrowUp: -1, ArrowDown: 1 }

export function LayerList(props: LayerListProps) {
  const headingId = useId()
  const list = useRef<HTMLUListElement>(null)
  const rows = useMemo(() => topFirst(props.layers), [props.layers])

  function onKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    const step = STEP[event.key]
    const plain = !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey
    if (step === undefined || !plain || rows.length === 0) return
    event.preventDefault()
    const focused = (event.target as HTMLElement).closest('[data-layer-row]')
    const from = rows.findIndex((l) => l.id === focused?.getAttribute('data-layer-row'))
    const next = rows[Math.min(rows.length - 1, Math.max(0, from + step))]
    if (!next) return
    props.onSelect(next.id)
    list.current?.querySelector<HTMLElement>(`[data-layer-row="${CSS.escape(next.id)}"]`)?.focus()
  }

  return (
    <section className={styles.panel} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        Layers
      </h3>
      {/* The arrows act on the buttons inside; the list itself takes no focus. */}
      <ul ref={list} aria-label="Layers" className={styles.list} onKeyDown={onKeyDown}>
        {rows.map((layer) => (
          <li key={layer.id}>
            <LayerRow
              projectId={props.projectId}
              layer={layer}
              assets={props.assets}
              selected={layer.id === props.selectedId}
              onSelect={props.onSelect}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
