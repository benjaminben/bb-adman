// "New pictures" (spec/phases/round-2-editor.md D6, R2E-5; ED-4b): the run the Generate panel
// started, drawn above "Earlier options" and never folded, as a strip of tiles. While it runs,
// one placeholder tile with a spinner per picture asked and not yet made; once done, the
// pictures: the one on the layer "In use", the others "New result". The words of the run's
// state are the Generate fields' hidden status (generate-fields/run-status.tsx).
import { requestCount } from '@/renderer/stores/job-store'
import type { EarlierOption } from '@/shared/schemas/queries/earlier-options'
import { OptionTile, PendingTile } from './option-tile'
import { useApp } from '@/renderer/app/app-context'
import { useRunName } from '@/renderer/ui/run-name'
import { runTime, runTitle } from './run-words'
import styles from './earlier-options.module.css'

export type NewOptionsProps = {
  projectId: string
  option: EarlierOption
  inUse: string | null
  locked: boolean
  onUse: (assetId: string) => void
}

export function NewOptions(props: NewOptionsProps) {
  const { option } = props
  const row = option.job
  const time = runTime(row.createdAt)
  // Which provider made these stays reachable: the run's header is the strip's tooltip.
  const providers = useApp((s) => s.app?.providers)
  // R3-2: the service and model that make them, on the page above the strip.
  const { words } = useRunName(row, 'The provider')
  const going = row.status === 'queued' || row.status === 'running'
  const asked = requestCount(row) ?? option.assets.length
  const pending = going ? Math.max(0, asked - option.assets.length) : 0
  return (
    <section className={styles.fresh} aria-label="New pictures">
      <p className={styles.service}>{words}</p>
      <ul className={styles.runs}>
        <li data-run={row.id} title={runTitle(row, providers ?? [])}>
          <ul className={styles.tiles}>
            {option.assets.map((asset, i) => (
              <OptionTile
                key={asset.assetId}
                projectId={props.projectId}
                asset={asset}
                name={`Use option ${i + 1} from ${time}`}
                used={asset.assetId === props.inUse}
                fresh
                disabled={props.locked}
                onUse={props.onUse}
              />
            ))}
            {Array.from({ length: pending }, (_, i) => (
              <PendingTile key={i} />
            ))}
          </ul>
        </li>
      </ul>
    </section>
  )
}
