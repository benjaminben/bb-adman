// The package dialog's content for each view: ready, done, files missing and refused, with
// "Packaging…" over the last view while a send waits. The primary button takes focus in each
// new view ("Close" when done). "Find missing files…" opens the relink dialog for those files;
// when it closes, the package is sent again to the same folder.
import { useEffect, useRef, useState } from 'react'
import { RelinkDialog } from '@/renderer/dialogs/relink-dialog'
import { BusySpinner, DialogFoot } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { fileSize } from './file-size'
import { usePackage, type PackageView } from './use-package'
import styles from './package-dialog.module.css'

export type PackageBodyProps = {
  projectId: string
  onBusy: (busy: boolean) => void
  onClose: () => void
}

function doneLine(view: Extract<PackageView, { kind: 'done' }>) {
  const { fileCount, totalBytes, skippedAssetIds } = view.result
  const skipped = skippedAssetIds.length
  const left = skipped > 0 ? ` ${skipped} missing file(s) were left out.` : ''
  return `The package is ready: ${fileCount} file(s), ${fileSize(totalBytes)}.${left}`
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
    <button type="button" disabled={packaging} onClick={props.onClose}>
      Cancel
    </button>
  )
  const button = (label: string, onClick: () => void) => (
    <button
      type="button"
      ref={primary}
      className={layout.primary}
      disabled={packaging}
      onClick={onClick}
    >
      {label}
    </button>
  )

  return (
    <>
      {packaging && (
        <p role="status" className={styles.busy}>
          <BusySpinner />
          Packaging… Large projects take a while.
        </p>
      )}
      {view.kind === 'done' && (
        <>
          <p role="status" className={`${layout.notice} ${layout.ok}`}>
            {doneLine(view)}
          </p>
          <DialogFoot>{button('Close', props.onClose)}</DialogFoot>
        </>
      )}
      {view.kind === 'missing' && (
        <>
          <p className={styles.listLabel}>
            {view.assetIds.length} file(s) cannot be found, so the package would not open with
            nothing missing.
          </p>
          <ul aria-label="Missing files" className={styles.list}>
            {view.names.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
          <DialogFoot className={styles.choices}>
            {button('Find missing files…', () => setRelinkOpen(true))}
            <button type="button" disabled={packaging} onClick={() => void send(true)}>
              Package without them
            </button>
            {cancel}
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
            {cancel}
            {button(
              view.kind === 'ready' ? 'Choose a folder and package…' : 'Choose another folder…',
              () => void choose(),
            )}
          </DialogFoot>
        </>
      )}
    </>
  )
}
