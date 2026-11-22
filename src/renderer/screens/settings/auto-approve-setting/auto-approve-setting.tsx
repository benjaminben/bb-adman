// Settings, under Agent access: deletes without asking (P10-7; phase-10.md ask flow; SET-5). With
// it on, an agent's delete is allowed with no dialog. A Switch row with its InfoTip; under it,
// always on the page, the short warning, which describes the Switch. Saved with
// settings.update; a refusal shows as a line under it, as the other agent access controls do.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './auto-approve-setting.module.css'

const SWITCH_ID = 'auto-approve-switch'
const LINE_ID = 'auto-approve-line'
const REFUSAL_ID = 'auto-approve-refusal'

export function AutoApproveSetting() {
  const on = useApp((s) => s.app?.settings.mcp.autoApproveDestructive === true)
  const command = useApp((s) => s.command)
  const [refusal, setRefusal] = useState<string | null>(null)

  async function change() {
    const result = await command('settings.update', { mcp: { autoApproveDestructive: !on } })
    setRefusal(result.ok ? null : result.error.message)
  }

  return (
    <div className={styles.setting}>
      <div className={styles.row}>
        <label htmlFor={SWITCH_ID} className={styles.label}>
          Delete without asking
        </label>
        <InfoTip about="deleting without asking">
          An agent can then delete work with no click from you. Deletes cannot be undone, and
          deleting a variant clears its campaign&apos;s undo list.
        </InfoTip>
        <input
          id={SWITCH_ID}
          type="checkbox"
          role="switch"
          className={`${layout.switch} ${styles.switch}`}
          checked={on}
          aria-describedby={refusal === null ? LINE_ID : `${LINE_ID} ${REFUSAL_ID}`}
          onChange={() => void change()}
        />
      </div>
      <p id={LINE_ID} className={styles.warning}>
        <Icon name="alert" size="small" />
        Deletes cannot be undone.
      </p>
      {refusal !== null && (
        <NoticeLine kind="danger" id={REFUSAL_ID}>
          {refusal}
        </NoticeLine>
      )}
    </div>
  )
}
