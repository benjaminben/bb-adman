// One added ComfyUI workflow in Settings (spec/comfyui-custom.md "Screens", D-104): an
// ObjectRow with the name, the line of words under it, "Change" and a trash icon named
// "Remove {name}". The row's main button does nothing, so it is kept out of the tab order and
// from assistive tech; the two buttons are the row's controls and only open dialogs.
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { Icon } from '@/renderer/ui/icon'
import { ObjectRow } from '@/renderer/ui/object-row'
import layout from '@/renderer/ui/layout.module.css'
import { rowWords } from './row-words'
import styles from './comfy-workflow-row.module.css'

type Props = { workflow: WorkflowInfo; onChange: () => void; onRemove: () => void }

export function ComfyWorkflowRow({ workflow: w, onChange, onRemove }: Props) {
  const remove = `Remove ${w.label}`
  return (
    <li className={styles.item}>
      <ObjectRow
        name={w.label}
        label={w.label}
        thumb={<Icon name={w.job === 'video' ? 'film' : 'image'} />}
        meta={rowWords(w)}
        mainProps={{ tabIndex: -1, 'aria-hidden': true }}
        stateActions={
          <span className={styles.buttons}>
            <button
              type="button"
              className={`${layout.secondary} ${layout.small}`}
              onClick={onChange}
            >
              Change
            </button>
            <button
              type="button"
              className={layout.iconButton}
              aria-label={remove}
              title={remove}
              onClick={onRemove}
            >
              <Icon name="trash" />
            </button>
          </span>
        }
      />
    </li>
  )
}
