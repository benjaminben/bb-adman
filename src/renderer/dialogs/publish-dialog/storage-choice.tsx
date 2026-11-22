// "To" (DLG-6b; spec/phases/phase-09.md "Screens"): one segment per storage publish.inspect
// lists, each a radio named by its label with a mark for whether it is set up. A storage that
// is not set up may be chosen, but nothing is read for it and Publish stays off (the dialog
// checks `ready`); a quiet "Settings" button then only goes to the Publish settings page. The
// labels come from the main process and are drawn as text.
import { useId } from 'react'
import { useApp } from '@/renderer/app/app-context'
import layout from '@/renderer/ui/layout.module.css'
import { StatusMark } from '@/renderer/ui/status-mark'
import { rememberPage } from '@/renderer/screens/settings/settings-screen/settings-pages'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'
import type { PublishInspect, PublishReady } from '@/shared/schemas/queries/publish'
import styles from './publish-dialog.module.css'

export type StorageChoiceProps = {
  storages: PublishInspect['storages']
  chosen: PublishStorageId | null
  disabled: boolean
  onChoose: (id: PublishStorageId) => void
  onClose: () => void
}

const NOT_READY: Record<Exclude<PublishReady, 'ready'>, string> = {
  not_set_up: 'Set up Amazon S3 in Settings.',
  needs_key: 'Add your Amazon S3 keys in Settings.',
  not_signed_in: 'Sign in to Dropbox in Settings.',
}

function ReadyMark(props: { id: string; ready: PublishReady }) {
  return (
    <span id={props.id} className={styles.mark}>
      {props.ready === 'ready' ? (
        <StatusMark tone="ok" icon="check" tip="Set up" />
      ) : (
        <StatusMark tone="warn" label="Not set" tip={NOT_READY[props.ready]} />
      )}
    </span>
  )
}

export function StorageChoice(props: StorageChoiceProps) {
  const name = useId()
  const show = useApp((s) => s.show)
  const chosen = props.storages.find((s) => s.id === props.chosen)

  function openSettings() {
    props.onClose()
    rememberPage('publish')
    show({ kind: 'settings' })
  }

  return (
    <fieldset className={styles.choices} disabled={props.disabled}>
      <legend>To</legend>
      <div className={styles.toRow}>
        <div className={styles.seg}>
          {props.storages.map((s) => {
            const id = `${name}-${s.id}`
            return (
              <div key={s.id} className={styles.choice}>
                <input
                  type="radio"
                  id={id}
                  name={name}
                  value={s.id}
                  checked={props.chosen === s.id}
                  aria-describedby={`${id}-mark`}
                  onChange={() => props.onChoose(s.id)}
                />
                <label htmlFor={id}>{s.label}</label>
                <ReadyMark id={`${id}-mark`} ready={s.ready} />
              </div>
            )
          })}
        </div>
        {chosen !== undefined && chosen.ready !== 'ready' && (
          <button
            type="button"
            className={`${layout.quiet} ${layout.small}`}
            onClick={openSettings}
          >
            Settings
          </button>
        )}
      </div>
    </fieldset>
  )
}
