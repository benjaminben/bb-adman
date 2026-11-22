// One provider in Agent runs (SET-5): an ObjectRow with the provider's name, a "Paid" mark when
// it is not local, and the Switch that lets agents start runs with it. The Switch is described
// by the page's one paid line (for a paid provider) and its own refusal line. The row's main
// button does nothing here, so it is kept out of the tab order and from assistive tech; the
// Switch is the one control, and turning it on is only ever its own click.
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark } from '@/renderer/ui/status-mark'
import layout from '@/renderer/ui/layout.module.css'
import { PAID_ID, describedBy } from './described-by'

type Props = {
  provider: ProviderInfo
  allowed: boolean
  refusal: string | null
  onChange: () => void
}

export function ProviderRow({ provider: p, allowed, refusal, onChange }: Props) {
  const refusalId = `agent-runs-refusal-${p.id}`
  const paid = !p.local
  const mark = paid ? (
    <StatusMark tone="warn" icon="coin" label="Paid" tip="Each run is charged to your account" />
  ) : undefined
  return (
    <div>
      <ObjectRow
        name={p.label}
        label={p.label}
        mainProps={{ tabIndex: -1, 'aria-hidden': true }}
        marks={mark}
        stateActions={
          <input
            type="checkbox"
            role="switch"
            className={layout.switch}
            aria-label={`Let agents start runs with ${p.label}`}
            checked={allowed}
            aria-describedby={describedBy(paid && PAID_ID, refusal !== null && refusalId)}
            onChange={onChange}
          />
        }
      />
      {refusal !== null && (
        <NoticeLine kind="danger" id={refusalId}>
          {refusal}
        </NoticeLine>
      )}
    </div>
  )
}
