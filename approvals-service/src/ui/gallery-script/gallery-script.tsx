'use client'
// spec/phases/round-2-approvals.md R2A-8 and S-12: the page's one script of our own. It draws
// nothing and reads nothing from an address, a cookie or storage, and sends no request. It wires
// the lightbox's arrow keys, the command-button fallback, the masonry spans and the video pause
// and failure notice (round-2-approvals-video.md R2V-6) once, after the page has hydrated; the
// page works the same without it.
import { useEffect } from 'react'
import { startArrowKeys, type ArrowPage } from './arrow-keys'
import { startCommandFallback, type FallbackPage } from './command-fallback'
import { startMasonrySpans, type MasonryPage } from './masonry-spans'
import { startPauseVideos, type VideoPage } from './pause-videos'

// The browser's window, by the shapes the four modules use: the test project, which compiles
// this file too, has no browser types.
type Page = ArrowPage & FallbackPage & MasonryPage & VideoPage

export function GalleryScript() {
  useEffect(() => {
    const page = globalThis as unknown as Page
    const stops = [
      startArrowKeys(page),
      startCommandFallback(page),
      startMasonrySpans(page),
      startPauseVideos(page),
    ]
    return () => {
      for (const stop of stops) stop()
    }
  }, [])
  return null
}
