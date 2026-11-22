// round-2-approvals-video.md "The gallery", the script: when a lightbox closes (Escape, Close, or
// a step to another card), every video in it is paused, so a lightbox left behind goes quiet.
// When a clip fails to load, the lightbox's failure notice, already in the markup, is shown. It
// touches only `pause()` and the notice's `hidden`; it never sets a source, loads or plays.

// The page's parts this module uses, by shape: the test project compiles this file without the
// browser's types.
type Query = { querySelectorAll<Found>(selectors: string): Iterable<Found> }
type Listens = {
  addEventListener(type: string, listener: () => void): void
  removeEventListener(type: string, listener: () => void): void
}
type Video = Listens & { pause(): void }
type Notice = { hidden: boolean }
type Lightbox = Query & Listens
export type VideoPage = { document: Query }

export type ClipParts<V, F, N> = { videos: V[]; failing: (V | F)[]; notice: N | null }

// A lightbox's videos; the videos and their sources, either of which reports a failed clip with
// its `error` event (a source that cannot load fires it on the source, not the video); and the
// failure notice.
export function clipParts<V = Video, F = Listens, N = Notice>(lightbox: Query): ClipParts<V, F, N> {
  const videos = [...lightbox.querySelectorAll<V>('video')]
  const sources = [...lightbox.querySelectorAll<F>('video source')]
  const [notice = null] = lightbox.querySelectorAll<N>('[data-clip-error]')
  return { videos, failing: [...videos, ...sources], notice }
}

function listen(target: Listens, type: string, listener: () => void): () => void {
  target.addEventListener(type, listener)
  return () => target.removeEventListener(type, listener)
}

export function startPauseVideos({ document }: VideoPage): () => void {
  const stops = [...document.querySelectorAll<Lightbox>('dialog[data-lightbox]')].flatMap(
    (lightbox) => {
      const { videos, failing, notice } = clipParts<Video, Listens, Notice>(lightbox)
      if (videos.length === 0) return []
      const pause = () => {
        for (const video of videos) video.pause()
      }
      const show = () => {
        if (notice !== null) notice.hidden = false
      }
      return [
        listen(lightbox, 'close', pause),
        ...failing.map((part) => listen(part, 'error', show)),
      ]
    },
  )
  return () => {
    for (const stop of stops) stop()
  }
}
