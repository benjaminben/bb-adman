import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneAsset } from '@/shared/scene/types'
import { placePicture, type Size } from '@/shared/scene/background-placement'
import { safePlacement, type ClipAt } from '@/shared/scene/clip-at'
import { pictureLookOf } from '@/shared/config/look'
import { rgbCss } from '@/shared/scene/colour-css'
import { shadeCss } from '@/shared/scene/shade-css'

// P7-8, phase-07.md "Clips and the track", "Drawing": a video variant's background layer,
// drawn from the clip under the time instead of the layer's own source. The clip goes in its
// placement box (relative to the layer's box) or the layer's own geometry, by placePicture with
// cover, under the layer's opacity, fill colour and shade. No clip: an empty box, so the
// Scene's black root shows. `readyRef` holds the promise the Scene's settle waits for.
type Props = {
  layer: LayerRow
  box: CSSProperties
  found: ClipAt | null
  asset: SceneAsset | null
  playing: boolean
  sound: boolean
  readyRef: RefObject<Promise<void>>
}

// While playing, the video is moved back to the playhead when it is further off than this.
const DRIFT_MS = 250

function frameCss(layer: LayerRow, place: Geometry, own: boolean): CSSProperties {
  if (own) return { position: 'absolute', inset: 0, overflow: 'hidden' }
  return {
    position: 'absolute',
    left: place.x - layer.geometry.x,
    top: place.y - layer.geometry.y,
    width: place.width,
    height: place.height,
    transform: `rotate(${place.rotation}deg)`,
    transformOrigin: '50% 50%',
    overflow: 'hidden',
  }
}

export function ClipTrack({ layer, box, found, asset, playing, sound, readyRef }: Props) {
  const isVideo = Boolean(found && asset?.kind === 'video')
  useEffect(() => {
    if (!isVideo) readyRef.current = Promise.resolve()
  })
  if (!found || !asset)
    return <div data-layer-id={layer.id} style={{ ...box, overflow: 'hidden' }} />
  const look = 'opacity' in layer.style ? pictureLookOf(layer.style) : null
  const fill = rgbCss(look?.fillColor)
  const shade = shadeCss(look?.shade)
  const { clip } = found
  const place = clip.placement ? safePlacement(clip.placement) : layer.geometry
  const media = { crop: place.crop, box: { width: place.width, height: place.height } }
  const key = `${clip.id}#${asset.url}#${asset.version}`
  return (
    <div
      data-layer-id={layer.id}
      data-clip-id={clip.id}
      style={{
        ...box,
        overflow: 'hidden',
        opacity: look ? look.opacity : 1,
        backgroundColor: fill ?? undefined,
      }}
    >
      <div style={frameCss(layer, place, clip.placement === null)}>
        {asset.kind === 'video' ? (
          <ClipVideo
            key={key}
            url={asset.url}
            {...media}
            sourceMs={found.sourceMs}
            playing={playing}
            muted={!sound || !clip.soundOn}
            readyRef={readyRef}
          />
        ) : (
          <ClipStill key={key} url={asset.url} {...media} />
        )}
      </div>
      {shade && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', ...shade }} />}
    </div>
  )
}

type MediaProps = { url: string; crop: Geometry['crop']; box: Size }

// Hidden until the media's own size is known.
function placedCss(natural: Size | null, { crop, box }: Omit<MediaProps, 'url'>): CSSProperties {
  const place = natural && placePicture(natural, crop, box, 'cover')
  if (!place) return { position: 'absolute', visibility: 'hidden' }
  return {
    position: 'absolute',
    left: place.x,
    top: place.y,
    width: place.width,
    height: place.height,
  }
}

function ClipStill({ url, ...media }: MediaProps) {
  const [natural, setNatural] = useState<Size | null>(null)
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      alt=""
      src={url}
      draggable={false}
      style={placedCss(natural, media)}
      onLoad={(e) =>
        setNatural({ width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
      }
      onError={() => setFailed(true)}
    />
  )
}

// Resolves once the video has moved to `seconds` and one frame has passed, or failed to load.
function seekTo(video: HTMLVideoElement, seconds: number): Promise<void> {
  return new Promise((done) => {
    const seek = () => {
      video.currentTime = seconds
    }
    const finish = () => {
      video.removeEventListener('loadedmetadata', seek)
      video.removeEventListener('seeked', finish)
      video.removeEventListener('error', finish)
      requestAnimationFrame(() => done())
    }
    video.addEventListener('seeked', finish)
    video.addEventListener('error', finish)
    if (video.error) finish()
    else if (video.readyState >= 1) seek()
    else video.addEventListener('loadedmetadata', seek)
  })
}

type VideoProps = MediaProps & {
  sourceMs: number
  playing: boolean
  muted: boolean
  readyRef: RefObject<Promise<void>>
}

// Paused: seeked to the source time, settled after `seeked` and one frame. Playing: play(),
// corrected when it drifts more than DRIFT_MS from the source time.
function ClipVideo({ url, sourceMs, playing, muted, readyRef, ...media }: VideoProps) {
  const element = useRef<HTMLVideoElement>(null)
  const [natural, setNatural] = useState<Size | null>(null)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    if (element.current) element.current.muted = muted
  }, [muted])
  useEffect(() => {
    const video = element.current
    if (!video) return
    if (!playing) {
      if (!video.paused) video.pause()
      readyRef.current = seekTo(video, sourceMs / 1000)
      return
    }
    readyRef.current = Promise.resolve()
    if (Math.abs(video.currentTime * 1000 - sourceMs) > DRIFT_MS)
      video.currentTime = sourceMs / 1000
    if (video.paused) void video.play()?.catch(() => undefined)
  }, [playing, sourceMs, readyRef])
  if (failed) return null
  return (
    <video
      ref={element}
      src={url}
      muted={muted}
      playsInline
      preload="auto"
      style={placedCss(natural, media)}
      onLoadedMetadata={(e) => {
        const { videoWidth, videoHeight } = e.currentTarget
        if (videoWidth > 0 && videoHeight > 0)
          setNatural({ width: videoWidth, height: videoHeight })
      }}
      onError={() => setFailed(true)}
    />
  )
}
