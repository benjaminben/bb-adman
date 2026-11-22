// The export dialog's "Ads to export": one tick per ad of the campaign, "{title} · {size} ·
// {language} · {format}", with "Tick all" and "Untick all". Titles are drawn as text.
import layout from '@/renderer/ui/layout.module.css'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import styles from './export-dialog.module.css'

export type AdTicksProps = {
  ads: VariantSummary[]
  ticked: ReadonlySet<string>
  disabled: boolean
  onChange: (ticked: Set<string>) => void
}

export const adLine = (ad: VariantSummary) => `${ad.title} · ${ad.sizeLabel} · ${ad.language}`

export function AdTicks(props: AdTicksProps) {
  const { ads, ticked } = props

  function toggle(id: string) {
    const next = new Set(ticked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    props.onChange(next)
  }

  return (
    <fieldset className={styles.group} disabled={props.disabled}>
      <legend>Ads to export</legend>
      <div className={layout.row}>
        <button
          type="button"
          className={layout.small}
          onClick={() => props.onChange(new Set(ads.map((ad) => ad.id)))}
        >
          Tick all
        </button>
        <button type="button" className={layout.small} onClick={() => props.onChange(new Set())}>
          Untick all
        </button>
      </div>
      <ul className={`${layout.list} ${styles.ads}`}>
        {ads.map((ad) => (
          <li key={ad.id}>
            <label className={styles.choice}>
              <input type="checkbox" checked={ticked.has(ad.id)} onChange={() => toggle(ad.id)} />
              {`${adLine(ad)} · ${ad.format}`}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
