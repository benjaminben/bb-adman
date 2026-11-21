// What comfy.check answered (SPEC 14 1.41 TP-3, 6.10.9). The version, the note, model and
// licence text are drawn as text only. No row is drawn for a draft workflow ([1.45] B-3).
// The sentences come from their owners (S2-1): checkMessage and missingItemText.
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { MissingItem } from '@/shared/schemas/queries/app'
import { checkMessage, fillMarks } from '@/shared/providers/messages'
import { missingItemText } from '@/renderer/ui/missing-item-text'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'
import styles from './comfy-check-result.module.css'

function WorkflowRow(props: { workflow: WorkflowInfo; missing: MissingItem[] }) {
  const { workflow, missing } = props
  const labelId = `comfy-workflow-${workflow.id}`
  const note = workflow.licence.commercialNote
  return (
    <li aria-labelledby={labelId}>
      <span id={labelId}>{workflow.label}</span>{' '}
      <span className={layout.muted}>{workflow.status}</span>
      {missing.length === 0 ? (
        <p>Complete</p>
      ) : (
        <>
          <p>{`Missing ${missing.length} item${missing.length === 1 ? '' : 's'}`}</p>
          <ul>
            {missing.map((item) => (
              <li key={`${item.what}:${item.folder ?? ''}:${item.name}`}>
                {missingItemText(item)}
              </li>
            ))}
          </ul>
        </>
      )}
      {note !== null && <p className={layout.muted}>{note}</p>}
    </li>
  )
}

export function ComfyCheckResult(props: {
  check: ComfyCheck
  address: string
  workflows: WorkflowInfo[]
}) {
  const { check, address } = props
  if (check.outcome !== 'ok') {
    return (
      <NoticeLine role="status" kind="danger">
        {fillMarks(checkMessage(check.outcome), { address })}
      </NoticeLine>
    )
  }

  const rows = check.workflows.flatMap((entry) => {
    const workflow = props.workflows.find((w) => w.id === entry.id)
    return workflow && workflow.status !== 'draft' ? [{ workflow, missing: entry.missing }] : []
  })

  return (
    <div role="status">
      <p>{`The server answered: ComfyUI ${check.version ?? ''}`}</p>
      {check.note !== undefined && <p className={layout.muted}>{check.note}</p>}
      {rows.length > 0 && (
        <ul aria-label="Workflows" className={`${layout.list} ${styles.rows}`}>
          {rows.map((row) => (
            <WorkflowRow key={row.workflow.id} workflow={row.workflow} missing={row.missing} />
          ))}
        </ul>
      )}
    </div>
  )
}
