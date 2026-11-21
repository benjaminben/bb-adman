// The layer list alone, inside an editor root, as the editor mounts it. It keeps the layers and
// the selection itself, applies project.changed layer rows as the variant store does, and holds
// a stand-in Copy field, as the properties panel shows for a selected text layer.
import { useEffect, useRef, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { LayerList } from '@/renderer/editor/layer-list'
import { EditorKeyRoot } from '@/renderer/editor/use-editor-key'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { makeFakeApi } from '../fake-api'
import { renderApp } from '../render'
import { BACKGROUND, HEADLINE, LOGO, P, V, layer } from './editor-fixture'

export const OFFER = layer({ id: 'L3', variantId: V, type: 'text', name: 'Offer', z: 3 })
export const LAYERS = [BACKGROUND, HEADLINE, LOGO, OFFER]

function Harness(props: { layers: LayerRow[]; selected: string | null }) {
  const api = useApi()
  const root = useRef<HTMLDivElement>(null)
  const [layers, setLayers] = useState(props.layers)
  const [selected, setSelected] = useState(props.selected)
  useEffect(
    () =>
      api.on('project.changed', (event) => {
        const rows = (event.changed.layer ?? []) as LayerRow[]
        setLayers((held) => [...held.filter((l) => !rows.some((r) => r.id === l.id)), ...rows])
      }),
    [api],
  )
  const copyShown = layers.some((l) => l.id === selected && l.type === 'text')
  return (
    <EditorKeyRoot.Provider value={root}>
      <div ref={root}>
        <LayerList
          projectId={P}
          variantId={V}
          layers={layers}
          assets={{}}
          selectedId={selected}
          onSelect={setSelected}
        />
        <section aria-label="Properties">
          <output aria-label="Selected">{selected ?? ''}</output>
          {copyShown && <textarea aria-label="Copy" />}
        </section>
      </div>
    </EditorKeyRoot.Provider>
  )
}

export async function openList(layers: LayerRow[] = LAYERS, selected: string | null = null) {
  const fake = makeFakeApi()
  const view = await renderApp(<Harness layers={layers} selected={selected} />, fake)
  const sent = (name: string) => fake.commands.filter((c) => c.name === name).map((c) => c.input)
  return { ...view, fake, sent }
}
