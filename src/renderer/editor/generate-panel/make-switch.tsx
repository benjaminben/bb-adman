// "Make" (spec/phases/design-wave-screens-a.md ED-4a): two segments, "Picture" and "Video", on
// every picture and background layer. When a video cannot be made here, "Video" is disabled and
// its reason is its title and its accessible description (a screen reader gets no title on a
// disabled button reliably). On a video post's background with "Picture" chosen, an InfoTip says
// what shows over the picture. Choosing a segment changes the draft only; nothing is sent.
import { useId } from 'react'
import { Icon, type IconName } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import type { GenerateKind } from '@/renderer/stores/generate-drafts'
import layout from '@/renderer/ui/layout.module.css'
import styles from './generate-panel.module.css'

const KINDS: { kind: GenerateKind; label: string; icon: IconName }[] = [
  { kind: 'image', label: 'Picture', icon: 'image' },
  { kind: 'video', label: 'Video', icon: 'film' },
]

export type MakeSwitchProps = {
  kind: GenerateKind
  // Why a video cannot be made here; null when it can.
  videoReason: string | null
  // A video post's background: a picture chosen there gets the InfoTip.
  videoPost: boolean
  disabled: boolean
  onChange: (kind: GenerateKind) => void
}

export function MakeSwitch(props: MakeSwitchProps) {
  const labelId = useId()
  const reasonId = useId()
  const reason = props.videoReason
  return (
    <div className={styles.make}>
      <span id={labelId} className={layout.label}>
        Make
      </span>
      <div role="group" aria-labelledby={labelId} className={layout.seg}>
        {KINDS.map((k) => {
          const off = k.kind === 'video' && reason !== null
          return (
            <button
              key={k.kind}
              type="button"
              className={styles.segment}
              aria-pressed={props.kind === k.kind}
              disabled={props.disabled || off}
              title={off ? reason : undefined}
              aria-describedby={off ? reasonId : undefined}
              onClick={() => props.onChange(k.kind)}
            >
              <Icon name={k.icon} size="small" />
              {k.label}
            </button>
          )
        })}
      </div>
      {reason !== null && (
        <span id={reasonId} className={styles.hidden}>
          {reason}
        </span>
      )}
      {props.videoPost && props.kind === 'image' && (
        <InfoTip about="pictures on a video post">
          On a video post, the clips on the timeline show over this picture.
        </InfoTip>
      )}
    </div>
  )
}
