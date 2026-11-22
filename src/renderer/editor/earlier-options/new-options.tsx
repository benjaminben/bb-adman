// "New pictures" (spec/phases/round-2-editor.md D6, R2E-5): the run the Generate panel
// started, drawn first in its own region, with the same option buttons and "In use" mark as
// "Earlier options". The title names the region but is not an h element, as there.
import type { EarlierOption } from '@/shared/schemas/queries/earlier-options'
import { RunBlock } from './run-block'
import styles from './earlier-options.module.css'

export type NewOptionsProps = {
  projectId: string
  layerId: string
  option: EarlierOption
  inUse: string | null
  locked: boolean
  onUse: (assetId: string) => void
}

export function NewOptions(props: NewOptionsProps) {
  const titleId = `${props.layerId}-new`
  return (
    <section className={styles.section} aria-labelledby={titleId}>
      <p id={titleId} className={styles.heading}>
        New pictures
      </p>
      <ul className={styles.runs}>
        <RunBlock
          projectId={props.projectId}
          option={props.option}
          inUse={props.inUse}
          locked={props.locked}
          onUse={props.onUse}
        />
      </ul>
    </section>
  )
}
