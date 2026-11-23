// The quickstart's drawing page. It draws with the app's own Scene component, the one the
// editor and export use, so a quickstart ad looks as the app would draw it. The CLI opens this
// page in a browser with no window and photographs it.
import { createRoot } from 'react-dom/client'
import { Scene } from '@/shared/scene/scene'
import type { SceneProps, SceneSettled } from '@/shared/scene/types'

export type DrawProps = Omit<SceneProps, 'onSettled'>
export type PagePixels = { width: number; height: number; base64: string }

export type StudioPage = {
  draw(props: DrawProps, scale: number): Promise<SceneSettled>
  pixels(url: string): Promise<PagePixels>
}

declare global {
  interface Window {
    studio?: StudioPage
  }
}

const CHUNK = 0x8000

// The bytes as base64, a piece at a time so a large picture does not overflow the call stack.
function base64Of(bytes: Uint8ClampedArray): string {
  let text = ''
  for (let at = 0; at < bytes.length; at += CHUNK) {
    text += String.fromCharCode(...bytes.subarray(at, at + CHUNK))
  }
  return btoa(text)
}

const element = document.getElementById('root')
if (element) {
  const root = createRoot(element)
  let draws = 0
  window.studio = {
    // A new key each time, so every draw is a fresh Scene that settles once.
    draw(props, scale) {
      draws += 1
      const { width, height } = props.variant
      const style = { width, height, transform: `scale(${scale})`, transformOrigin: '0 0' }
      return new Promise<SceneSettled>((settled) => {
        root.render(
          <div style={style}>
            <Scene key={draws} {...props} onSettled={settled} />
          </div>,
        )
      })
    },
    // A picture's pixels, for the app's check that text can be read on it.
    async pixels(url) {
      const answer = await fetch(url)
      const bitmap = await createImageBitmap(await answer.blob())
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
      const context = canvas.getContext('2d')
      if (!context) throw new Error('No canvas')
      context.drawImage(bitmap, 0, 0)
      const { data } = context.getImageData(0, 0, bitmap.width, bitmap.height)
      return { width: bitmap.width, height: bitmap.height, base64: base64Of(data) }
    },
  }
}
