// The package dialog's content for each view: ready, done, files missing and refused, with a
// "Packaging" bar over the last view while a send waits (DLG-6a). The primary button takes
// focus in each new view ("Close" when done). "Find…" ("Find missing files…") opens the relink
// dialog for those files; when it closes, the package is sent again to the same folder. Short
// button words keep their old accessible names. No path is drawn.
import { useEffect, useRef, useState } from 'react'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import { DialogFoot } from '@/renderer/ui/dialog-frame'
import { InfoTip } from '@/renderer/ui/info-tip'
import { JobProgress } from '@/renderer/ui/job-progress'
import layout from '@/renderer/ui/layout.module.css'
import { plural } from '@/renderer/ui/plural'
import { StatusMark } from '@/renderer/ui/status-mark'
import { fileSize } from './file-size'
import { MissingList } from './missing-list'
import { usePackage, type PackageView } from './use-package'
import styles from './package-dialog.module.css'

export type PackageBodyProps = {
  projectId: string
  onBusy: (busy: boolean) => void
  onClose: () => void
}

const ABOUT =
  'Adman copies the project file and every file it uses into one new folder that can be ' +
  'opened on another computer. The project you have open does not change.'

function Done(props: { view: Extract<PackageView, { kind: 'done' }> }) {
  const { fileCount, totalBytes, skippedAssetIds } = props.view.result
  const files = `${plural(fileCount, 'file')} · ${fileSize(totalBytes)}`
  const skipped = skippedAssetIds.length
  return (
    <div role="status" className={styles.done}>
      <StatusMark tone="ok" icon="check" label={files} tip={`The package is ready: ${files}.`} />
      {skipped > 0 && (
        <p className={styles.left}>
          {`${plural(skipped, 'missing file')} ${skipped === 1 ? 'was' : 'were'} left out.`}
        </p>
      )}
    </div>
  )
}

export function PackageBody(props: PackageBodyProps) {
  const { view, packaging, choose, send } = usePackage(props.projectId, props.onBusy)
  const [relinkOpen, setRelinkOpen] = useState(false)
  const primary = useRef<HTMLButtonElement>(null)

  // After the frame's own open step, which notes the control that opened the dialog.
  useEffect(() => {
    queueMicrotask(() => primary.current?.focus())
  }, [view])

  function relinkClosed() {
    setRelinkOpen(false)
    void send(false)
  }

  const cancel = (
    <button type="button" className={layout.quiet} disabled={packaging} onClick={props.onClose}>
      Cancel
    </button>
  )
  const button = (label: string, onClick: () => void, name?: string) => (
    <button
      type="button"
      ref={primary}
      className={layout.primary}
      aria-label={name}
      title={name}
      disabled={packaging}
      onClick={onClick}
    >
      {label}
    </button>
  )

  return (
    <>
      {packaging && <JobProgress label="Packaging" value={null} />}
      {view.kind === 'done' && (
        <>
          <Done view={view} />
          <DialogFoot>{button('Close', props.onClose)}</DialogFoot>
        </>
      )}
      {view.kind === 'missing' && (
        <>
          <MissingList count={view.assetIds.length} names={view.names} />
          <DialogFoot>
            {cancel}
            <button
              type="button"
              className={layout.secondary}
              aria-label="Package without them"
              title="Package without them"
              disabled={packaging}
              onClick={() => void send(true)}
            >
              Skip them
            </button>
            {button('Find…', () => setRelinkOpen(true), 'Find missing files…')}
          </DialogFoot>
          <RelinkDialog
            projectId={props.projectId}
            open={relinkOpen}
            onClose={relinkClosed}
            onlyAssetIds={view.assetIds}
          />
        </>
      )}
      {(view.kind === 'ready' || view.kind === 'refused') && (
        <>
          {view.kind === 'refused' && (
            <p role="alert" className={`${layout.notice} ${layout.danger}`}>
              {view.message}
            </p>
          )}
          <DialogFoot>
            {view.kind === 'ready' && !packaging && (
              <span className={styles.about}>
                <InfoTip about="packaging">{ABOUT}</InfoTip>
              </span>
            )}
            {cancel}
            {view.kind === 'ready'
              ? button('Choose folder…', () => void choose(), 'Choose a folder and package…')
              : button('Choose another folder…', () => void choose())}
          </DialogFoot>
        </>
      )}
    </>
  )
}
