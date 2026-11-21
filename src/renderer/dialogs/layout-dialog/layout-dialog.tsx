// spec/editor.md "Top bar", "Layout…" (LK-6) [D-094]: the starter layouts as a group of
// choices, each with its name, description and a preview of the open variant with its updates
// merged in. The first is chosen when it opens. "Apply" sends one layer.updateMany built by
// starterLayoutPatches (spec/starter-layouts.md "Applying a layout"), so one undo step, and
// closes. A refusal shows in the dialog and it stays open. Cancel and Escape send nothing.
// It sends through window.api, not the app store, so a refusal is shown here only.
import { useId, useMemo, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { starterLayoutPatches } from '@/shared/templates/starter-layout-patches'
import { applyPatches } from './apply-patches'
import { LayoutPreview } from './layout-preview'
import styles from './layout-dialog.module.css'

export type LayoutDialogProps = {
  open: boolean
  projectId: string
  variant: VariantSummary
  layers: LayerRow[]
  assets: Readonly<Record<string, SceneAsset>>
  onClose: () => void
}

export const LOCKED_LINE = 'Locked layers stay as they are.'
export const NO_CHANGE_LINE = 'This layout changes no layer here.'

type BodyProps = LayoutDialogProps & { sending: boolean; setSending: (on: boolean) => void }

function LayoutBody(props: BodyProps) {
  const { variant, layers, sending } = props
  const api = useApi()
  const ids = useId()
  const [chosen, setChosen] = useState(STARTER_LAYOUTS[0].id)
  const [refusal, setRefusal] = useState<string | null>(null)
  const choices = useMemo(
    () =>
      STARTER_LAYOUTS.map((layout) => {
        const updates = starterLayoutPatches(layout, variant, layers)
        return { layout, updates, drawn: applyPatches(layers, updates) }
      }),
    [variant, layers],
  )
  const updates = choices.find((c) => c.layout.id === chosen)?.updates ?? []

  async function apply() {
    props.setSending(true)
    const input = { projectId: props.projectId, variantId: variant.id, updates }
    const reply = await api.command('layer.updateMany', input)
    props.setSending(false)
    if (reply.ok) return props.onClose()
    setRefusal(reply.error.message)
  }

  return (
    <div className={styles.body}>
      <div role="radiogroup" aria-label="Layouts" className={styles.choices}>
        {choices.map(({ layout, drawn }) => (
          <div key={layout.id} className={styles.choice}>
            <LayoutPreview variant={variant} layers={drawn} assets={props.assets} />
            <label className={styles.name}>
              <input
                type="radio"
                name={`${ids}-layout`}
                value={layout.id}
                checked={chosen === layout.id}
                aria-describedby={`${ids}-${layout.id}`}
                onChange={() => setChosen(layout.id)}
              />
              {layout.name}
            </label>
            <p id={`${ids}-${layout.id}`} className={styles.muted}>
              {layout.description}
            </p>
          </div>
        ))}
      </div>
      <p className={styles.muted}>{LOCKED_LINE}</p>
      {updates.length === 0 && <p>{NO_CHANGE_LINE}</p>}
      {refusal !== null && (
        <p role="alert" className={styles.alert}>
          {refusal}
        </p>
      )}
      <div className={styles.actions}>
        <button type="button" disabled={sending} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          disabled={sending || updates.length === 0}
          onClick={() => void apply()}
        >
          Apply
        </button>
      </div>
    </div>
  )
}

export function LayoutDialog(props: LayoutDialogProps) {
  const [sending, setSending] = useState(false)
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title="Choose a layout"
      closable={!sending}
    >
      {props.open && <LayoutBody {...props} sending={sending} setSending={setSending} />}
    </DialogFrame>
  )
}
