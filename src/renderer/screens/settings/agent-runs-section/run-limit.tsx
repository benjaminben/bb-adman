// The agent run limit (spec/agent-runs.md, "Settings block"; SET-5): an inline number field with
// "per provider" inside it after the number and an InfoTip, saving on each change as before.
import { AGENT_RUN_LIMIT_MAX, AGENT_RUN_LIMIT_MIN } from '@/shared/config/agent-runs'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { describedBy } from './described-by'
import styles from './agent-runs-section.module.css'

type Props = {
  id: string
  value: string
  refusal: string | null
  onChange: (text: string) => void
}

export function RunLimit(props: Props) {
  const refusalId = `${props.id}-refusal`
  return (
    <div className={styles.limit}>
      <div className={`${layout.field} ${layout.inline}`}>
        <span className={styles.label}>
          <label htmlFor={props.id}>Run limit</label>
          <InfoTip about="run limit">
            The most runs agents may have waiting or running, for each provider.
          </InfoTip>
        </span>
        <span className={`${layout.unitBox} ${styles.box}`}>
          <input
            id={props.id}
            type="number"
            min={AGENT_RUN_LIMIT_MIN}
            max={AGENT_RUN_LIMIT_MAX}
            step={1}
            value={props.value}
            onChange={(e) => props.onChange(e.target.value)}
            aria-describedby={describedBy(props.refusal !== null && refusalId)}
          />
          <span className={layout.unit}>per provider</span>
        </span>
      </div>
      {props.refusal !== null && (
        <NoticeLine kind="danger" id={refusalId}>
          {props.refusal}
        </NoticeLine>
      )}
    </div>
  )
}
