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
// R2P-6 (spec/phases/round-2-platform.md, D7): an import ask shows the full paths from
// agent.askFiles and has no tick. Its allow button waits ALLOW_WAIT_MS from the moment the
// whole list is shown, and is not offered at all when the list cannot be read.
import { useEffect, useState } from 'react'
import { useApi } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { askWords } from './ask-words'
import { FileList, useAskFiles } from './file-list'
import { useAsk, type Ask } from './use-ask'
import styles from './permission-dialog.module.css'

const ALLOW_WAIT_MS = 750
const WAIT_ID = 'permission-allow-wait'
const COST_ID = 'permission-cost'
const LINE_ID = 'permission-line'

const CAMPAIGN_COST = 'This cannot be undone.'
const COST: Record<string, string> = {
  'delete variants': 'This cannot be undone. It also clears the undo list of this campaign.',
  'delete campaigns': CAMPAIGN_COST,
}

// False until `ms` after `start` first turns true.
function useReady(ms: number, start: boolean): boolean {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!start) return
    const timer = setTimeout(() => setReady(true), ms)
    return () => clearTimeout(timer)
  }, [ms, start])
  return ready
}

// A stable callback ref: React calls it once, when the button mounts.
function focusOnMount(button: HTMLButtonElement | null) {
  button?.focus()
}

function AskLine(props: { ask: Ask }) {
  const { ask } = props
  return (
    <p id={LINE_ID} className={styles.line}>
      {ask.agentClient === null ? (
        'An agent'
      ) : (
        <>
          Agent named <span className={styles.client}>{ask.agentClient}</span>
        </>
      )}{' '}
      wants to {ask.action}: <span className={styles.target}>{ask.target}</span>.
    </p>
  )
}

function AskDialog(props: { ask: Ask; onEnd: () => void }) {
  const api = useApi()
  const { ask } = props
  const isImport = ask.kind === 'import'
  const words = askWords(ask)
  const files = useAskFiles(ask.requestId, ask.fileCount, isImport)
  const [remember, setRemember] = useState(false)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const ready = useReady(ALLOW_WAIT_MS, !isImport || files.status === 'shown')
  const canAllow = !isImport || files.status !== 'failed'

  async function answer(allow: boolean) {
    setSending(true)
    const rememberAuto = allow && remember && !isImport
    const result = await api.command('agent.answerPermission', {
      requestId: ask.requestId,
      allow,
      rememberAuto,
    })
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
        {canAllow && (
          <button
            type="button"
            className={`${layout.danger} ${styles.allow}`}
            disabled={sending}
            aria-disabled={!ready || undefined}
            aria-describedby={ready ? undefined : WAIT_ID}
            onClick={() => ready && void answer(true)}
          >
            {words.allow}
          </button>
        )}
        {canAllow && !ready && (
          <span id={WAIT_ID} className={styles.hidden}>
            {words.allow} can be pressed in a moment.
          </span>
        )}
      </>
    ) : (
      <button type="button" ref={focusOnMount} onClick={props.onEnd}>
        Close
      </button>
    )

  const notice =
    refusal === null ? null : (
      <p role="alert" className={`${layout.notice} ${layout.danger}`}>
        {refusal}
      </p>
    )

  return (
    <DialogFrame
      open
      onClose={close}
      title={words.title}
      describedBy={isImport ? LINE_ID : COST_ID}
      closable={!sending}
      footer={footer}
    >
      <AskLine ask={ask} />
      {isImport ? (
        <>
          <FileList files={files} />
          {notice}
        </>
      ) : (
        <>
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
            notice
          )}
          <p id={COST_ID} className={styles.cost}>
            {COST[ask.action] ?? CAMPAIGN_COST}
          </p>
        </>
      )}
    </DialogFrame>
  )
}

export function PermissionDialog() {
  const { ask, end } = useAsk()
  if (ask === null) return null
  return <AskDialog key={ask.requestId} ask={ask} onEnd={end} />
}
