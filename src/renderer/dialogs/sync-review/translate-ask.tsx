// A paid text provider in the sync review (P6-18; spec/screens.md, "Paid confirm line"): one
// line per language whose changes have no translation and no run, "{Language} has no
// translation yet." with "Translate". "Translate" shows the shared paid confirm with 1 paid
// request: translation.propose with a direction and a language starts one job. Only its
// "Confirm" starts the run; nothing is sent before it.
import { languageName } from '@/renderer/screens/campaign/translation-panel/translation-words'
import { PaidConfirm } from '@/renderer/screens/campaign/paid-confirm'
import layout from '@/renderer/ui/layout.module.css'
import styles from './sync-review.module.css'

// One translation job, so one paid request, per direction and language.
export const SYNC_REQUESTS = 1

export type PaidAsk = { label: string; onConfirm: () => void; onCancel: () => void }

export function TranslateAsk(props: {
  language: string
  ask: PaidAsk | null // the open confirm, or null for the "Translate" line
  disabled: boolean
  onAsk: () => void
}) {
  const name = languageName(props.language)
  return (
    <div role="group" aria-label={`${name} translation`}>
      {props.ask ? (
        <PaidConfirm
          count={SYNC_REQUESTS}
          providerLabel={props.ask.label}
          onConfirm={props.ask.onConfirm}
          onCancel={props.ask.onCancel}
        />
      ) : (
        <div className={styles.failure}>
          <p>{`${name} has no translation yet.`}</p>
          <button
            type="button"
            className={layout.small}
            disabled={props.disabled}
            onClick={props.onAsk}
          >
            Translate
          </button>
        </div>
      )}
    </div>
  )
}
