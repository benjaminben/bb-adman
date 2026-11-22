// A paid text provider in the sync review (P6-18; spec/screens.md, "Paid confirm line"). DLG-7:
// a variant row whose language has no translation and no run carries "Translate"; it shows the
// shared paid confirm with 1 paid request under the row (translation.propose with a direction
// and a language starts one job). Only its "Confirm" starts the run; nothing is sent before it.
import { PaidConfirm } from '@/renderer/ui/paid-confirm'
import layout from '@/renderer/ui/layout.module.css'

// One translation job, so one paid request, per direction and language.
export const SYNC_REQUESTS = 1

export type PaidAsk = { label: string; onConfirm: () => void; onCancel: () => void }

export function TranslateButton(props: { disabled: boolean; onAsk: () => void }) {
  return (
    <button type="button" className={layout.small} disabled={props.disabled} onClick={props.onAsk}>
      Translate
    </button>
  )
}

export function TranslateConfirm(props: { languageName: string; ask: PaidAsk }) {
  return (
    <div role="group" aria-label={`${props.languageName} translation`}>
      <PaidConfirm
        count={SYNC_REQUESTS}
        providerLabel={props.ask.label}
        onConfirm={props.ask.onConfirm}
        onCancel={props.ask.onCancel}
      />
    </div>
  )
}
