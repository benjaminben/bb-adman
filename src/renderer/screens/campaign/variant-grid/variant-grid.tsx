// The campaign's variants as a grid of tiles (spec/screens-campaign.md, "The campaign grid
// and the variant tile"), in the order campaign.get gives them. One grid for the whole
// campaign; one per direction comes with Phase 5.
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { VariantTile } from '@/renderer/screens/campaign/variant-tile'
import layout from '@/renderer/ui/layout.module.css'
import styles from './variant-grid.module.css'

export type VariantGridProps = {
  variants: VariantSummary[]
  chosenId: string | null
  onChoose: (variantId: string) => void
}

export function VariantGrid(props: VariantGridProps) {
  if (props.variants.length === 0) {
    return <p className={layout.muted}>This campaign has no variants.</p>
  }
  return (
    <ul aria-label="Variants" className={styles.grid}>
      {props.variants.map((v) => (
        <li key={v.id}>
          <VariantTile variant={v} chosen={v.id === props.chosenId} onChoose={props.onChoose} />
        </li>
      ))}
    </ul>
  )
}
