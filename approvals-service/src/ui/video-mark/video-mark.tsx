import { clipLength } from '../clip-length'
import styles from './video-mark.module.css'

// round-2-approvals-video.md "The card": on the picture's top-left corner, inside the picture
// button, a play triangle and the clip's length, or "still only" when no clip was sent.
export function VideoMark({ durationMs }: { durationMs: number | null }) {
  return (
    <span className={styles.mark}>
      <svg className={styles.play} viewBox="0 0 10 10" aria-hidden="true">
        <path d="M2 1 L9 5 L2 9 Z" fill="currentColor" />
      </svg>
      {durationMs === null ? 'Video, still only' : `Video ${clipLength(durationMs)}`}
    </span>
  )
}
