// The dialog that asks the user to allow an agent's action (spec/phases/phase-10.md, ask flow,
// A-238 to A-240; P10-7). Refuse is focused first and Escape or a click outside refuses, so no
// key pressed by accident allows. The tick is sent only together with Allow. The client name
// and the target come from outside (an agent, a project file someone else made): both are drawn
// as text, never markup, and the name sits in its own tag so it cannot pass for the app's words.
// A refused answer shows its message; Close then ends the dialog with nothing more sent.
// Allow cannot be pressed for ALLOW_WAIT_MS after each ask is shown (the body is keyed by
// requestId, so a new ask waits again); it stays in the tab order with aria-disabled and a
// described reason. Refuse, Escape and the tick work at once.
// P10-7b: a fixed line says what allowing costs. It is chosen from the action, which the main
// process takes from the fixed policy table, so no text an agent writes can choose or change
// it; it is the last line of the body, above the buttons, and the dialog's description. The
// client name is labelled "Agent named", so a name such as "Adman" cannot pass for the app.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { useAsk, type Ask } from './use-ask'
import styles from './permission-dialog.module.css'

const ALLOW_WAIT_MS = 750
const WAIT_ID = 'permission-allow-wait'
const COST_ID = 'permission-cost'

const CAMPAIGN_COST = 'This cannot be undone.'
const COST: Record<string, string> = {
  'delete variants': 'This cannot be undone. It also clears the undo list of this campaign.',
  'delete campaigns': CAMPAIGN_COST,
}

// False until `ms` after the first draw.
function useReady(ms: number): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), ms)
    return () => clearTimeout(timer)
  }, [ms])
  return ready
}

// A stable callback ref: React calls it once, when the button mounts.
function focusOnMount(button: HTMLButtonElement | null) {
  button?.focus()
}

function AskDialog(props: { ask: Ask; onEnd: () => void }) {
  const api = useApi()
  const { ask } = props
  const [remember, setRemember] = useState(false)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const ready = useReady(ALLOW_WAIT_MS)

  async function answer(allow: boolean) {
    setSending(true)
    const input = { requestId: ask.requestId, allow, rememberAuto: allow && remember }
    const result = await api.command('agent.answerPermission', input)
    setSending(false)
    if (result.ok) props.onEnd()
    else setRefusal(result.error.message)
  }

  function close() {
    if (refusal === null) void answer(false)
    else props.onEnd()
  }

  const footer =
    refusal === null ? (
      <>
        <button type="button" autoFocus disabled={sending} onClick={() => void answer(false)}>
          Refuse
        </button>
        <button
          type="button"
          className={`${layout.danger} ${styles.allow}`}
          disabled={sending}
          aria-disabled={!ready || undefined}
          aria-describedby={ready ? undefined : WAIT_ID}
          onClick={() => ready && void answer(true)}
        >
          Allow
        </button>
        {!ready && (
          <span id={WAIT_ID} className={styles.hidden}>
            Allow can be pressed in a moment.
          </span>
        )}
      </>
    ) : (
      <button type="button" ref={focusOnMount} onClick={props.onEnd}>
        Close
      </button>
    )

  return (
    <DialogFrame
      open
      onClose={close}
      title="An agent asks to delete"
      describedBy={COST_ID}
      closable={!sending}
      footer={footer}
    >
      <p className={styles.line}>
        {ask.agentClient === null ? (
          'An agent'
        ) : (
          <>
            Agent named <span className={styles.client}>{ask.agentClient}</span>
          </>
        )}{' '}
        wants to {ask.action}: <span className={styles.target}>{ask.target}</span>.
      </p>
      {refusal === null ? (
        <>
          <p className={styles.line}>Answer within 2 minutes.</p>
          <label className={layout.row}>
            <input
              type="checkbox"
              checked={remember}
              disabled={sending}
              onChange={() => setRemember(!remember)}
            />
            Don&apos;t ask again for deletes
          </label>
        </>
      ) : (
        <p role="alert" className={`${layout.notice} ${layout.danger}`}>
          {refusal}
        </p>
      )}
      <p id={COST_ID} className={styles.cost}>
        {COST[ask.action] ?? CAMPAIGN_COST}
      </p>
    </DialogFrame>
  )
}

export function PermissionDialog() {
  const { ask, end } = useAsk()
  if (ask === null) return null
  return <AskDialog key={ask.requestId} ask={ask} onEnd={end} />
}
