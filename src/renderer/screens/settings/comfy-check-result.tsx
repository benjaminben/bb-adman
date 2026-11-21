// What comfy.check answered (SPEC 14 1.41 TP-3, 6.10.9). The version, the note, model and
// licence text are drawn as text only. No row is drawn for a draft workflow ([1.45] B-3).
import type { ComfyCheck, ComfyCheckOutcome } from '@/shared/schemas/commands/comfy-check'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { MissingItem } from '@/shared/schemas/queries/app'
import styles from '@/renderer/screens/screens.module.css'

// The sentences of SPEC 6.10.9 for each outcome other than 'ok'.
const SENTENCES: Record<Exclude<ComfyCheckOutcome, 'ok'>, (address: string) => string> = {
  no_answer: (a) =>
    `Nothing answered at ${a}. Check that ComfyUI is running and the address is right.`,
  not_comfyui: (a) => `Something answered at ${a}, but it is not a ComfyUI server.`,
  sign_in_needed: (a) =>
    `The server at ${a} asked for a sign-in. Adman can only use ComfyUI servers without one.`,
  redirect_refused: () =>
    'The server tried to send Adman to another address. Adman did not follow, and the run was stopped.',
  certificate: () => "Adman could not check the server's security certificate.",
  address_refused: () => 'Adman cannot use that address.',
}

const KINDS: Record<MissingItem['what'], string> = {
  model: 'Model',
  node: 'Node',
  version: 'ComfyUI version',
  add_on: 'Add-on',
}

function itemText(item: MissingItem): string {
  const folder = item.folder === undefined ? '' : `, in the folder ${item.folder}`
  return `${KINDS[item.what]} ${item.name}${folder}`
}

function WorkflowRow(props: { workflow: WorkflowInfo; missing: MissingItem[] }) {
  const { workflow, missing } = props
  const labelId = `comfy-workflow-${workflow.id}`
  const note = workflow.licence.commercialNote
  return (
    <li aria-labelledby={labelId}>
      <span id={labelId}>{workflow.label}</span>{' '}
      <span className={styles.muted}>{workflow.status}</span>
      {missing.length === 0 ? (
        <p>Complete</p>
      ) : (
        <>
          <p>{`Missing ${missing.length} item${missing.length === 1 ? '' : 's'}`}</p>
          <ul>
            {missing.map((item) => (
              <li key={`${item.what}:${item.folder ?? ''}:${item.name}`}>{itemText(item)}</li>
            ))}
          </ul>
        </>
      )}
      {note !== null && <p className={styles.muted}>{note}</p>}
    </li>
  )
}

export function ComfyCheckResult(props: {
  check: ComfyCheck
  address: string
  workflows: WorkflowInfo[]
}) {
  const { check, address } = props
  if (check.outcome !== 'ok') return <p role="status">{SENTENCES[check.outcome](address)}</p>

  const rows = check.workflows.flatMap((entry) => {
    const workflow = props.workflows.find((w) => w.id === entry.id)
    return workflow && workflow.status !== 'draft' ? [{ workflow, missing: entry.missing }] : []
  })

  return (
    <div role="status">
      <p>{`The server answered: ComfyUI ${check.version ?? ''}`}</p>
      {check.note !== undefined && <p className={styles.muted}>{check.note}</p>}
      {rows.length > 0 && (
        <ul aria-label="Workflows" className={styles.list}>
          {rows.map((row) => (
            <WorkflowRow key={row.workflow.id} workflow={row.workflow} missing={row.missing} />
          ))}
        </ul>
      )}
    </div>
  )
}
