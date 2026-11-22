// The dialog that asks the user to allow an agent's action (spec/phases/phase-10.md, ask flow,
// A-238 to A-240; P10-7). Refuse is focused first and Escape or a click outside refuses, so no
// key pressed by accident allows. The tick is sent only together with Allow. The client name
// and the target come from outside (an agent, a project file someone else made): both are drawn
// as text, never markup, and the name sits in its own tag so it cannot pass for the app's words.
// A refused answer shows its message; Close then ends the dialog with nothing more sent.
import { useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { useAsk, type Ask } from './use-ask'
import styles from './permission-dialog.module.css'

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
          className={layout.danger}
          disabled={sending}
          onClick={() => void answer(true)}
        >
          Allow
        </button>
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
      closable={!sending}
      footer={footer}
    >
      <p className={styles.line}>
        {ask.agentClient === null ? (
          'An agent'
        ) : (
          <span className={styles.client}>{ask.agentClient}</span>
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
    </DialogFrame>
  )
}

export function PermissionDialog() {
  const { ask, end } = useAsk()
  if (ask === null) return null
  return <AskDialog key={ask.requestId} ask={ask} onEnd={end} />
}
