// The campaign's variants (SPEC 14 1.41 TP-2 "Variants"): title, size, language, format and
// whether it is the master, in the order campaign.get gives them. One can be chosen. Titles
// are drawn as text.
import type { VariantSummary } from '../../../shared/schemas/queries/campaign'
import styles from '../screens.module.css'

export function variantText(v: VariantSummary): string {
  const parts = [v.title, `${v.width}×${v.height} (${v.sizeLabel})`, v.language, v.format]
  if (v.isMaster) parts.push('master')
  return parts.join(' · ')
}

export function VariantList(props: {
  variants: VariantSummary[]
  chosenId: string | null
  onChoose: (variantId: string) => void
}) {
  return (
    <fieldset className={styles.list}>
      <legend>Variants</legend>
      {props.variants.map((v) => (
        <label key={v.id} className={styles.row}>
          <input
            type="radio"
            name="variant"
            value={v.id}
            checked={v.id === props.chosenId}
            onChange={() => props.onChoose(v.id)}
          />
          {variantText(v)}
        </label>
      ))}
    </fieldset>
  )
}
