'use client'
// spec/phases/round-2-approvals.md R2A-8 and S-12: the page's one script of our own. It draws
// nothing and reads nothing from an address, a cookie or storage, and sends no request. It wires
// the lightbox's arrow keys, the command-button fallback and the masonry spans once, after the
// page has hydrated; the page works the same without it.
import { useEffect } from 'react'
import { startArrowKeys, type ArrowPage } from './arrow-keys'
import { startCommandFallback, type FallbackPage } from './command-fallback'
import { startMasonrySpans, type MasonryPage } from './masonry-spans'

// The browser's window, by the shapes the three modules use: the test project, which compiles
// this file too, has no browser types.
type Page = ArrowPage & FallbackPage & MasonryPage

export function GalleryScript() {
  useEffect(() => {
    const page = globalThis as unknown as Page
    const stops = [startArrowKeys(page), startCommandFallback(page), startMasonrySpans(page)]
    return () => {
      for (const stop of stops) stop()
    }
  }, [])
  return null
}
