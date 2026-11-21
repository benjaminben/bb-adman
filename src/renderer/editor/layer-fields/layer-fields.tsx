// spec/editor.md, "Properties panel", "Layer": Name; "Visible" and "Locked"; "Bring forward",
// "Send backward", "Duplicate" and "Delete layer" (none of these four for the background). A
// locked layer's other fields are shown but disabled; Duplicate stays, as it changes nothing.
import { useId, useState, type KeyboardEvent } from 'react'
import { useDraft } from '@/renderer/editor/number-field'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './layer-fields.module.css'

export type LayerFieldsProps = {
  layer: LayerRow
  canForward: boolean
  canBackward: boolean
  onUpdate: (patch: LayerPatch) => Promise<string | null>
  onForward: () => void
  onBackward: () => void
  onDuplicate: () => void
  onDelete: () => void
}

function NameField(props: Pick<LayerFieldsProps, 'layer' | 'onUpdate'>) {
  const id = useId()
  const draft = useDraft(props.layer.name, (name) => props.onUpdate({ name }))
  const save = () => {
    const name = draft.text.trim()
    if (name === '') draft.reset()
    else void draft.save(name)
  }
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    save()
  }
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        Name
      </label>
      <input
        id={id}
        aria-describedby={draft.error ? `${id}-error` : undefined}
        disabled={props.layer.locked}
        value={draft.text}
        onChange={(event) => draft.setText(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={save}
      />
      {draft.error && (
        <p id={`${id}-error`} className={styles.error}>
          {draft.error}
        </p>
      )}
    </div>
  )
}

export function LayerFields(props: LayerFieldsProps) {
  const { layer } = props
  const [error, setError] = useState<string | null>(null)
  const toggle = async (patch: LayerPatch) => setError(await props.onUpdate(patch))
  const background = layer.type === 'background'

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Layer</legend>
      <NameField layer={layer} onUpdate={props.onUpdate} />
      <div className={styles.checks}>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={layer.visible}
            disabled={layer.locked}
            onChange={(event) => void toggle({ visible: event.target.checked })}
          />
          Visible
        </label>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={layer.locked}
            onChange={(event) => void toggle({ locked: event.target.checked })}
          />
          Locked
        </label>
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {!background && (
        <div className={styles.actions}>
          <button
            type="button"
            disabled={layer.locked || !props.canForward}
            onClick={props.onForward}
          >
            Bring forward
          </button>
          <button
            type="button"
            disabled={layer.locked || !props.canBackward}
            onClick={props.onBackward}
          >
            Send backward
          </button>
          <button type="button" onClick={props.onDuplicate}>
            Duplicate
          </button>
          <button type="button" disabled={layer.locked} onClick={props.onDelete}>
            Delete layer
          </button>
        </div>
      )}
    </fieldset>
  )
}
