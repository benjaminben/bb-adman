// "Publish to" (spec/phases/phase-09.md "Screens"): one radio per storage publish.inspect
// lists. A storage that is not ready is disabled with the line that says what to do in
// Settings. The labels come from the main process and are drawn as text.
import { useId } from 'react'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'
import type { PublishInspect, PublishReady } from '@/shared/schemas/queries/publish'
import styles from './publish-dialog.module.css'

export type StorageChoiceProps = {
  storages: PublishInspect['storages']
  chosen: PublishStorageId | null
  disabled: boolean
  onChoose: (id: PublishStorageId) => void
}

const NOT_READY: Record<Exclude<PublishReady, 'ready'>, string> = {
  not_set_up: 'Set up Amazon S3 in Settings.',
  needs_key: 'Add your Amazon S3 keys in Settings.',
  not_signed_in: 'Sign in to Dropbox in Settings.',
}

export function StorageChoice(props: StorageChoiceProps) {
  const name = useId()
  return (
    <fieldset className={styles.group}>
      <legend className={styles.heading}>Publish to</legend>
      {props.storages.map((s) => {
        const lineId = `${name}-${s.id}`
        return (
          <div key={s.id} className={styles.storage}>
            <label className={styles.choice}>
              <input
                type="radio"
                name={name}
                value={s.id}
                checked={props.chosen === s.id}
                disabled={props.disabled || s.ready !== 'ready'}
                aria-describedby={s.ready === 'ready' ? undefined : lineId}
                onChange={() => props.onChoose(s.id)}
              />
              {s.label}
            </label>
            {s.ready !== 'ready' && (
              <p id={lineId} className={styles.hint}>
                {NOT_READY[s.ready]}
              </p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
