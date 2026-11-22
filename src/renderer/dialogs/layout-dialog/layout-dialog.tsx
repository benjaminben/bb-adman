// spec/editor.md "Top bar", "Layout…" (LK-6) [D-094]: the starter layouts as a group of
// choices, each with its name, description and a preview of the open variant with its updates
// merged in. The first is chosen when it opens. "Apply" sends one layer.updateMany built by
// starterLayoutPatches (spec/starter-layouts.md "Applying a layout"), so one undo step, and
// closes. A refusal shows in the dialog and it stays open. Cancel and Escape send nothing.
// It sends through window.api, not the app store, so a refusal is shown here only.
// DLG-5 (C-16): the `pick` kind. The previews are a pickGrid of tiles with no caption: each
// radio is named by the layout's name and described by its description, and the tile's
// `title` holds both. The locked-layers line is in an InfoTip; a lock mark counts the locked
// layers. Choosing a tile sends nothing; only Apply sends.
import { useId, useMemo, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFoot, DialogFrame, dialogStyles } from '@/renderer/ui/dialog-frame'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import { DEFAULT_STARTER_LAYOUT_ID, STARTER_LAYOUTS } from '@/shared/config/starter-layouts'
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
const KEPT_TIP = 'Locked layers stay as they are'

type BodyProps = LayoutDialogProps & { sending: boolean; setSending: (on: boolean) => void }

function LayoutBody(props: BodyProps) {
  const { variant, layers, sending } = props
  const api = useApi()
  const ids = useId()
  const [chosen, setChosen] = useState(STARTER_LAYOUTS[0]?.id ?? DEFAULT_STARTER_LAYOUT_ID)
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
  const kept = layers.filter((l) => l.locked).length

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
      <div className={styles.top}>
        <InfoTip about="Layout">{LOCKED_LINE}</InfoTip>
        {kept > 0 && <StatusMark tone="none" icon="lock" label={`${kept} kept`} tip={KEPT_TIP} />}
      </div>
      <div
        role="radiogroup"
        aria-label="Layouts"
        className={`${dialogStyles.pickGrid} ${styles.choices}`}
      >
        {choices.map(({ layout, drawn }) => (
          <label
            key={layout.id}
            className={styles.choice}
            title={`${layout.name}. ${layout.description}`}
          >
            <input
              type="radio"
              className={styles.hidden}
              name={`${ids}-layout`}
              value={layout.id}
              checked={chosen === layout.id}
              aria-label={layout.name}
              aria-describedby={`${ids}-${layout.id}`}
              onChange={() => setChosen(layout.id)}
            />
            <LayoutPreview variant={variant} layers={drawn} assets={props.assets} />
            <span id={`${ids}-${layout.id}`} className={styles.hidden}>
              {layout.description}
            </span>
          </label>
        ))}
      </div>
      {updates.length === 0 && <p>{NO_CHANGE_LINE}</p>}
      {refusal !== null && (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          <Icon name="alert" />
          {refusal}
        </p>
      )}
      <DialogFoot>
        <button type="button" disabled={sending} onClick={props.onClose}>
          Cancel
        </button>
        <button
          type="button"
          className={layout.primary}
          disabled={sending || updates.length === 0}
          onClick={() => void apply()}
        >
          Apply
        </button>
      </DialogFoot>
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
      kind="pick"
      closable={!sending}
    >
      {props.open && <LayoutBody {...props} sending={sending} setSending={setSending} />}
    </DialogFrame>
  )
}
