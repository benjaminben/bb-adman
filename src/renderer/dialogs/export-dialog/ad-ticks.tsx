// The export dialog's ads (DLG-6a): one row per ad of the campaign, its thumbnail and
// "{size} · {language}", with a tick named "{title} · {size} · {language} · {format}". One
// tri-state tick in the header, "All ads", ticks or unticks every ad; the header shows
// "Ads {k}/{n}". A click on a row flips its tick. Titles are drawn as text.
import { useEffect, useRef } from 'react'
import { ObjectRow } from '@/renderer/ui/object-row'
import layout from '@/renderer/ui/layout.module.css'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import styles from './export-dialog.module.css'

export type AdTicksProps = {
  projectId: string
  ads: VariantSummary[]
  ticked: ReadonlySet<string>
  disabled: boolean
  onChange: (ticked: Set<string>) => void
}

export const adLine = (ad: VariantSummary) => `${ad.title} · ${ad.sizeLabel} · ${ad.language}`
export const adName = (ad: VariantSummary) => `${ad.sizeLabel} · ${ad.language}`

// The row's main button lies under the tick and is left out of the tab order and the tree.
const COVER = { tabIndex: -1, 'aria-hidden': true } as const

export function AdThumb(props: { projectId: string; ad: VariantSummary }) {
  const { ad } = props
  return <VariantThumbnail projectId={props.projectId} variantId={ad.id} rev={ad.rev} alt="" />
}

function AllAds(props: AdTicksProps) {
  const { ads, ticked } = props
  const box = useRef<HTMLInputElement>(null)
  const count = ads.filter((ad) => ticked.has(ad.id)).length
  const all = count === ads.length && count > 0
  const some = count > 0 && !all
  useEffect(() => {
    if (box.current) box.current.indeterminate = some
  }, [some])
  return (
    <div className={styles.adsHead}>
      <span>{`Ads ${count}/${ads.length}`}</span>
      <input
        ref={box}
        type="checkbox"
        aria-label="All ads"
        checked={all}
        onChange={() => props.onChange(all ? new Set() : new Set(ads.map((ad) => ad.id)))}
      />
    </div>
  )
}

export function AdTicks(props: AdTicksProps) {
  const { ads, ticked } = props

  function toggle(id: string) {
    const next = new Set(ticked)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    props.onChange(next)
  }

  return (
    <fieldset className={styles.group} disabled={props.disabled} aria-label="Ads to export">
      <AllAds {...props} />
      <ul className={`${layout.list} ${styles.ads}`}>
        {ads.map((ad) => (
          <li key={ad.id}>
            <ObjectRow
              name={adName(ad)}
              label={adLine(ad)}
              title={adLine(ad)}
              thumb={<AdThumb projectId={props.projectId} ad={ad} />}
              mainProps={COVER}
              onSelect={() => !props.disabled && toggle(ad.id)}
              stateActions={
                <input
                  type="checkbox"
                  aria-label={`${adLine(ad)} · ${ad.format}`}
                  checked={ticked.has(ad.id)}
                  onChange={() => toggle(ad.id)}
                />
              }
            />
          </li>
        ))}
      </ul>
    </fieldset>
  )
}
