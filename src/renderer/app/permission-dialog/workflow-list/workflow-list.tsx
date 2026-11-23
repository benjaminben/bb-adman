// The node types a workflow ask names (spec/comfyui-custom.md, "The agent's ask"; security
// rule 11): under the heading "Node types it uses", one per line, each drawn as text (never
// markup or a link) with hidden characters made visible, wrapping at any character. The box
// scrolls past about 8 lines and can take focus, so the keyboard scrolls it. While loading,
// and on failure, one line says so.
import { visiblePath } from '@/renderer/app/permission-dialog/file-list'
import type { AskWorkflow } from './use-ask-workflow'
import styles from './workflow-list.module.css'

const HEADING_ID = 'permission-node-types'

export function WorkflowList(props: { nodes: AskWorkflow }) {
  const { nodes } = props
  if (nodes.status === 'loading') {
    return <p className={styles.line}>Loading the list of node types…</p>
  }
  if (nodes.status === 'failed') {
    return (
      <p role="alert" className={styles.line}>
        The list of node types could not be shown, so this workflow cannot be added.
      </p>
    )
  }
  return (
    <>
      <h3 id={HEADING_ID} className={styles.heading}>
        Node types it uses
      </h3>
      <ul className={styles.list} aria-labelledby={HEADING_ID} tabIndex={0}>
        {nodes.nodeTypes.map((type, index) => (
          <li key={index} className={styles.item}>
            {visiblePath(type)}
          </li>
        ))}
      </ul>
    </>
  )
}
