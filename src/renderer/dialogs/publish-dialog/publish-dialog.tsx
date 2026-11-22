// "Publish {campaign name}" [P9-12] (spec/phases/phase-09.md "Screens", "Publishing"; DLG-6b).
// The first view (publish-choose.tsx): where to publish, what is published there, the prompt
// line, every file that will leave this computer (by name and kind, no path), the font ticks
// (A-260) and Publish. The full prompt sentence is the dialog's description. Nothing is sent
// but publish.inspect until the user presses Publish, which sends publish.run once, with
// replaceConfirmed only from the user's own "Replace" switch; a storage that is not set up
// cannot be published to. While it waits every control is disabled and the dialog cannot close.
// A refusal shows its sentence and the first view stays (`refusal` keeps the whole error). A
// publish_has_warnings refusal opens the warnings step [P9-13]: "Publish anyway" sends the same
// input again with proceedDespiteWarnings and the user's own reason, the switch as the user
// gave it. It is armed 500 ms after the step opens (lows C). "Back" reads publish.inspect
// again. After the start, the "Publishing" bar.
import { useId, useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import type { PublishRunInput, PublishStorageId } from '@/shared/schemas/commands/publish'
import type { ErrorBody } from '@/shared/schemas/result'
import { PROMPT_LINE, PublishChoose } from './publish-choose'
import { PublishStarted } from './publish-started'
import { PublishWarnings, warningsOf, type PublishWarningLine } from './publish-warnings'
import { useArmed } from './use-armed'
import { usePublishInspect } from './use-publish-inspect'
import { jobIdOf, usePublishJob } from './use-publish-job'
import styles from './publish-dialog.module.css'

export type PublishDialogProps = {
  projectId: string
  campaignId: string
  campaignName: string
  onClose: () => void
}

function Refusal(props: { refusal: ErrorBody | null }) {
  if (props.refusal === null) return null
  return (
    <p role="alert" className={`${layout.notice} ${layout.danger}`}>
      {props.refusal.message}
    </p>
  )
}

export function PublishDialog(props: PublishDialogProps) {
  const { projectId, campaignId } = props
  const command = useApp((s) => s.command)
  const clearError = useApp((s) => s.clearError)
  const inspect = usePublishInspect(projectId, campaignId)
  const { reply, existing, storage } = inspect
  const { job, follow } = usePublishJob()
  const promptId = useId()
  const [replaceOn, setReplaceOn] = useState(false)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<ErrorBody | null>(null)
  const [warnings, setWarnings] = useState<PublishWarningLine[] | null>(null)
  const [reason, setReason] = useState('')
  // The input the last "Publish" sent; "Publish anyway" sends it again.
  const [held, setHeld] = useState<PublishRunInput | null>(null)
  const armed = useArmed(warnings)

  const readyOf = (id: PublishStorageId | null) =>
    reply?.storages.some((s) => s.id === id && s.ready === 'ready') === true
  const ready = readyOf(storage)
  const hasFiles = existing !== null && existing.files > 0
  const canPublish = ready && existing !== null && (!hasFiles || replaceOn) && !sending

  function choose(id: PublishStorageId) {
    setReplaceOn(false)
    setRefusal(null)
    inspect.choose(id, readyOf(id))
  }

  // Every read of the folder, of the same storage too, asks for the switch anew.
  function readAgain() {
    setReplaceOn(false)
    inspect.again()
  }

  async function send(input: PublishRunInput) {
    setSending(true)
    setRefusal(null)
    const sent = await command('publish.run', input)
    setSending(false)
    if (sent.ok) return follow(jobIdOf(sent))
    const listed = input.proceedDespiteWarnings ? null : warningsOf(sent.error)
    if (listed === null) return setRefusal(sent.error)
    // The step shows the warnings, so they leave the error banner, as in the export dialog.
    clearError()
    setHeld(input)
    setReason('')
    setWarnings(listed)
  }

  function publish() {
    if (!canPublish || storage === null) return
    const replaceConfirmed = hasFiles && replaceOn
    const input = { projectId, campaignId, storage, replaceConfirmed }
    void send({ ...input, proceedDespiteWarnings: false })
  }

  function publishAnyway() {
    if (held === null || !armed) return
    const trimmed = reason.trim()
    const extra = trimmed === '' ? {} : { proceedReason: trimmed }
    void send({ ...held, proceedDespiteWarnings: true, ...extra })
  }

  function back() {
    setWarnings(null)
    setRefusal(null)
    readAgain()
  }

  const footer =
    job !== null ? (
      job.kind === 'ended' && (
        <button type="button" className={layout.primary} onClick={props.onClose}>
          Close
        </button>
      )
    ) : warnings !== null ? (
      <>
        <button type="button" disabled={sending} onClick={back}>
          Back
        </button>
        <button
          type="button"
          className={layout.primary}
          disabled={sending || !armed}
          onClick={publishAnyway}
        >
          Publish anyway
        </button>
      </>
    ) : (
      <>
        <button type="button" disabled={sending} onClick={props.onClose}>
          Cancel
        </button>
        <button type="button" className={layout.primary} disabled={!canPublish} onClick={publish}>
          Publish
        </button>
      </>
    )

  return (
    <DialogFrame
      open
      onClose={props.onClose}
      title={`Publish ${props.campaignName}`}
      describedBy={promptId}
      closable={!sending}
      footer={footer}
      kind="publish"
    >
      <span id={promptId} className={styles.hidden}>
        {PROMPT_LINE}
      </span>
      {job !== null ? (
        <PublishStarted job={job} onClose={props.onClose} />
      ) : warnings !== null ? (
        <div className={styles.body}>
          <PublishWarnings
            projectId={projectId}
            campaignId={campaignId}
            warnings={warnings}
            reason={reason}
            disabled={sending}
            onReason={setReason}
          />
          <Refusal refusal={refusal} />
        </div>
      ) : (
        <div className={styles.body}>
          {reply === null && inspect.looking && <p className={layout.muted}>Loading…</p>}
          {inspect.failure !== null && (
            <div role="alert" className={`${layout.notice} ${layout.danger}`}>
              {inspect.failure}
              <button type="button" onClick={readAgain}>
                Retry
              </button>
            </div>
          )}
          {reply !== null && (
            <PublishChoose
              projectId={projectId}
              reply={reply}
              storage={storage}
              looking={inspect.looking}
              existing={existing}
              replaceOn={replaceOn}
              sending={sending}
              onChoose={choose}
              onReplace={setReplaceOn}
              onFontsChanged={readAgain}
              onClose={props.onClose}
            />
          )}
          <Refusal refusal={refusal} />
        </div>
      )}
    </DialogFrame>
  )
}
