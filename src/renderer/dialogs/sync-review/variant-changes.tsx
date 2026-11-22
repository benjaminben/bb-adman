// The sync review's right pane (DLG-7; spec/screens-variants.md, "Sync review"): the picked
// variant as a group named "{title} · {sizeLabel} · {language}", one checkbox per change
// (starting unticked, A-138; named "{layer}: {change words}", the words drawn quieter). Under
// a change: the variant's own text beside the master's new text, its translation line
// (P6-16), then each blocked path's "Mine" | "Master". Ticks and choices live in the
// dialog, so picking another variant loses none. Every name is drawn as text.
import { useId } from 'react'
import { languageName } from '@/renderer/ui/language-name'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import type { SyncChange, SyncPreview } from '@/shared/schemas/queries/sync'
import { changeKey, choiceKey, type Choice, type Choices } from './decisions'
import { OverrideChoice } from './override-choice'
import type { PaidAsk } from './translate-ask'
import { TranslationLine } from './translation-line'
import type { LanguageRun } from './use-sync-translations'
import { variantName } from './sync-list'
import { groupWords } from './sync-words'
import { useOwnCopy } from './use-own-copy'
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

function Compare(props: { own: string | undefined; master: string }) {
  return (
    <dl className={styles.compare}>
      {props.own !== undefined && (
        <div>
          <dt>Mine</dt>
          <dd>{props.own}</dd>
        </div>
      )}
      <div>
        <dt>Master</dt>
        <dd>{props.master}</dd>
      </div>
    </dl>
  )
}

function ChangeItem(props: VariantChangesProps & { change: SyncChange; own: string | undefined }) {
  const { change, preview } = props
  const key = changeKey(preview.variantId, change.layerKey)
  const copy = change.kind === 'update' ? change.proposed.copy : undefined
  const words = changeWords(change)
  return (
    <li className={styles.change}>
      <label className={styles.option}>
        <input
          type="checkbox"
          aria-label={`${change.layerName}: ${words}`}
          checked={props.ticked.has(key)}
          disabled={props.disabled}
          onChange={(e) => props.onTick(key, e.target.checked)}
        />
        <span className={styles.layerName}>{change.layerName}</span>
        <span className={styles.words}>{words}</span>
      </label>
      {typeof copy === 'string' && <Compare own={props.own} master={copy} />}
      {change.proposedTranslation && (
        <TranslationLine
          proposed={change.proposedTranslation}
          languageName={languageName(props.variant?.language ?? '')}
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
  const own = useOwnCopy(props.projectId, props.preview.variantId)
  return (
    <div role="group" aria-labelledby={headingId} className={styles.variant}>
      <h3 id={headingId} className={styles.heading}>
        {variantName(props.variant)}
      </h3>
      <ul className={styles.changes}>
        {props.preview.changes.map((change) => (
          <ChangeItem
            key={change.layerKey}
            {...props}
            change={change}
            own={own.get(change.layerKey)}
          />
        ))}
      </ul>
    </div>
  )
}
