// spec/editor.md, "Picture chooser": a dialog titled "Choose a picture for {layer name}" over
// the asset library's pictures. Choosing one hands it to onChoose (the panel sends one
// layer.update with the source) and closes; a refusal shows its message and the dialog stays.
// "Cancel" closes and sends nothing. The body mounts afresh at each open, so the list is read
// again every time. Focus goes back to the control that opened it (the dialog frame).
// SP-8: a reference-library subject photo is first moved to the asset library (asset.update);
// a refused move shows its message and places nothing.
import { useState } from 'react'
import { BusySpinner, DialogFoot, DialogFrame } from '@/renderer/ui/dialog-frame'
import layout from '@/renderer/ui/layout.module.css'
import { PictureGrid } from './picture-grid'
import { SubjectReferenceList } from './subject-reference-list'
import { usePictures } from './use-pictures'
import styles from './picture-chooser.module.css'

export type PictureChooserProps = {
  projectId: string
  layerName: string
  open: boolean
  // Resolves to the refusal message, or null when the picture was set.
  onChoose: (assetId: string) => Promise<string | null>
  onClose: () => void
}

type BodyProps = Omit<PictureChooserProps, 'open' | 'layerName'> & {
  onBusy: (busy: boolean) => void
}

function ChooserBody(props: BodyProps) {
  const { pictures, subjectPhotos, error, setError, importPictures, moveToAssetLibrary } =
    usePictures(props.projectId)
  const [busy, setBusy] = useState(false)

  // moveFirst: a reference-library subject photo goes to the asset library before it is placed.
  async function choose(assetId: string, moveFirst = false) {
    setBusy(true)
    props.onBusy(true)
    const moveRefused = moveFirst ? await moveToAssetLibrary(assetId) : null
    const refused = moveRefused ?? (await props.onChoose(assetId))
    setBusy(false)
    props.onBusy(false)
    if (refused === null) props.onClose()
    else setError(refused)
  }

  return (
    <>
      {error && (
        <p role="alert" className={`${layout.notice} ${layout.danger} ${styles.line}`}>
          {error}
        </p>
      )}
      {pictures === null ? (
        <p className={styles.busy}>
          <BusySpinner />
          Reading the asset library…
        </p>
      ) : pictures.length === 0 ? (
        <p className={`${layout.empty} ${styles.line}`}>No pictures in the asset library yet.</p>
      ) : (
        <PictureGrid
          projectId={props.projectId}
          pictures={pictures}
          disabled={busy}
          onChoose={(assetId) => void choose(assetId)}
        />
      )}
      <SubjectReferenceList
        projectId={props.projectId}
        photos={subjectPhotos}
        disabled={busy}
        onChoose={(assetId) => void choose(assetId, true)}
      />
      <DialogFoot>
        <button type="button" disabled={busy} onClick={() => void importPictures()}>
          Import pictures…
        </button>
        <button type="button" disabled={busy} onClick={props.onClose}>
          Cancel
        </button>
      </DialogFoot>
    </>
  )
}

export function PictureChooser(props: PictureChooserProps) {
  const [busy, setBusy] = useState(false)
  return (
    <DialogFrame
      open={props.open}
      onClose={props.onClose}
      title={`Choose a picture for ${props.layerName}`}
      closable={!busy}
      size="large"
    >
      {props.open && (
        <ChooserBody
          projectId={props.projectId}
          onChoose={props.onChoose}
          onClose={props.onClose}
          onBusy={setBusy}
        />
      )}
    </DialogFrame>
  )
}
