// P7-20 (spec/phases/phase-07-slices-2.md): under the background row, the chosen clip's
// "Remove", and "Sound" on and off for a video clip. A block may be too narrow to hold them,
// so they stand here, named by the clip.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { ClipKind } from './clip-drag'
import { useClipSend } from './use-clip-send'
import styles from './clip-block.module.css'

export type ClipActionsProps = {
  projectId: string
  clip: BackgroundClipRow
  label: string
  kind: ClipKind
  onResult: (message: string | null) => void
}

export function ClipActions({ projectId, clip, label, kind, onResult }: ClipActionsProps) {
  const id = useId()
  const send = useClipSend(projectId, onResult)
  return (
    <div role="group" aria-labelledby={id} className={styles.actions}>
      <span id={id} className={styles.actionsName}>
        {label}
      </span>
      {kind === 'video' && (
        <label className={styles.sound}>
          <input
            type="checkbox"
            checked={clip.soundOn}
            onChange={(event) =>
              send('clip.update', { clipId: clip.id, soundOn: event.target.checked })
            }
          />
          Sound
        </label>
      )}
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        onClick={() => send('clip.remove', { clipId: clip.id })}
      >
        Remove
      </button>
    </div>
  )
}
