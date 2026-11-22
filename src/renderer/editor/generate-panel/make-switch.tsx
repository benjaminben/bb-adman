// "Make" (spec/phases/round-2-editor.md D4, "Picture or video"): a two-way switch on the
// background layer of a video post. "Video" is disabled, with its line, when no video service
// is set up.
import { useId } from 'react'
import type { GenerateKind } from '@/renderer/stores/generate-drafts'
import layout from '@/renderer/ui/layout.module.css'

const KINDS: { kind: GenerateKind; label: string }[] = [
  { kind: 'image', label: 'Picture' },
  { kind: 'video', label: 'Video' },
]

export type MakeSwitchProps = {
  kind: GenerateKind
  // No available provider makes videos.
  videoOff: boolean
  disabled: boolean
  onChange: (kind: GenerateKind) => void
}

export function MakeSwitch(props: MakeSwitchProps) {
  const labelId = useId()
  return (
    <>
      <div className={layout.row}>
        <span id={labelId} className={layout.label}>
          Make
        </span>
        <div role="group" aria-labelledby={labelId} className={layout.seg}>
          {KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              aria-pressed={props.kind === k.kind}
              disabled={props.disabled || (k.kind === 'video' && props.videoOff)}
              onClick={() => props.onChange(k.kind)}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>
      {props.videoOff && (
        <p className={layout.muted}>No video service is set up. Add a key in Settings.</p>
      )}
    </>
  )
}
