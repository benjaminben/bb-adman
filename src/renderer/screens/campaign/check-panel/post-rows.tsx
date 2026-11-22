// One checked post in the check table (CAMP-4): its own row group, so the findings row stays
// with it. The first cell is the post's thumbnail and "{size} · {language}" (a ★ mark on the
// master, a clock mark when changed since its check); then one mark per check. A click on the
// row, or Enter on its button, folds the findings open under it: each check's name, then each
// finding line word for word. Findings are React text only: rule words are typed by anyone.
import type { CheckResult } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { StatusMark } from '@/renderer/ui/status-mark'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import { CHECKS, cellTip, checkName, rowLabel, withFindings } from './check-words'
import styles from './check-panel.module.css'

export type Post = { variant: VariantSummary; state: VariantCheckState }

// The row button's id, so the "{n} warnings" mark can move focus to it.
export const rowButtonId = (variantId: string) => `check-row-${variantId}`

const STALE = 'Changed since the last check'

function Cell(props: { result: CheckResult | undefined }) {
  const r = props.result
  if (r === undefined) return <td className={styles.cell} />
  const tip = cellTip(r)
  return (
    <td className={styles.cell}>
      {r.status === 'pass' && <StatusMark tone="ok" icon="check" tip={tip} />}
      {r.status === 'warn' && <StatusMark tone="warn" icon="alert" tip={tip} />}
      {r.status === 'skipped' && <StatusMark tone="none" icon="minus" tip={tip} />}
    </td>
  )
}

function Label(props: { projectId: string; post: Post }) {
  const { variant, state } = props.post
  return (
    <>
      <span className={styles.thumb} aria-hidden="true">
        <VariantThumbnail
          projectId={props.projectId}
          variantId={variant.id}
          rev={variant.rev}
          alt=""
        />
      </span>
      <span>{rowLabel(variant)}</span>
      {variant.isMaster && <StatusMark tone="accent" icon="star" tip="Master" />}
      {state.stale && <StatusMark tone="none" icon="clock" tip={STALE} />}
    </>
  )
}

function Findings(props: { id: string; results: CheckResult[] }) {
  return (
    <tr id={props.id}>
      <td colSpan={CHECKS.length + 1} className={styles.findingsCell}>
        <div className={styles.findings}>
          {props.results.map((r) => (
            <div key={r.checkId} className={styles.finding}>
              <p className={styles.checkName}>{checkName(r.checkId)}</p>
              <ul className={r.status === 'skipped' ? styles.muted : undefined}>
                {r.findings.map((f, i) => (
                  <li key={`${i}-${f.layerId ?? ''}`}>{f.message}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </td>
    </tr>
  )
}

export function PostRows(props: {
  projectId: string
  post: Post
  open: boolean
  onToggle: () => void
}) {
  const { variant, state } = props.post
  const found = withFindings(state.results)
  const opens = found.length > 0
  const findingsId = `check-findings-${variant.id}`
  return (
    <tbody className={state.stale ? styles.stale : undefined}>
      <tr className={opens ? styles.opens : undefined} onClick={opens ? props.onToggle : undefined}>
        <th scope="row" className={styles.post}>
          {opens ? (
            <button
              id={rowButtonId(variant.id)}
              type="button"
              className={styles.postButton}
              aria-expanded={props.open}
              aria-controls={props.open ? findingsId : undefined}
            >
              <Label projectId={props.projectId} post={props.post} />
            </button>
          ) : (
            <span className={styles.postButton}>
              <Label projectId={props.projectId} post={props.post} />
            </span>
          )}
        </th>
        {CHECKS.map((id) => (
          <Cell key={id} result={state.results.find((r) => r.checkId === id)} />
        ))}
      </tr>
      {opens && props.open && <Findings id={findingsId} results={found} />}
    </tbody>
  )
}
