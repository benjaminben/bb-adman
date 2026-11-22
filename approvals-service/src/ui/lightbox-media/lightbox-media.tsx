import type { Variant } from '../../visitor/actions'
import { clipLength } from '../clip-length'
import { Notice } from '../notice/notice'
import { pictureSize } from '../picture-size'
import styles from './lightbox-media.module.css'

type Props = { slug: string; variant: Variant }

const CLIP_ERROR =
  'The video could not be loaded. Reload the page to try again. If it still fails, ask the person who sent the link to update the gallery.'
const STILL_ONLY =
  'This variant is a video, but only its still picture was sent. Ask the person who sent the link to update the gallery.'

// spec/phases/round-2-approvals.md "The lightbox" and round-2-approvals-video.md "The lightbox":
// the picture, large, the video player, or the expiry sentence in its place. Every address is
// built only from the checked slug, the view's variant key and a whole number; a clip's bytes
// come only from the service's own clip route. Nothing loads until the dialog is first opened
// (the picture is lazy) or play is pressed (the video's preload is none).
export function LightboxMedia({ slug, variant }: Props) {
  if (variant.expired) {
    return (
      <p className={styles.expired}>
        This picture has expired. Ask the person who sent the link to update the gallery.
      </p>
    )
  }
  const { width, height } = pictureSize(variant.sizeLine)
  const { variantKey, version } = variant
  const picture = `/l/${slug}/p/${variantKey}/${version}`
  const clip = variant.video?.clip ?? null
  if (clip !== null) {
    return (
      <div className={styles.media}>
        <video
          className={styles.video}
          controls
          preload="none"
          playsInline
          controlsList="nodownload"
          poster={picture}
          width={width}
          height={height}
        >
          <source src={`/l/${slug}/c/${variantKey}/${version}`} type="video/mp4" />
          This browser cannot play the video.
        </video>
        <p className={styles.line}>
          Video, {clipLength(clip.durationMs)}. Sound plays when you press play.
        </p>
        <div className={styles.error} role="alert" data-clip-error="" hidden>
          {CLIP_ERROR}
        </div>
      </div>
    )
  }
  const image = (
    <img
      className={styles.picture}
      src={picture}
      alt={variant.title}
      width={width}
      height={height}
      loading="lazy"
    />
  )
  if (variant.video === null) return image
  return (
    <div className={styles.media}>
      {image}
      <Notice tone="info">{STILL_ONLY}</Notice>
    </div>
  )
}
