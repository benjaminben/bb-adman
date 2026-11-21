// spec/editor.md, "Properties panel": the header (the layer's name and kind) and the empty
// state. The field sections come with P3-13 and P3-14.
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './properties-panel.module.css'

const KIND: Record<LayerRow['type'], string> = {
  text: 'Text',
  image: 'Picture',
  background: 'Background',
}

export function PropertiesPanel(props: { layer: LayerRow | null }) {
  const { layer } = props
  return (
    <section aria-label="Properties" className={styles.panel}>
      {layer ? (
        <header className={styles.header}>
          <h3 className={styles.name}>{layer.name}</h3>
          <p className={styles.kind}>{KIND[layer.type]}</p>
        </header>
      ) : (
        <p className={styles.empty}>Select a layer to change it.</p>
      )}
    </section>
  )
}
