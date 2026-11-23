// CW-5 (spec/comfyui-custom.md, "Screens", the workflow picker): the select "Workflow", one
// option per fitting workflow by name, in comfy.getInfo order. A workflow an agent added says
// so in the option's own words, never only in a tooltip.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { optionWords } from './fitting'
import styles from './workflow-choice.module.css'

type Props = {
  workflows: WorkflowInfo[]
  value: string
  onChange: (id: string) => void
  disabled: boolean
}

export function WorkflowChoice(props: Props) {
  const id = useId()
  return (
    <div className={`${layout.field} ${layout.inline}`}>
      <label htmlFor={id}>Workflow</label>
      <select
        id={id}
        className={styles.select}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {props.workflows.map((w) => (
          <option key={w.id} value={w.id}>
            {optionWords(w)}
          </option>
        ))}
      </select>
    </div>
  )
}
