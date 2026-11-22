// The workflows an ok comfy.check answered for (SPEC 14 1.41 TP-3, 6.10.9; SET-2). One row per
// workflow: its label, its status as now, and a mark: "Complete" or "{n} missing", with the
// missing items listed under it (they are the fix). A commercial licence keeps a short mark on
// the row; the longer note is in an InfoTip. Model and licence text are drawn as text only. No
// row is drawn for a draft workflow ([1.45] B-3). The version and a failure are drawn by
// CheckMark and the ComfyUI section.
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { MissingItem } from '@/shared/schemas/queries/app'
import { missingItemText } from '@/renderer/ui/missing-item-text'
import { StatusMark } from '@/renderer/ui/status-mark'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './comfy-check-result.module.css'

function MissingMark(props: { missing: MissingItem[] }) {
  const n = props.missing.length
  if (n === 0) return <StatusMark tone="ok" icon="check" label="Complete" tip="Complete" />
  const tip = `Missing ${n} item${n === 1 ? '' : 's'}`
  return <StatusMark tone="warn" icon="alert" label={`${n} missing`} tip={tip} />
}

function WorkflowRow(props: { workflow: WorkflowInfo; missing: MissingItem[] }) {
  const { workflow, missing } = props
  const labelId = `comfy-workflow-${workflow.id}`
  const note = workflow.licence.commercialNote
  return (
    <li aria-labelledby={labelId}>
      <div className={styles.row}>
        <span id={labelId} className={styles.name}>
          {workflow.label}
        </span>
        <span className={layout.muted}>{workflow.status}</span>
        {note !== null && (
          <span className={styles.licence}>
            <StatusMark
              tone="warn"
              icon="alert"
              label="Commercial licence needed"
              tip="Commercial licence needed"
            />
            <InfoTip about={`${workflow.label} licence`}>{note}</InfoTip>
          </span>
        )}
        <MissingMark missing={missing} />
      </div>
      {missing.length > 0 && (
        <ul>
          {missing.map((item) => (
            <li key={`${item.what}:${item.folder ?? ''}:${item.name}`}>{missingItemText(item)}</li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function ComfyCheckResult(props: { check: ComfyCheck; workflows: WorkflowInfo[] }) {
  const { check } = props
  if (check.outcome !== 'ok') return null
  const rows = check.workflows.flatMap((entry) => {
    const workflow = props.workflows.find((w) => w.id === entry.id)
    return workflow && workflow.status !== 'draft' ? [{ workflow, missing: entry.missing }] : []
  })
  if (rows.length === 0) return null
  return (
    <ul aria-label="Workflows" className={`${layout.list} ${styles.rows}`}>
      {rows.map((row) => (
        <WorkflowRow key={row.workflow.id} workflow={row.workflow} missing={row.missing} />
      ))}
    </ul>
  )
}
