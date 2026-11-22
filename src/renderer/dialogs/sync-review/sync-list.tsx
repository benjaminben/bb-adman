// The sync review's left pane (DLG-7): one ObjectRow per out-of-date variant, its thumbnail,
// "{size} · {language}" (the title in the row's tooltip and name) and one icon mark per kind of
// change, its words in the tooltip. Picking a row shows it on the right; it sends nothing. A
// variant whose translated text has not arrived has the warn mark "No {language}" and, with a
// paid provider and no run yet, "Translate", whose paid confirm draws under the row.
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { IconName } from '@/renderer/ui/icon'
import { languageName } from '@/renderer/ui/language-name'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { SyncGroup, SyncPreview } from '@/shared/schemas/queries/sync'
import { type PaidAsk, TranslateButton, TranslateConfirm } from './translate-ask'
import { groupWords } from './sync-words'
import styles from './sync-review.module.css'

const GROUP_ICONS: Record<SyncGroup, IconName> = {
  copy: 'text',
  style: 'sliders',
  geometry: 'box',
  source: 'image',
  timing: 'clock',
  animation: 'play',
}

export const variantName = (v: VariantSummary | undefined) =>
  v ? `${v.title} · ${v.sizeLabel} · ${v.language}` : 'A variant'

export const waitsForText = (preview: SyncPreview) =>
  preview.changes.some((c) => c.proposedTranslation?.status === 'failed')

function ChangeMarks(props: { preview: SyncPreview }) {
  const { changes } = props.preview
  const groups = [...new Set(changes.flatMap((c) => c.groups))]
  const added = changes.some((c) => c.kind === 'add-layer')
  const removed = changes.some((c) => c.kind === 'remove-layer')
  return (
    <>
      {groups.map((g) => (
        <StatusMark key={g} tone="none" icon={GROUP_ICONS[g]} tip={groupWords([g])} />
      ))}
      {added && <StatusMark tone="none" icon="plus" tip="new layer from the master" />}
      {removed && <StatusMark tone="none" icon="minus" tip="removed from the master" />}
    </>
  )
}

export type SyncRowState = {
  // The language's paid "Translate" is offered (no run yet), and its open confirm, if any.
  offer: boolean
  ask: PaidAsk | null
  untranslated: boolean
}

export type SyncListProps = {
  projectId: string
  variants: readonly SyncPreview[]
  summaries: readonly VariantSummary[]
  picked: string | undefined
  disabled: boolean
  stateOf: (preview: SyncPreview) => SyncRowState
  onPick: (variantId: string) => void
  onAsk: (variantId: string) => void
}

function SyncRow(props: SyncListProps & { preview: SyncPreview }) {
  const { preview } = props
  const v = props.summaries.find((s) => s.id === preview.variantId)
  const name = variantName(v)
  const state = props.stateOf(preview)
  const language = languageName(v?.language ?? '')
  return (
    <li aria-label={name}>
      <ObjectRow
        label={name}
        title={name}
        name={v ? `${v.sizeLabel} · ${v.language}` : name}
        thumb={
          v && <VariantThumbnail projectId={props.projectId} variantId={v.id} rev={v.rev} alt="" />
        }
        marks={
          <>
            {state.untranslated && (
              <StatusMark
                tone="warn"
                icon="alert"
                label={`No ${language}`}
                tip={`${language} has no translation yet.`}
              />
            )}
            <ChangeMarks preview={preview} />
          </>
        }
        stateActions={
          state.offer && !state.ask ? (
            <TranslateButton
              disabled={props.disabled}
              onAsk={() => props.onAsk(preview.variantId)}
            />
          ) : undefined
        }
        selected={props.picked === preview.variantId}
        mainProps={{ 'aria-current': props.picked === preview.variantId }}
        onSelect={() => props.onPick(preview.variantId)}
      />
      {state.offer && state.ask && (
        <div className={styles.rowConfirm}>
          <TranslateConfirm languageName={language} ask={state.ask} />
        </div>
      )}
    </li>
  )
}

export function SyncList(props: SyncListProps) {
  return (
    <ul aria-label="Out-of-date variants" className={styles.list}>
      {props.variants.map((preview) => (
        <SyncRow key={preview.variantId} {...props} preview={preview} />
      ))}
    </ul>
  )
}
