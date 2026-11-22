// P7-20 (spec/phases/phase-07-slices-2.md): the chosen clip's "Remove", and its sound on and
// off for a video clip. ED-6 (design-wave-screens-a.md, "Timeline small flaws"): a small bar
// laid over the top edge of the block at its right end, beside it in the lane so it never
// changes the block's size; a group named by the clip, holding icon buttons "Sound for {label}"
// (aria-pressed) and "Remove {label}". The commands are those the old strip sent.
import { Icon } from '@/renderer/ui/icon'
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
  right: string // the block's right edge, from the lane's right, as a share of the lane
  onResult: (message: string | null) => void
}

export function ClipActions({ projectId, clip, label, kind, right, onResult }: ClipActionsProps) {
  const send = useClipSend(projectId, onResult)
  const soundName = `Sound for ${label}`
  const removeName = `Remove ${label}`
  return (
    <div role="group" aria-label={label} className={styles.actions} style={{ right }}>
      {kind === 'video' && (
        <button
          type="button"
          className={layout.iconButton}
          aria-label={soundName}
          title={soundName}
          aria-pressed={clip.soundOn}
          onClick={() => send('clip.update', { clipId: clip.id, soundOn: !clip.soundOn })}
        >
          <Icon name={clip.soundOn ? 'speaker' : 'speakerOff'} size="small" />
        </button>
      )}
      <button
        type="button"
        className={layout.iconButton}
        aria-label={removeName}
        title={removeName}
        onClick={() => send('clip.remove', { clipId: clip.id })}
      >
        <Icon name="trash" size="small" />
      </button>
    </div>
  )
}
