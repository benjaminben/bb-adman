// Settings, under Agent access: deletes without asking (P10-7; phase-10.md ask flow). With it
// on, an agent's delete is allowed with no dialog. Saved with settings.update; a refusal shows
// as a line under the box, as the other agent access controls do.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'

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
    <div className={layout.field}>
      <label className={layout.row}>
        <input
          type="checkbox"
          checked={on}
          aria-describedby={refusal === null ? LINE_ID : `${LINE_ID} ${REFUSAL_ID}`}
          onChange={() => void change()}
        />
        Let agents delete campaigns and variants without asking
      </label>
      <p id={LINE_ID} className={layout.muted}>
        An agent can then delete work with no click from you. Deleting a campaign cannot be undone.
      </p>
      {refusal !== null && (
        <NoticeLine kind="danger" id={REFUSAL_ID}>
          {refusal}
        </NoticeLine>
      )}
    </div>
  )
}
