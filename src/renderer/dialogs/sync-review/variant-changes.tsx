// spec/screens-variants.md, "Sync review": one variant's group, headed "{title} · {sizeLabel} ·
// {language}" with its thumbnail, and one checkbox per change, starting unticked (A-138). Under
// a change: its new text or its translation line (P6-16), then each blocked path's choice.
// Every name here comes from the project file and is drawn as text.
import { useId } from 'react'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { SyncChange, SyncPreview } from '@/shared/schemas/queries/sync'
import { changeKey, choiceKey, type Choice, type Choices } from './decisions'
import { OverrideChoice } from './override-choice'
import type { PaidAsk } from './translate-ask'
import { TranslationLine } from './translation-line'
import type { LanguageRun } from './use-sync-translations'
import { groupWords } from './sync-words'
import styles from './sync-review.module.css'

export type VariantChangesProps = {
  projectId: string
  variant: VariantSummary | undefined
  preview: SyncPreview
  ticked: ReadonlySet<string>
  choices: Choices
  disabled: boolean
  onTick: (key: string, on: boolean) => void
  onChoose: (key: string, choice: Choice) => void
  // P6-16: this variant's language's sync translation, and its two actions.
  run: LanguageRun | undefined
  ask: PaidAsk | null // P6-18: the language's open paid confirm
  onRetry: () => void
  onType: (layerKey: string, text: string) => Promise<string | null>
}

function changeWords(change: SyncChange): string {
  if (change.kind === 'add-layer') return 'new layer from the master'
  if (change.kind === 'remove-layer') return 'removed from the master'
  return groupWords(change.groups)
}

function headingOf(v: VariantSummary | undefined): string {
  return v ? `${v.title} · ${v.sizeLabel} · ${v.language}` : 'A variant'
}

function ChangeItem(props: VariantChangesProps & { change: SyncChange }) {
  const { change, preview } = props
  const key = changeKey(preview.variantId, change.layerKey)
  const copy = change.kind === 'update' ? change.proposed.copy : undefined
  return (
    <li className={styles.change}>
      <label className={styles.option}>
        <input
          type="checkbox"
          checked={props.ticked.has(key)}
          disabled={props.disabled}
          onChange={(e) => props.onTick(key, e.target.checked)}
        />
        {change.layerName}: {changeWords(change)}
      </label>
      {typeof copy === 'string' && <p className={styles.detail}>New text: {copy}</p>}
      {change.proposedTranslation && (
        <TranslationLine
          proposed={change.proposedTranslation}
          run={props.run}
          disabled={props.disabled}
          ask={props.ask}
          onRetry={props.onRetry}
          onType={(text) => props.onType(change.layerKey, text)}
        />
      )}
      {change.blockedByOverride.map((path) => {
        const at = choiceKey(preview.variantId, change.layerKey, path)
        return (
          <OverrideChoice
            key={path}
            path={path}
            choice={props.choices[at] ?? 'keep-mine'}
            disabled={props.disabled}
            onChoose={(choice) => props.onChoose(at, choice)}
          />
        )
      })}
    </li>
  )
}

export function VariantChanges(props: VariantChangesProps) {
  const headingId = useId()
  const v = props.variant
  return (
    <div role="group" aria-labelledby={headingId} className={styles.variant}>
      <div className={styles.head}>
        {v && (
          <span className={styles.thumb}>
            <VariantThumbnail projectId={props.projectId} variantId={v.id} rev={v.rev} alt="" />
          </span>
        )}
        <h3 id={headingId} className={styles.heading}>
          {headingOf(v)}
        </h3>
      </div>
      <ul className={styles.changes}>
        {props.preview.changes.map((change) => (
          <ChangeItem key={change.layerKey} {...props} change={change} />
        ))}
      </ul>
    </div>
  )
}
