// "Publish {campaign name}" [P9-12] (spec/phases/phase-09.md "Screens", "Publishing"). The
// first view: where to publish, what is published there, the prompt line, every file that will
// leave this computer with its full local path (A-218), the font ticks (A-260) and Publish.
// Nothing is sent but publish.inspect until the user presses Publish, which sends publish.run
// once, with replaceConfirmed only from the user's own tick. While it waits every control is
// disabled and the dialog cannot close. A refusal shows its sentence and the first view stays
// (`refusal` keeps the whole error). A publish_has_warnings refusal opens the warnings step
// [P9-13]: "Publish anyway" sends the same input again with proceedDespiteWarnings and the
// user's own reason, the replace tick as the user gave it; "Back" sends nothing. After the
// start, the started view.
import { useState } from 'react'
import { useApp } from '@/renderer/app/app-context'
import { DialogFrame } from '@/renderer/ui/dialog-frame'
import { FontShareChoice } from '@/renderer/ui/font-share-choice'
import layout from '@/renderer/ui/layout.module.css'
import { PublishFileList } from '@/renderer/ui/publish-file-list'
import type { PublishRunInput, PublishStorageId } from '@/shared/schemas/commands/publish'
import type { ErrorBody } from '@/shared/schemas/result'
import { PublishWarnings, warningsOf, type PublishWarningLine } from './publish-warnings'
import { ReplaceWarning } from './replace-warning'
import { StorageChoice } from './storage-choice'
import { usePublishInspect } from './use-publish-inspect'
import styles from './publish-dialog.module.css'

export type PublishDialogProps = {
  projectId: string
  campaignId: string
  campaignName: string
  onClose: () => void
}

const PROMPT_LINE =
  'Generated images and videos carry the prompt that made them. Anyone with these files can read it.'
const ALSO_LINE =
  'Also uploaded: the exported ads, the report, the translation sheet and a list of the files.'
const STARTED =
  'Publishing has started. You can close this window and follow it in the activity list.'

export function PublishDialog(props: PublishDialogProps) {
  const { projectId, campaignId } = props
  const command = useApp((s) => s.command)
  const inspect = usePublishInspect(projectId, campaignId)
  const { reply, existing, storage } = inspect
  const [replaceTicked, setReplaceTicked] = useState(false)
  const [sending, setSending] = useState(false)
  const [refusal, setRefusal] = useState<ErrorBody | null>(null)
  const [started, setStarted] = useState(false)
  const [warnings, setWarnings] = useState<PublishWarningLine[] | null>(null)
  const [reason, setReason] = useState('')
  // The input the last "Publish" sent; "Publish anyway" sends it again.
  const [held, setHeld] = useState<PublishRunInput | null>(null)

  const ready = reply?.storages.some((s) => s.id === storage && s.ready === 'ready') === true
  const hasFiles = existing !== null && existing.files > 0
  const canPublish = ready && existing !== null && (!hasFiles || replaceTicked) && !sending

  function choose(id: PublishStorageId) {
    setReplaceTicked(false)
    setRefusal(null)
    inspect.choose(id)
  }

  // Every read of the folder, of the same storage too, asks for the replace tick anew.
  function readAgain() {
    setReplaceTicked(false)
    inspect.again()
  }

  async function send(input: PublishRunInput) {
    setSending(true)
    setRefusal(null)
    const sent = await command('publish.run', input)
    setSending(false)
    if (sent.ok) return setStarted(true)
    const listed = input.proceedDespiteWarnings ? null : warningsOf(sent.error)
    if (listed === null) return setRefusal(sent.error)
    setHeld(input)
    setReason('')
    setWarnings(listed)
  }

  function publish() {
    if (!canPublish || storage === null) return
    const replaceConfirmed = hasFiles && replaceTicked
    const input = { projectId, campaignId, storage, replaceConfirmed }
    void send({ ...input, proceedDespiteWarnings: false })
  }

  function publishAnyway() {
    if (held === null) return
    const trimmed = reason.trim()
    const extra = trimmed === '' ? {} : { proceedReason: trimmed }
    void send({ ...held, proceedDespiteWarnings: true, ...extra })
  }

  function back() {
    setWarnings(null)
    setRefusal(null)
  }

  const footer = started ? (
    <button type="button" className={layout.primary} onClick={props.onClose}>
      Close
    </button>
  ) : warnings !== null ? (
    <>
      <button type="button" disabled={sending} onClick={back}>
        Back
      </button>
      <button type="button" className={layout.primary} disabled={sending} onClick={publishAnyway}>
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

  const fonts = reply?.components.filter((c) => c.kind === 'font') ?? []
  return (
    <DialogFrame
      open
      onClose={props.onClose}
      title={`Publish ${props.campaignName}`}
      closable={!sending}
      footer={footer}
      size="wide"
    >
      {started ? (
        <p role="status" className={styles.line}>
          {STARTED}
        </p>
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
          {refusal !== null && (
            <p role="alert" className={`${layout.notice} ${layout.danger}`}>
              {refusal.message}
            </p>
          )}
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
            <>
              <StorageChoice
                storages={reply.storages}
                chosen={storage}
                disabled={sending}
                onChoose={choose}
              />
              {storage !== null && inspect.looking && (
                <p role="status" className={styles.line}>
                  Looking at the published folder…
                </p>
              )}
              {existing !== null && (
                <ReplaceWarning
                  existing={existing}
                  confirmed={replaceTicked}
                  disabled={sending}
                  onConfirm={setReplaceTicked}
                />
              )}
              <p className={styles.line}>{PROMPT_LINE}</p>
              <PublishFileList components={reply.components} />
              {fonts.length > 0 && (
                <FontShareChoice
                  projectId={projectId}
                  fonts={fonts}
                  disabled={sending}
                  onChanged={readAgain}
                />
              )}
              <p className={styles.line}>{ALSO_LINE}</p>
            </>
          )}
          {refusal !== null && (
            <p role="alert" className={`${layout.notice} ${layout.danger}`}>
              {refusal.message}
            </p>
          )}
        </div>
      )}
    </DialogFrame>
  )
}
