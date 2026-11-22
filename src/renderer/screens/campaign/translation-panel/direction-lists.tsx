// R3-3: a language block's rows split by direction, in the Variants tab's order
// (translation-order.ts). When the campaign has more than one direction, each list follows an
// h3 with the direction's name, as the Variants tab names it, and the list's name ends
// " in {direction}".
import { Fragment, type ReactNode } from 'react'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import { byDirection } from './translation-order'
import styles from './translation-panel.module.css'

type Placed = { directionId: string; variantId: string }

export type DirectionListsProps<R extends Placed> = {
  rows: R[]
  data: CampaignGet
  label: string // the list's name, "{language} translations"
  children: (row: R) => ReactNode
}

export function DirectionLists<R extends Placed>(props: DirectionListsProps<R>) {
  const named = props.data.directions.length > 1
  return byDirection(props.rows, props.data).map((group) => {
    const heading = named && group.name !== ''
    return (
      <Fragment key={group.directionId}>
        {heading && <h3 className={styles.direction}>{group.name}</h3>}
        <ul
          className={styles.rows}
          aria-label={heading ? `${props.label} in ${group.name}` : props.label}
        >
          {group.rows.map(props.children)}
        </ul>
      </Fragment>
    )
  })
}
